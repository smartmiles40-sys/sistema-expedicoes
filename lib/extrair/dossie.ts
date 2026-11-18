/**
 * "Extrair dados p/ Claude" — monta um DOSSIÊ em Markdown de uma expedição/pacote
 * (ou de UM passageiro) pra o time de Relacionamento colar na Claude e fazer o
 * double check: roteiro dia a dia × voos × passeios/ingressos × hospedagens/rooming ×
 * vouchers × documentos de cada passageiro.
 *
 * Só LEITURA (usa os mesmos fetchers das telas — sessão do usuário / mock).
 * Devolve também a lista de arquivos (id + caminho) pro cliente montar o ZIP
 * no navegador (a função da Vercel tem teto de ~4,5 MB de resposta, então os
 * binários NÃO passam por aqui).
 */
import "server-only";
import { differenceInCalendarDays, parseISO, addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import {
  getExpedicao, listPassageiros, listRoteiro, listVoosExpedicao, listPasseios,
  listInfoDestino, listPasseiosOpcionais, listExtensoes, listContratacoesExtensao,
  listRoteiroLider, listQuartos, listAlocacoes, getProntidaoExpedicao, listRoteiroFotos,
} from "@/lib/data/expedicoes";
import { listArquivosExpedicao } from "@/lib/data/arquivos";
import { listArquivosMock } from "@/lib/data/arquivos-mock";
import { listGruposExpedicao } from "@/lib/data/grupos";
import { mockPasseioOpcionalCompras } from "@/lib/mock-data";
import { MARCADOR_DOC_LIDER } from "@/lib/constants";
import type {
  ArquivoRow, ExpedicaoRow, PassageiroRow, RoteiroDiaRow, ExpedicaoVooRow, QuartoRow,
} from "@/types/database";

export type ArquivoDoPacote = { id: string; caminho: string; tamanho: number | null };

export type DossieClaude = {
  nomeBase: string; // usado no nome do .md / .zip
  markdown: string;
  arquivos: ArquivoDoPacote[];
  /** Arquivos pessoais (passaporte, vacina, documentos pessoais) — o ZIP pode omitir. */
  idsPessoais: string[];
};

// ---------------------------------------------------------------------------
// helpers de formatação
// ---------------------------------------------------------------------------
const dt = (iso: string | null | undefined) => {
  if (!iso) return "sem data";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "dd/MM/yyyy (EEE)", { locale: ptBR });
};
const dtHora = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, iso.length > 10 ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: ptBR });
};
const txt = (v: unknown) => (v == null || String(v).trim() === "" ? "—" : String(v).trim());
const cel = (v: unknown) => txt(v).replace(/\|/g, "/").replace(/\s*\n\s*/g, " · ");
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "arquivo";

const SEMAFORO_TXT: Record<string, string> = {
  ok: "✅ OK", atencao: "⚠️ atenção", bloqueio: "❌ bloqueio", na: "n/a",
};

/** Pastas do ZIP por categoria. */
function pastaCategoria(c: string) {
  return slug(c).replace(/ /g, "-").toLowerCase();
}

// ---------------------------------------------------------------------------
// leitura extra (não há fetcher pronto)
// ---------------------------------------------------------------------------
async function listComprasPasseiosOpcionais(paxIds: string[]) {
  if (!paxIds.length) return [] as { passageiro_id: string; passeio_opcional_id: string }[];
  if (DEV_USE_MOCK_DATA) {
    const s = new Set(paxIds);
    return mockPasseioOpcionalCompras.filter((c) => s.has(c.passageiro_id));
  }
  const sb = await getServerClient();
  const { data } = await sb
    .from("passeio_opcional_compras")
    .select("passageiro_id, passeio_opcional_id")
    .in("passageiro_id", paxIds);
  return (data ?? []) as { passageiro_id: string; passeio_opcional_id: string }[];
}

/** Arquivos citados por id mas fichados em OUTRA expedição (passaporte/vacina são por pessoa). */
async function buscarArquivosPorId(ids: string[]): Promise<ArquivoRow[]> {
  if (!ids.length) return [];
  if (DEV_USE_MOCK_DATA) {
    const s = new Set(ids);
    return (await listArquivosMock()).filter((a) => s.has(a.id));
  }
  const sb = await getServerClient();
  const { data } = await sb.from("arquivos").select("*").in("id", ids);
  return (data ?? []) as ArquivoRow[];
}

// ---------------------------------------------------------------------------
// montagem
// ---------------------------------------------------------------------------
export async function montarDossieClaude(
  expedicaoId: string,
  passageiroId?: string | null,
): Promise<DossieClaude | null> {
  const exp = await getExpedicao(expedicaoId);
  if (!exp) return null;

  const [
    todosPax, roteiro, voos, passeios, info, opcionais, extensoes, contratExt,
    roteiroLider, quartos, alocacoes, prontidao, arquivosExp, grupos, fotos,
  ] = await Promise.all([
    listPassageiros(expedicaoId),
    listRoteiro(expedicaoId),
    listVoosExpedicao(expedicaoId),
    listPasseios(expedicaoId),
    listInfoDestino(expedicaoId),
    listPasseiosOpcionais(expedicaoId),
    listExtensoes(expedicaoId),
    listContratacoesExtensao(expedicaoId),
    listRoteiroLider(expedicaoId),
    listQuartos(expedicaoId),
    listAlocacoes(expedicaoId),
    getProntidaoExpedicao(expedicaoId),
    listArquivosExpedicao(expedicaoId),
    listGruposExpedicao(expedicaoId),
    listRoteiroFotos(expedicaoId),
  ]);

  const modoPax = !!passageiroId;
  const paxAtivos = todosPax.filter((p) => p.status_reserva !== "Cancelado");
  const pax = modoPax ? todosPax.filter((p) => p.id === passageiroId) : paxAtivos;
  if (modoPax && !pax.length) return null;
  const compras = await listComprasPasseiosOpcionais(pax.map((p) => p.id));

  // Índices
  const arqPorId = new Map<string, ArquivoRow>(arquivosExp.map((a) => [a.id, a]));
  const faltando = new Set<string>();
  for (const p of pax) if (p.passaporte_arquivo_id && !arqPorId.has(p.passaporte_arquivo_id)) faltando.add(p.passaporte_arquivo_id);
  for (const pr of prontidao) for (const r of pr.requisitos) if (r.arquivo_id && !arqPorId.has(r.arquivo_id)) faltando.add(r.arquivo_id);
  for (const a of await buscarArquivosPorId([...faltando])) arqPorId.set(a.id, a);

  const extPorId = new Map(extensoes.map((e) => [e.id, e]));
  const grupoPorId = new Map(grupos.map((g) => [g.id, g]));
  const paxPorId = new Map(todosPax.map((p) => [p.id, p]));
  const quartoPorId = new Map(quartos.map((q) => [q.id, q]));
  const fotosIds = new Set(fotos.map((f) => f.arquivo_id));
  const extDoPax = new Map<string, Set<string>>();
  for (const c of contratExt) {
    if (!extDoPax.has(c.passageiro_id)) extDoPax.set(c.passageiro_id, new Set());
    extDoPax.get(c.passageiro_id)!.add(c.extensao_id);
  }
  const comprasDoPax = new Map<string, Set<string>>();
  for (const c of compras) {
    if (!comprasDoPax.has(c.passageiro_id)) comprasDoPax.set(c.passageiro_id, new Set());
    comprasDoPax.get(c.passageiro_id)!.add(c.passeio_opcional_id);
  }
  const prontPorPax = new Map(prontidao.map((p) => [p.passageiro.id, p]));
  const quartosDoPax = new Map<string, QuartoRow[]>();
  const paxDoQuarto = new Map<string, string[]>();
  for (const a of alocacoes) {
    const q = quartoPorId.get(a.quarto_id);
    if (!q) continue;
    if (!quartosDoPax.has(a.passageiro_id)) quartosDoPax.set(a.passageiro_id, []);
    quartosDoPax.get(a.passageiro_id)!.push(q);
    if (!paxDoQuarto.has(q.id)) paxDoQuarto.set(q.id, []);
    paxDoQuarto.get(q.id)!.push(a.passageiro_id);
  }

  // --- Arquivos do pacote (ZIP) -------------------------------------------
  const arquivos: ArquivoDoPacote[] = [];
  const idsPessoais = new Set<string>();
  const caminhoPorId = new Map<string, string>();
  const usados = new Set<string>();
  const registrar = (id: string | null | undefined, pasta: string, pessoal = false): string | null => {
    if (!id) return null;
    const ja = caminhoPorId.get(id);
    if (ja) return ja;
    const a = arqPorId.get(id);
    if (!a) return null;
    const nome = slug(a.nome);
    let caminho = `${pasta}/${nome}`;
    let n = 2;
    while (usados.has(caminho.toLowerCase())) {
      const ponto = nome.lastIndexOf(".");
      caminho = ponto > 0 ? `${pasta}/${nome.slice(0, ponto)} (${n})${nome.slice(ponto)}` : `${pasta}/${nome} (${n})`;
      n++;
    }
    usados.add(caminho.toLowerCase());
    caminhoPorId.set(id, caminho);
    arquivos.push({ id, caminho, tamanho: a.tamanho_bytes });
    if (pessoal) idsPessoais.add(id);
    return caminho;
  };
  /** Referência a um arquivo no texto: nome + caminho no ZIP, ou alerta se faltou. */
  const ref = (id: string | null | undefined, pasta: string, pessoal = false) => {
    if (!id) return "⚠️ NÃO anexado";
    const c = registrar(id, pasta, pessoal);
    const a = arqPorId.get(id);
    if (!c || !a) return "⚠️ anexo apontado mas arquivo não encontrado";
    return `📎 "${a.nome}" → \`${c}\``;
  };

  // --- Segmentos (mesma regra do portal ExpedAmigo) ------------------------
  const p0 = modoPax ? pax[0] : null;
  const minhasExt = p0 ? extDoPax.get(p0.id) ?? new Set<string>() : null;
  const veSegmento = (extId: string | null, apenasSemExt: boolean) => {
    if (!minhasExt) return true; // visão da expedição: mostra tudo, marcado
    if (extId) return minhasExt.has(extId);
    if (apenasSemExt) return minhasExt.size === 0;
    return true;
  };
  const temVooProprio = p0 ? voos.some((v) => v.passageiro_id === p0.id) : false;
  const veVoo = (v: ExpedicaoVooRow) => {
    if (!p0) return true;
    if (temVooProprio) return v.passageiro_id === p0.id;
    if (v.passageiro_id) return false;
    if (v.grupo_id && p0.grupo_id !== v.grupo_id) return false;
    return veSegmento(v.extensao_id, !!v.apenas_sem_extensao);
  };
  const rotSegmento = (extId: string | null, apenasSemExt: boolean) =>
    extId ? ` [Extensão: ${extPorId.get(extId)?.nome ?? "?"}]` : apenasSemExt ? " [só p/ quem NÃO fez extensão]" : "";

  const roteiroVisivel = roteiro.filter((d) => veSegmento(d.extensao_id, !!d.apenas_sem_extensao));
  const voosVisiveis = voos.filter(veVoo);

  // --- Alertas automáticos ---------------------------------------------------
  const alertas: string[] = [];
  const emb = exp.data_embarque, ret = exp.data_retorno;
  if (!roteiroVisivel.length) alertas.push("Roteiro dia a dia está VAZIO no sistema.");
  for (const d of roteiroVisivel) {
    if (!d.data) alertas.push(`Dia ${d.dia} ("${d.titulo}") está sem data.`);
    else if (d.data < emb || d.data > ret) {
      // dia de extensão pode passar do retorno do grupo
      if (!d.extensao_id) alertas.push(`Dia ${d.dia} (${dt(d.data)}) está FORA do período da viagem (${dt(emb)} → ${dt(ret)}).`);
    }
  }
  const datas = roteiroVisivel.filter((d) => !d.extensao_id && d.data).map((d) => d.data!) ;
  const datasUnicas = [...new Set(datas)].sort();
  for (let i = 1; i < datasUnicas.length; i++) {
    const gap = differenceInCalendarDays(parseISO(datasUnicas[i]), parseISO(datasUnicas[i - 1]));
    if (gap > 1) alertas.push(`Buraco no roteiro: nenhum dia entre ${dt(datasUnicas[i - 1])} e ${dt(datasUnicas[i])}.`);
  }
  const ultimoDia = datasUnicas[datasUnicas.length - 1];
  for (const d of roteiroVisivel) {
    if (!d.hospedagem?.trim() && d.data && d.data !== ultimoDia && !d.extensao_id && !d.apenas_sem_extensao) {
      alertas.push(`Dia ${d.dia} (${dt(d.data)}) sem hospedagem informada no roteiro.`);
    }
  }
  if (exp.tipo !== "pacote" && !exp.hospedagem_voucher_arquivo_id) alertas.push("Voucher da HOSPEDAGEM (único da expedição) não anexado.");
  for (const e of extensoes) {
    if (minhasExt && !minhasExt.has(e.id)) continue;
    if (!e.hospedagem_voucher_arquivo_id) alertas.push(`Extensão "${e.nome}" sem voucher de hospedagem.`);
  }
  for (const v of voosVisiveis) if (!v.arquivo_id) alertas.push(`Voo "${v.trecho}" sem voucher/bilhete anexado.`);
  for (const ps of passeios) if (!ps.arquivo_id) alertas.push(`Passeio/ingresso "${ps.nome}" sem voucher anexado.`);
  for (const p of pax) {
    if (!p.passaporte_arquivo_id) alertas.push(`${p.nome_completo}: passaporte (foto/PDF) não anexado.`);
    if (!p.validade_passaporte) alertas.push(`${p.nome_completo}: validade do passaporte não informada.`);
    else if (parseISO(p.validade_passaporte) < addMonths(parseISO(ret), 6))
      alertas.push(`${p.nome_completo}: passaporte vence em ${dt(p.validade_passaporte)} — menos de 6 meses após o retorno.`);
    if (quartos.length && !(quartosDoPax.get(p.id)?.length)) alertas.push(`${p.nome_completo}: não está alocado em nenhum quarto do rooming.`);
    const pr = prontPorPax.get(p.id);
    if (pr && pr.resultado.prontidao !== "Apto") alertas.push(`${p.nome_completo}: prontidão "${pr.resultado.prontidao}".`);
  }

  // --- Markdown --------------------------------------------------------------
  const L: string[] = [];
  const titulo = modoPax ? `${pax[0].nome_completo} — ${exp.nome}` : exp.nome;
  L.push(`# Dossiê para conferência — ${titulo}`);
  L.push("");
  L.push(`> Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} pelo Sistema de Expedições (Se Tu For, Eu Vou).`);
  L.push(`> ${modoPax ? "Visão de UM passageiro (exatamente o que ele vê no ExpedAmigo)." : `Visão da ${exp.tipo === "pacote" ? "pacote" : "expedição"} inteira — ${pax.length} passageiro(s) ativo(s).`}`);
  L.push("");
  L.push("## 🤖 Instruções para a Claude");
  L.push("");
  L.push("Você é a conferente de operações da agência. Abaixo estão TODOS os dados cadastrados no sistema para esta viagem. Se eu anexar arquivos (vouchers, bilhetes, passaportes), eles estão referenciados pelo caminho `pasta/arquivo` ao lado de cada item. Faça um double check completo e me devolva:");
  L.push("");
  L.push("1. **Roteiro × hospedagem:** cada noite do roteiro tem hotel? As datas de check-in/check-out do rooming e dos vouchers de hospedagem batem com os dias do roteiro (cidade e data)?");
  L.push("2. **Roteiro × voos:** os voos (data, horário, origem/destino) batem com os dias de deslocamento do roteiro? A chegada permite cumprir o programa do dia?");
  L.push("3. **Roteiro × passeios/ingressos:** cada passeio/ingresso tem voucher, e a data do voucher bate com o dia do roteiro?");
  L.push("4. **Vouchers × cadastro:** nomes dos passageiros nos vouchers/bilhetes batem com o nome do passaporte? Quantidade de pessoas/quartos confere? Localizadores conferem?");
  L.push("5. **Documentos por passageiro:** passaporte válido (≥ 6 meses após o retorno), vistos/vacinas/seguro exigidos, tudo anexado?");
  L.push("6. **Extensões e opcionais:** quem contratou extensão/passeio opcional tem os dias, voos e hospedagem correspondentes?");
  L.push("");
  L.push("Responda em português, em forma de lista: **✅ OK**, **⚠️ Divergência** (diga onde e o que está diferente) e **❌ Falta** (o que não existe). Termine com um resumo do que precisa ser corrigido, por prioridade. Não invente dados: se algo não estiver no texto nem nos anexos, diga que não dá pra conferir.");
  L.push("");

  // Alertas
  L.push("## 🚨 Alertas automáticos do sistema");
  L.push("");
  L.push(alertas.length ? alertas.map((a) => `- ${a}`).join("\n") : "- Nenhum alerta automático.");
  L.push("");

  // Dados gerais
  L.push("## 1. Dados gerais");
  L.push("");
  L.push(`- **Nome:** ${exp.nome}`);
  L.push(`- **Código:** ${exp.codigo} · **Tipo:** ${exp.tipo === "pacote" ? "Pacote personalizado" : "Expedição em grupo"} · **Status:** ${exp.status}`);
  L.push(`- **Destino:** ${exp.destino}`);
  L.push(`- **Embarque:** ${dt(emb)} · **Retorno:** ${dt(ret)} (${differenceInCalendarDays(parseISO(ret), parseISO(emb)) + 1} dias)`);
  if (!modoPax) L.push(`- **Passageiros ativos:** ${paxAtivos.length} (planejados: ${exp.pax_planejados})`);
  if (grupos.length) L.push(`- **Subgrupos:** ${grupos.map((g) => `${g.nome}${g.data_embarque ? ` (${dt(g.data_embarque)} → ${dt(g.data_retorno)})` : ""}`).join(", ")}`);
  if (exp.observacoes) L.push(`- **Observações:** ${exp.observacoes}`);
  L.push("");

  // Roteiro
  L.push("## 2. Roteiro dia a dia (o que o passageiro vê no portal)");
  L.push("");
  if (!roteiroVisivel.length) L.push("_Sem roteiro cadastrado._\n");
  for (const d of roteiroVisivel) {
    const ofertas = opcionais.filter((o) => o.roteiro_dia_id === d.id);
    const comprado = p0 ? ofertas.find((o) => comprasDoPax.get(p0.id)?.has(o.id) && o.tipo !== "adicional") : null;
    L.push(`### Dia ${d.dia} — ${dt(d.data)} — ${d.titulo}${modoPax ? "" : rotSegmento(d.extensao_id, !!d.apenas_sem_extensao)}`);
    L.push(`- **Cidade:** ${txt(d.cidade)} · **Refeições:** ${txt(d.refeicoes)} · **Hospedagem:** ${txt(d.hospedagem)}`);
    if (comprado) L.push(`- **Este passageiro ADQUIRIU o opcional "${txt(comprado.titulo)}" — o dia é substituído por ele:** ${txt(comprado.descricao)}`);
    if (d.descricao?.trim()) L.push(`- **Programa:** ${d.descricao.trim().replace(/\n+/g, " ")}`);
    for (const o of ofertas) {
      const comprou = p0 ? comprasDoPax.get(p0.id)?.has(o.id) : null;
      const quem = !p0
        ? pax.filter((p) => comprasDoPax.get(p.id)?.has(o.id)).map((p) => p.nome_completo)
        : [];
      L.push(`- Passeio ${o.tipo === "adicional" ? "adicional" : "opcional"}: **${txt(o.titulo)}**${p0 ? (comprou ? " — ✅ adquirido" : " — não adquirido") : ` — adquiriram: ${quem.length ? quem.join(", ") : "ninguém"}`}`);
    }
    L.push("");
  }

  // Voos
  L.push("## 3. Voos");
  L.push("");
  if (!voosVisiveis.length) L.push("_Nenhum voo cadastrado._");
  else {
    L.push("| Trecho | Cia / Voo | Origem → Destino | Partida | Chegada | Localizador | Para quem | Obs. | Voucher |");
    L.push("|---|---|---|---|---|---|---|---|---|");
    for (const v of voosVisiveis) {
      const quem = v.passageiro_id
        ? `Individual: ${paxPorId.get(v.passageiro_id)?.nome_completo ?? "?"}`
        : [v.grupo_id ? `Grupo ${grupoPorId.get(v.grupo_id)?.nome ?? "?"}` : "Todos", rotSegmento(v.extensao_id, !!v.apenas_sem_extensao).trim()].filter(Boolean).join(" ");
      L.push(`| ${cel(v.trecho)} | ${cel([v.companhia, v.numero_voo].filter(Boolean).join(" "))} | ${cel(v.origem)} → ${cel(v.destino)} | ${dtHora(v.partida)} | ${dtHora(v.chegada)} | ${cel(v.localizador)} | ${cel(quem)} | ${cel(v.observacoes)} | ${cel(ref(v.arquivo_id, "expedicao/voos"))} |`);
    }
  }
  L.push("");

  // Passeios
  L.push("## 4. Passeios e ingressos");
  L.push("");
  if (!passeios.length) L.push("_Nenhum passeio cadastrado._");
  else {
    L.push("| Passeio | Data | Horário | Local | Observações | Voucher |");
    L.push("|---|---|---|---|---|---|");
    for (const ps of passeios)
      L.push(`| ${cel(ps.nome)} | ${dt(ps.data)} | ${cel(ps.horario)} | ${cel(ps.local)} | ${cel(ps.observacoes)} | ${cel(ref(ps.arquivo_id, "expedicao/passeios"))} |`);
  }
  L.push("");

  // Hospedagem
  L.push("## 5. Hospedagem");
  L.push("");
  L.push(`- **Voucher da hospedagem (grupo):** ${ref(exp.hospedagem_voucher_arquivo_id, "expedicao/hospedagem")}`);
  for (const e of extensoes) {
    if (minhasExt && !minhasExt.has(e.id)) continue;
    L.push(`- **Voucher da hospedagem — extensão "${e.nome}":** ${ref(e.hospedagem_voucher_arquivo_id, "expedicao/hospedagem")}`);
  }
  // Hotéis do rooming (agrupa por hotel + check-in/out)
  const hoteis = new Map<string, QuartoRow[]>();
  for (const q of quartos) {
    const k = `${q.hotel_cidade ?? "Hotel sem nome"}|${q.check_in ?? ""}|${q.check_out ?? ""}|${q.extensao_id ?? ""}`;
    if (!hoteis.has(k)) hoteis.set(k, []);
    hoteis.get(k)!.push(q);
  }
  const hoteisOrd = [...hoteis.entries()].sort((a, b) => (a[1][0].check_in ?? "").localeCompare(b[1][0].check_in ?? ""));
  if (hoteisOrd.length) {
    L.push("");
    L.push("**Hotéis no rooming:**");
    L.push("");
    L.push("| Hotel / cidade | Check-in | Check-out | Noites | Quartos | Pessoas alocadas |");
    L.push("|---|---|---|---|---|---|");
    for (const [, qs] of hoteisOrd) {
      const q = qs[0];
      if (p0 && !qs.some((x) => paxDoQuarto.get(x.id)?.includes(p0.id))) continue;
      const noites = q.check_in && q.check_out ? differenceInCalendarDays(parseISO(q.check_out), parseISO(q.check_in)) : null;
      const pessoas = qs.reduce((s, x) => s + (paxDoQuarto.get(x.id)?.length ?? 0), 0);
      const tipos = Object.entries(qs.reduce<Record<string, number>>((acc, x) => ((acc[x.tipo] = (acc[x.tipo] ?? 0) + 1), acc), {}))
        .map(([t, n]) => `${n} ${t}`).join(", ");
      L.push(`| ${cel(q.hotel_cidade)}${q.extensao_id ? ` [Extensão: ${extPorId.get(q.extensao_id)?.nome ?? "?"}]` : ""} | ${dt(q.check_in)} | ${dt(q.check_out)} | ${noites ?? "—"} | ${tipos} | ${pessoas} |`);
    }
  } else {
    L.push("- _Rooming sem quartos cadastrados._");
  }
  // Hospedagem citada no roteiro (pra comparar com o rooming)
  const hospRoteiro = roteiroVisivel.filter((d) => d.hospedagem?.trim());
  if (hospRoteiro.length) {
    L.push("");
    L.push("**Hospedagem por noite segundo o roteiro:** " + hospRoteiro.map((d) => `${d.data ? format(parseISO(d.data), "dd/MM") : `Dia ${d.dia}`}: ${d.hospedagem!.trim()}`).join(" · "));
  }
  L.push("");

  // Extensões
  if (extensoes.length) {
    L.push("## 6. Extensões");
    L.push("");
    for (const e of extensoes) {
      if (minhasExt && !minhasExt.has(e.id)) continue;
      const quem = pax.filter((p) => extDoPax.get(p.id)?.has(e.id)).map((p) => p.nome_completo);
      L.push(`- **${e.nome}**${e.descricao ? ` — ${e.descricao.replace(/\n+/g, " ")}` : ""}${modoPax ? "" : ` · contrataram (${quem.length}): ${quem.join(", ") || "ninguém"}`}`);
    }
    if (minhasExt && minhasExt.size === 0) L.push("- Este passageiro NÃO contratou extensão.");
    L.push("");
  }

  // Informações do destino com anexos
  const infoComArq = info.filter((i) => i.arquivo_id || i.arquivo_id_2);
  if (info.length) {
    L.push("## 7. Informações do destino (portal)");
    L.push("");
    for (const i of info) {
      L.push(`- **${i.titulo}:** ${txt(i.conteudo).replace(/\n+/g, " ").slice(0, 600)}`);
      if (i.arquivo_id) L.push(`  - ${i.arquivo_label || "Anexo"}: ${ref(i.arquivo_id, "expedicao/informacoes")}`);
      if (i.arquivo_id_2) L.push(`  - ${i.arquivo_label_2 || "Anexo 2"}: ${ref(i.arquivo_id_2, "expedicao/informacoes")}`);
    }
    void infoComArq;
    L.push("");
  }

  // Roteiro do líder (visão da expedição apenas)
  if (!modoPax && roteiroLider.length) {
    L.push("## 8. Roteiro do Líder (operacional)");
    L.push("");
    for (const d of roteiroLider) {
      L.push(`### Dia ${d.dia} — ${dt(d.data)}${d.local ? ` — ${d.local}` : ""}${d.fase ? ` (${d.fase})` : ""}`);
      if (d.programacao?.trim()) L.push(`- **Programação:** ${d.programacao.trim().replace(/\n+/g, " · ")}`);
      if (d.lideres_ativos) L.push(`- **Líderes:** ${d.lideres_ativos} · **Pax:** ${txt(d.pax)}`);
      if (d.alerta_nivel) L.push(`- **Alerta ${d.alerta_nivel}:** ${txt(d.alerta_texto)} → ${txt(d.alerta_acao)} (${txt(d.alerta_responsavel)})`);
      if (d.observacoes?.trim()) L.push(`- **Obs.:** ${d.observacoes.trim().replace(/\n+/g, " ")}`);
      for (const aid of d.arquivo_ids ?? []) L.push(`- Voucher/doc do dia: ${ref(aid, "expedicao/lider")}`);
    }
    L.push("");
  }

  // Passageiros
  L.push(`## ${modoPax ? "9. Passageiro" : `9. Passageiros (${pax.length})`}`);
  L.push("");
  const opcPorId = new Map(opcionais.map((o) => [o.id, o]));
  for (const p of [...pax].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"))) {
    const pasta = `passageiros/${slug(p.nome_completo)}`;
    L.push(`### ${p.nome_completo}`);
    L.push(`- **Tipo:** ${p.tipo} · **Reserva:** ${p.status_reserva}${p.grupo_id ? ` · **Grupo:** ${grupoPorId.get(p.grupo_id)?.nome ?? "?"}` : ""}`);
    L.push(`- **Passaporte:** nº ${txt(p.passaporte)} · validade ${dt(p.validade_passaporte)} · **Nascimento:** ${dt(p.data_nascimento)}`);
    L.push(`- **Anexo do passaporte:** ${ref(p.passaporte_arquivo_id, `${pasta}/passaporte`, true)}`);
    if (p.companhia_aerea || p.localizador) L.push(`- **Aéreo (reserva):** ${txt(p.companhia_aerea)} · localizador ${txt(p.localizador)}`);
    if (p.voo_nacional_necessario) L.push("- **Precisa de voo nacional de conexão.**");
    const restr = [p.restricoes_alimentares, p.saude?.restricao_alimentar === "Sim" ? p.saude?.restricao_alimentar_qual : null, p.saude?.alergia_alimentar === "Sim" ? `alergia: ${p.saude?.alergia_alimentar_qual ?? ""}` : null].filter((x) => x && String(x).trim());
    if (restr.length) L.push(`- **Restrições alimentares:** ${restr.join(" · ")}`);
    if (p.saude?.limitacao_fisica === "Sim") L.push(`- **Limitação física:** ${txt(p.saude.limitacao_fisica_qual)}`);
    const ex = [...(extDoPax.get(p.id) ?? [])].map((id) => extPorId.get(id)?.nome ?? "?");
    if (extensoes.length) L.push(`- **Extensões contratadas:** ${ex.length ? ex.join(", ") : "nenhuma"}`);
    const op = [...(comprasDoPax.get(p.id) ?? [])].map((id) => opcPorId.get(id)?.titulo ?? "?");
    if (opcionais.length) L.push(`- **Passeios opcionais adquiridos:** ${op.length ? op.join(", ") : "nenhum"}`);
    const qs = (quartosDoPax.get(p.id) ?? []).sort((a, b) => (a.check_in ?? "").localeCompare(b.check_in ?? ""));
    if (qs.length) {
      L.push("- **Quartos:**");
      for (const q of qs) {
        const comQuem = (paxDoQuarto.get(q.id) ?? []).filter((id) => id !== p.id).map((id) => paxPorId.get(id)?.nome_completo ?? "?");
        L.push(`  - ${txt(q.hotel_cidade)} · quarto ${q.numero} (${q.tipo}) · ${dt(q.check_in)} → ${dt(q.check_out)}${comQuem.length ? ` · divide com: ${comQuem.join(", ")}` : " · sozinho"}`);
      }
    } else if (quartos.length) {
      L.push("- **Quartos:** ⚠️ não alocado no rooming");
    }
    if (p.acompanhante_nome) L.push(`- **Acompanhante declarado:** ${p.acompanhante_nome}${p.acompanhante_divide_quarto ? ` (divide quarto: ${p.acompanhante_divide_quarto})` : ""}`);
    const vooProprio = voos.filter((v) => v.passageiro_id === p.id);
    if (vooProprio.length && !modoPax) L.push(`- **Voos individuais:** ${vooProprio.map((v) => `${v.trecho} (${dtHora(v.partida)})`).join(" · ")}`);

    const pr = prontPorPax.get(p.id);
    if (pr) {
      L.push(`- **Prontidão para embarque:** ${pr.resultado.prontidao}`);
      for (const c of pr.resultado.checagens) {
        const inst = pr.requisitos.find((r) => r.id === c.requisito_id || r.tipo === c.tipo);
        const anexo = inst?.arquivo_id ? ` · ${ref(inst.arquivo_id, `${pasta}/requisitos`, c.tipo === "Vacina")}` : "";
        L.push(`  - ${c.descricao} (${c.obrigatoriedade}${c.bloqueia_embarque ? ", bloqueia" : ""}): **${SEMAFORO_TXT[c.semaforo] ?? c.semaforo}** — ${c.detalhe}${inst?.validade ? ` · validade ${dt(inst.validade)}` : ""}${anexo}`);
      }
    }
    // Documentos no Drive do passageiro (todas as categorias)
    const docs = [...arqPorId.values()]
      .filter((a) => a.passageiro_id === p.id && !fotosIds.has(a.id) && a.id !== p.foto_arquivo_id)
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
    if (docs.length) {
      L.push("- **Documentos anexados:**");
      for (const a of docs) {
        const pessoal = a.categoria === "Documentos pessoais";
        const c = registrar(a.id, `${pasta}/${pastaCategoria(a.categoria)}`, pessoal);
        const exib = a.categoria === "Vouchers" && a.descricao?.trim() ? ` (no portal: "${a.descricao.trim()}")` : "";
        L.push(`  - [${a.categoria}] "${a.nome}"${exib} → \`${c}\``);
      }
    } else {
      L.push("- **Documentos anexados:** nenhum");
    }
    if (p.observacoes?.trim()) L.push(`- **Observações:** ${p.observacoes.trim().replace(/\n+/g, " ")}`);
    L.push("");
  }

  // Arquivos soltos da expedição (nível grupo, sem passageiro)
  if (!modoPax) {
    const soltos = arquivosExp.filter(
      (a) => a.passageiro_id == null && !fotosIds.has(a.id) && !caminhoPorId.has(a.id) &&
        a.descricao !== MARCADOR_DOC_LIDER,
    );
    if (soltos.length) {
      L.push("## 10. Outros arquivos da expedição (nível grupo)");
      L.push("");
      for (const a of soltos) {
        const c = registrar(a.id, `expedicao/${pastaCategoria(a.categoria)}`);
        L.push(`- [${a.categoria}] "${a.nome}" → \`${c}\``);
      }
      L.push("");
    }
    const docsLider = arquivosExp.filter((a) => a.passageiro_id == null && a.descricao === MARCADOR_DOC_LIDER);
    if (docsLider.length) {
      L.push("**Documentos da Área do Líder:** " + docsLider.map((a) => `"${a.nome}" → \`${registrar(a.id, "expedicao/lider")}\``).join(" · "));
      L.push("");
    }
  }

  L.push("---");
  L.push(`_${arquivos.length} arquivo(s) referenciado(s). No ZIP, este texto é o arquivo \`00-LEIA-PRIMEIRO-dossie.md\`._`);

  const nomeBase = slug(`conferencia ${exp.codigo}${modoPax ? ` ${pax[0].nome_completo}` : ""}`).replace(/ /g, "-");
  return { nomeBase, markdown: L.join("\n"), arquivos, idsPessoais: [...idsPessoais] };
}

/** Só pra tipar quem consome sem importar o módulo server-only. */
export type { ExpedicaoRow, PassageiroRow, RoteiroDiaRow };
