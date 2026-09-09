"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  mockPassageiros, mockExpedicoes, mockLinksExpedicao, mockQuartos, mockAlocacoes,
  mockRoteiroDias, mockExpedicaoVoos, mockExpedicaoPasseios, mockExpedicaoInfo,
  mockRoteiroDiaFotos, mockExpedicaoAvisos, mockExpedamigoAcessos,
  mockPasseiosOpcionais, mockPasseioOpcionalCompras, mockExtensoes, mockPassageiroExtensao,
} from "@/lib/mock-data";
import { fetchAllRows } from "@/lib/data/expedicoes";
import { ordenarVoosCronologico } from "@/lib/portal-voos";
import { listArquivosMock } from "@/lib/data/arquivos-mock";
import { soDigitosCpf } from "@/lib/cpf";
import { hashSenhaAcesso, senhaNovaValida } from "@/lib/acesso-senha";
import { assinarTokenInscricao } from "@/lib/inscricao/token";
import type {
  PassageiroRow, ExpedicaoRow, LinkExpedicaoRow, QuartoRow, AlocacaoQuartoRow,
  RoteiroDiaRow, ExpedicaoVooRow, ExpedicaoPasseioRow, ExpedicaoInfoRow,
  RoteiroDiaFotoRow, ExpedicaoAvisoRow, PasseioOpcionalRow, PasseioOpcionalCompraRow,
  ExtensaoRow, PassageiroExtensaoRow,
} from "@/types/database";

/** Arquivo de ingresso (Bilhetes) do passageiro — só os campos que o portal usa. */
type IngressoArq = { id: string; nome: string; passageiro_id: string | null; descricao: string | null };

const BUCKET = "arquivos-expedicoes";

/**
 * Portal do ExpedAmigo (passageiro). Acesso público por CPF + data de
 * nascimento, só leitura. Mostra APENAS expedições futuras da pessoa, com a
 * cara de um produto do viajante (sem nada do sistema operacional interno).
 */

export type AmigoVoo = {
  voo_interno_necessario: boolean;
  companhia: string | null;
  localizador: string | null;
};
export type AmigoLink = { label: string; url: string };
export type AmigoQuarto = {
  numero: string;
  tipo: string;
  hotel_cidade: string | null;
  check_in: string | null;
  check_out: string | null;
};
export type AmigoFoto = { url: string; legenda: string | null };
/** Passeio opcional oferecido num dia livre (migration 0044). */
export type AmigoPasseioOpcional = {
  titulo: string | null;
  descricao: string | null;
  foto_url: string | null;
  whatsapp_url: string | null;
  /** 'opcional' substitui o dia inteiro (com WhatsApp); 'adicional' só marca "adquirido". */
  tipo: string;
  /** Este passageiro já comprou? (marcado manualmente pelo operacional) */
  comprou: boolean;
};
export type AmigoRoteiroDia = {
  id: string;
  dia: number;
  data: string | null;
  titulo: string;
  descricao: string | null;
  cidade: string | null;
  refeicoes: string | null;
  hospedagem: string | null;
  fotos: AmigoFoto[];
  passeios_opcionais: AmigoPasseioOpcional[];
};
export type AmigoAviso = { tipo: string; titulo: string; conteudo: string };
export type AmigoVooGrupo = {
  trecho: string;
  companhia: string | null;
  numero_voo: string | null;
  origem: string | null;
  destino: string | null;
  partida: string | null;
  chegada: string | null;
  localizador: string | null;
  observacoes: string | null;
  voucher_url: string | null;
};
export type AmigoPasseio = {
  nome: string;
  data: string | null;
  horario: string | null;
  local: string | null;
  incluso: boolean;
  observacoes: string | null;
  voucher_url: string | null;
};
export type AmigoInfoPdf = { url: string; label: string };
export type AmigoInfo = { titulo: string; conteudo: string; pdfs: AmigoInfoPdf[] };
export type AmigoIngresso = { nome: string; url: string };
/** Extensão que ESTE passageiro contratou (dias/voos extras). Migration 0052. */
export type AmigoExtensao = { nome: string; descricao: string | null; hospedagem_voucher_url: string | null };

export type AmigoExpedicao = {
  id: string;
  nome: string;
  destino: string;
  data_embarque: string;
  data_retorno: string;
  status: string;
  voo: AmigoVoo;
  links: AmigoLink[];
  quartos: AmigoQuarto[];
  /** Voucher único da hospedagem (mesmo hotel p/ todos) — migration 0030. */
  hospedagem_voucher_url: string | null;
  roteiro: AmigoRoteiroDia[];
  voos_grupo: AmigoVooGrupo[];
  passeios: AmigoPasseio[];
  info: AmigoInfo[];
  avisos: AmigoAviso[];
  /** Ingressos do próprio passageiro (só os dele) — Peru. */
  ingressos_mp: AmigoIngresso[];
  ingressos_trem: AmigoIngresso[];
  /** Seguro viagem do próprio passageiro (só os dele) — todas as expedições. */
  seguros: AmigoIngresso[];
  /** Vouchers de voo do próprio passageiro (categoria "Vouchers" por pax). */
  vouchers_voo: AmigoIngresso[];
  /** Cartão de embarque do próprio passageiro (categoria "Cartão de embarque"). */
  cartoes_embarque: AmigoIngresso[];
  /** Extensões contratadas por este passageiro — selo/nota no topo (migration 0052). */
  extensoes_contratadas: AmigoExtensao[];
  /** true = passageiro ainda não preencheu o formulário de inscrição (sem perfil_viajante). */
  inscricao_incompleta: boolean;
};
export type AmigoDados = {
  nome: string;
  primeiro_nome: string;
  expedicoes: AmigoExpedicao[];
};

/**
 * CPFs com acesso ADMIN no ExpedAmigo: ao logar, veem TODAS as expedições
 * futuras (conteúdo do portal), não só as próprias. A senha fica em `acesso_senhas`
 * como qualquer pessoa (o admin não precisa ser passageiro/ter nascimento).
 * Chave = 11 dígitos do CPF.
 */
const ADMINS_AMIGO: Record<string, string> = {
  "20262027999": "Administrador",
  "79746748220": "Carolina Lage Taketomi",
  "40718963881": "Antonio Carlos Feitosa Beserra dos Santos",
  "01997549344": "Luis Antonio de Negreiros Caetano",
  "47146666816": "Beatriz Rodrigues Galvão",
};

export async function entrarExpedAmigo(
  cpfRaw: string,
  senhaRaw: string,
  registrarLogin: boolean = true,
): Promise<{ ok: true; dados: AmigoDados; precisaTrocar: boolean } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  const senha = senhaRaw ?? "";
  if (cpf.length !== 11) return { ok: false, error: "Digite um CPF válido (11 dígitos)." };
  if (!senha.trim()) return { ok: false, error: "Informe sua senha." };

  let pax: PassageiroRow[];
  let exps: ExpedicaoRow[];
  // Conteúdo (roteiro/voos/…) — em PROD carrega só das expedições da pessoa (Fase 2, abaixo).
  let links: LinkExpedicaoRow[] = [];
  let quartos: QuartoRow[] = [];
  let alocacoes: AlocacaoQuartoRow[] = [];
  let roteiro: RoteiroDiaRow[] = [];
  let voosGrupo: ExpedicaoVooRow[] = [];
  let passeios: ExpedicaoPasseioRow[] = [];
  let infos: ExpedicaoInfoRow[] = [];
  let avisosAll: ExpedicaoAvisoRow[] = [];
  let rtFotos: RoteiroDiaFotoRow[] = [];
  let passeiosOpc: PasseioOpcionalRow[] = [];
  let comprasOpc: PasseioOpcionalCompraRow[] = [];
  let extensoesAll: ExtensaoRow[] = [];
  let contratacoes: PassageiroExtensaoRow[] = [];

  const sb = DEV_USE_MOCK_DATA ? null : createServiceRoleClient();

  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros;
    exps = mockExpedicoes;
    links = mockLinksExpedicao;
    quartos = mockQuartos;
    alocacoes = mockAlocacoes;
    roteiro = mockRoteiroDias;
    voosGrupo = mockExpedicaoVoos;
    passeios = mockExpedicaoPasseios;
    infos = mockExpedicaoInfo;
    avisosAll = mockExpedicaoAvisos;
    rtFotos = mockRoteiroDiaFotos;
    passeiosOpc = mockPasseiosOpcionais;
    comprasOpc = mockPasseioOpcionalCompras;
    extensoesAll = mockExtensoes;
    contratacoes = mockPassageiroExtensao;
  } else {
    const cli = sb!;
    // Fase 1: só o essencial pra identificar a pessoa e descobrir as expedições dela.
    // O conteúdo (roteiro/voos/fotos/…) é carregado depois, SÓ dessas expedições (Fase 2).
    const [paxAll, er] = await Promise.all([
      fetchAllRows<PassageiroRow>((from, to) => cli.from("passageiros").select("*").order("id").range(from, to)),
      cli.from("expedicoes").select("*"),
    ]);
    pax = paxAll;
    exps = (er.data ?? []) as ExpedicaoRow[];
  }

  // 1) Acha as linhas da pessoa pelo CPF. Admin não precisa ser passageiro.
  //
  // Linha com `pendente_aprovacao` NÃO conta: veio do formulário público e ainda
  // não passou pela equipe, então não é passageiro. Isso também é o que impede um
  // sequestro de portal — a inscrição pública consegue gravar a data de nascimento
  // num cadastro que não tinha nenhuma, e essa data é a senha do 1º acesso. Como
  // toda inscrição entra pendente, o dado só vira credencial depois que alguém da
  // agência aprova (`aprovarInscricao`).
  const minhasRows = pax.filter(
    (p) => soDigitosCpf(p.cpf ?? "") === cpf && !p.pendente_aprovacao,
  );
  const ehAdmin = ADMINS_AMIGO[cpf] !== undefined;
  if (!ehAdmin && minhasRows.length === 0) {
    return { ok: false, error: "Não encontramos seu cadastro com este CPF. Fale com a agência." };
  }

  // 2) Senha por pessoa (migration 0031/0040). 1º acesso: senha ALEATÓRIA provisória
  //    gerada quando o operacional libera o ExpedAmigo (não é mais a data de nascimento).
  const ordenadas = [...minhasRows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  let precisaTrocar = false;
  {
    let hashSalvo: string | null = null;
    let provisoria: string | null = null;
    if (sb) {
      const { data } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", cpf).maybeSingle();
      hashSalvo = (data as { senha_hash: string | null } | null)?.senha_hash ?? null;
      provisoria = (data as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null;
    }
    if (hashSalvo) {
      if ((await hashSenhaAcesso(cpf, senha)) !== hashSalvo) {
        return { ok: false, error: "Senha incorreta." };
      }
    } else if (provisoria) {
      // Ainda com a senha provisória (não trocou): confere e força criar uma nova.
      if (senha !== provisoria) return { ok: false, error: "Senha incorreta." };
      precisaTrocar = true;
    } else if (ehAdmin) {
      // Admin master: em mock aceita pra teste; em prod exige senha configurada.
      if (!DEV_USE_MOCK_DATA) {
        return { ok: false, error: "Acesso admin ainda não configurado." };
      }
    } else {
      return { ok: false, error: "Seu acesso ainda não foi liberado. Fale com a agência." };
    }
  }

  const nome = ehAdmin ? ADMINS_AMIGO[cpf] : (ordenadas[0]?.nome_completo ?? "Viajante");

  // 3) Passageiro vê só as expedições LIBERADAS pelo operacional (`liberado_expedamigo`),
  //    inclusive as antigas. Admin master continua vendo as futuras não-canceladas.
  const hoje = new Date().toISOString().slice(0, 10);
  const expById = new Map(exps.map((e) => [e.id, e]));

  const cancelada = (e: ExpedicaoRow | undefined): boolean => !e || e.status === "Cancelada";

  // Linha da PRÓPRIA pessoa por expedição (a mais recente). Vale também pra Líder/Master:
  // quando ela é passageira de uma expedição, é a linha DELA que traz ingressos, vouchers,
  // rooming e localizador — senão esses dados pessoais não apareceriam.
  const minhaRowPorExp = new Map<string, PassageiroRow>();
  for (const r of minhasRows) {
    if (!r.expedicao_id || r.status_reserva === "Cancelado") continue;
    const ex = minhaRowPorExp.get(r.expedicao_id);
    if (!ex || r.created_at > ex.created_at) minhaRowPorExp.set(r.expedicao_id, r);
  }

  const unidadesMap = new Map<string, { exp: ExpedicaoRow; row: PassageiroRow | null }>();
  // Passageiro (inclusive Líder/Master): as expedições DELE que estão liberadas — passado ou futuro.
  for (const [expId, row] of minhaRowPorExp) {
    if (row.liberado_expedamigo !== true) continue;
    const e = expById.get(expId);
    if (e && !cancelada(e)) unidadesMap.set(expId, { exp: e, row });
  }
  // Admin master: também enxerga TODAS as futuras não-canceladas (com a linha dele, se for passageiro).
  if (ehAdmin) {
    for (const e of exps) {
      if (cancelada(e) || (e.data_embarque ?? "").slice(0, 10) < hoje) continue;
      if (!unidadesMap.has(e.id)) unidadesMap.set(e.id, { exp: e, row: minhaRowPorExp.get(e.id) ?? null });
    }
  }
  const unidades = [...unidadesMap.values()];
  const expIdsFuturas = new Set<string>(unidades.map((u) => u.exp.id));

  // Ingressos (categoria "Bilhetes") das linhas da PRÓPRIA pessoa — só os dela.
  const meusIds = minhasRows.map((r) => r.id);

  // Fase 2 (PROD): carrega o CONTEÚDO só das expedições que a pessoa vê (expIdsFuturas)
  // e os dados pessoais só das linhas dela (meusIds) — em vez de baixar a base inteira de
  // TODAS as expedições no login. O resto do código já filtra por expedicao_id, então o
  // resultado é idêntico; só carrega muito menos.
  if (!DEV_USE_MOCK_DATA && sb) {
    const cli = sb;
    const expIds = [...expIdsFuturas];
    const naExp = expIds.length > 0;
    const noPax = meusIds.length > 0;
    const [linkAll, qAll, alocAll, rtAll, voAll, psAll, inAll, avAll, ftAll, poAll, pocAll, extAll, ctAll] = await Promise.all([
      naExp ? fetchAllRows<LinkExpedicaoRow>((f, t) => cli.from("links_expedicao").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<LinkExpedicaoRow[]>([]),
      naExp ? fetchAllRows<QuartoRow>((f, t) => cli.from("quartos").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<QuartoRow[]>([]),
      noPax ? fetchAllRows<AlocacaoQuartoRow>((f, t) => cli.from("passageiro_quarto").select("*").in("passageiro_id", meusIds).order("id").range(f, t)) : Promise.resolve<AlocacaoQuartoRow[]>([]),
      naExp ? fetchAllRows<RoteiroDiaRow>((f, t) => cli.from("roteiro_dias").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<RoteiroDiaRow[]>([]),
      naExp ? fetchAllRows<ExpedicaoVooRow>((f, t) => cli.from("expedicao_voos").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<ExpedicaoVooRow[]>([]),
      naExp ? fetchAllRows<ExpedicaoPasseioRow>((f, t) => cli.from("expedicao_passeios").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<ExpedicaoPasseioRow[]>([]),
      naExp ? fetchAllRows<ExpedicaoInfoRow>((f, t) => cli.from("expedicao_info").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<ExpedicaoInfoRow[]>([]),
      naExp ? fetchAllRows<ExpedicaoAvisoRow>((f, t) => cli.from("expedicao_avisos").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<ExpedicaoAvisoRow[]>([]),
      naExp ? fetchAllRows<RoteiroDiaFotoRow>((f, t) => cli.from("roteiro_dia_fotos").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<RoteiroDiaFotoRow[]>([]),
      naExp ? fetchAllRows<PasseioOpcionalRow>((f, t) => cli.from("passeios_opcionais").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<PasseioOpcionalRow[]>([]),
      noPax ? fetchAllRows<PasseioOpcionalCompraRow>((f, t) => cli.from("passeio_opcional_compras").select("*").in("passageiro_id", meusIds).order("id").range(f, t)) : Promise.resolve<PasseioOpcionalCompraRow[]>([]),
      naExp ? fetchAllRows<ExtensaoRow>((f, t) => cli.from("extensoes").select("*").in("expedicao_id", expIds).order("id").range(f, t)) : Promise.resolve<ExtensaoRow[]>([]),
      noPax ? fetchAllRows<PassageiroExtensaoRow>((f, t) => cli.from("passageiro_extensao").select("*").in("passageiro_id", meusIds).order("id").range(f, t)) : Promise.resolve<PassageiroExtensaoRow[]>([]),
    ]);
    links = linkAll; quartos = qAll; alocacoes = alocAll; roteiro = rtAll; voosGrupo = voAll;
    passeios = psAll; infos = inAll; avisosAll = avAll; rtFotos = ftAll; passeiosOpc = poAll;
    comprasOpc = pocAll; extensoesAll = extAll; contratacoes = ctAll;
  }
  const quartoById = new Map(quartos.map((q) => [q.id, q]));

  let ingressoArqs: IngressoArq[] = [];
  if (DEV_USE_MOCK_DATA) {
    ingressoArqs = (await listArquivosMock())
      .filter((a) => a.categoria === "Bilhetes" && a.passageiro_id && meusIds.includes(a.passageiro_id))
      .map((a) => ({ id: a.id, nome: a.nome, passageiro_id: a.passageiro_id, descricao: a.descricao }));
  } else if (sb && meusIds.length > 0) {
    const { data } = await sb
      .from("arquivos")
      .select("id,nome,passageiro_id,descricao")
      .eq("categoria", "Bilhetes")
      .in("passageiro_id", meusIds);
    ingressoArqs = (data ?? []) as IngressoArq[];
  }

  // Seguro viagem (categoria "Seguros") das linhas da PRÓPRIA pessoa — pra todos.
  let seguroArqs: IngressoArq[] = [];
  if (DEV_USE_MOCK_DATA) {
    seguroArqs = (await listArquivosMock())
      .filter((a) => a.categoria === "Seguros" && a.passageiro_id && meusIds.includes(a.passageiro_id))
      .map((a) => ({ id: a.id, nome: a.nome, passageiro_id: a.passageiro_id, descricao: a.descricao }));
  } else if (sb && meusIds.length > 0) {
    const { data } = await sb
      .from("arquivos")
      .select("id,nome,passageiro_id,descricao")
      .eq("categoria", "Seguros")
      .in("passageiro_id", meusIds);
    seguroArqs = (data ?? []) as IngressoArq[];
  }

  // Cartão de embarque do PRÓPRIO passageiro (categoria "Cartão de embarque") — pra todos.
  let cartaoArqs: IngressoArq[] = [];
  if (DEV_USE_MOCK_DATA) {
    cartaoArqs = (await listArquivosMock())
      .filter((a) => a.categoria === "Cartão de embarque" && a.passageiro_id && meusIds.includes(a.passageiro_id))
      .map((a) => ({ id: a.id, nome: a.nome, passageiro_id: a.passageiro_id, descricao: a.descricao }));
  } else if (sb && meusIds.length > 0) {
    const { data } = await sb
      .from("arquivos")
      .select("id,nome,passageiro_id,descricao")
      .eq("categoria", "Cartão de embarque")
      .in("passageiro_id", meusIds);
    cartaoArqs = (data ?? []) as IngressoArq[];
  }

  // Vouchers de voo do PRÓPRIO passageiro (categoria "Vouchers" com passageiro_id) — pra todos.
  let vvoucherArqs: IngressoArq[] = [];
  if (DEV_USE_MOCK_DATA) {
    vvoucherArqs = (await listArquivosMock())
      .filter((a) => a.categoria === "Vouchers" && a.passageiro_id && meusIds.includes(a.passageiro_id))
      .map((a) => ({ id: a.id, nome: a.nome, passageiro_id: a.passageiro_id, descricao: a.descricao }));
  } else if (sb && meusIds.length > 0) {
    const { data } = await sb
      .from("arquivos")
      .select("id,nome,passageiro_id,descricao")
      .eq("categoria", "Vouchers")
      .in("passageiro_id", meusIds);
    vvoucherArqs = (data ?? []) as IngressoArq[];
  }

  // Resolve as URLs dos arquivos (fotos do roteiro + vouchers de voo/passeio + ingressos)
  // das expedições futuras da pessoa: signed URL (prod) ou rota de download do mock (dev).
  const fotoUrl = new Map<string, string>(); // arquivo_id -> url
  {
    const idsRelevantes = new Set<string>();
    for (const f of rtFotos) if (expIdsFuturas.has(f.expedicao_id)) idsRelevantes.add(f.arquivo_id);
    for (const v of voosGrupo) if (v.arquivo_id && expIdsFuturas.has(v.expedicao_id)) idsRelevantes.add(v.arquivo_id);
    for (const p of passeios) if (p.arquivo_id && expIdsFuturas.has(p.expedicao_id)) idsRelevantes.add(p.arquivo_id);
    for (const i of infos) {
      if (i.arquivo_id && expIdsFuturas.has(i.expedicao_id)) idsRelevantes.add(i.arquivo_id);
      if (i.arquivo_id_2 && expIdsFuturas.has(i.expedicao_id)) idsRelevantes.add(i.arquivo_id_2);
    }
    for (const e of exps) if (e.hospedagem_voucher_arquivo_id && expIdsFuturas.has(e.id)) idsRelevantes.add(e.hospedagem_voucher_arquivo_id);
    for (const x of extensoesAll) if (x.hospedagem_voucher_arquivo_id && expIdsFuturas.has(x.expedicao_id)) idsRelevantes.add(x.hospedagem_voucher_arquivo_id);
    for (const p of passeiosOpc) if (p.foto_arquivo_id && expIdsFuturas.has(p.expedicao_id)) idsRelevantes.add(p.foto_arquivo_id);
    for (const a of ingressoArqs) idsRelevantes.add(a.id);
    for (const a of seguroArqs) idsRelevantes.add(a.id);
    for (const a of vvoucherArqs) idsRelevantes.add(a.id);
    for (const a of cartaoArqs) idsRelevantes.add(a.id);

    if (DEV_USE_MOCK_DATA) {
      for (const id of idsRelevantes) fotoUrl.set(id, `/api/arquivos/${id}/download?inline=1`);
    } else if (sb && idsRelevantes.size > 0) {
      const ids = [...idsRelevantes];
      const { data: arqs } = await sb.from("arquivos").select("id,storage_path").in("id", ids);
      const arqRows = (arqs ?? []) as { id: string; storage_path: string }[];
      const idByPath = new Map(arqRows.map((a) => [a.storage_path, a.id]));
      const paths = arqRows.map((a) => a.storage_path);
      // URLs assinadas em LOTE e em PARALELO (antes: 1 await por arquivo, sequencial —
      // deixava o login do master lento, pois ele vê as fotos de TODAS as futuras). 7 dias.
      const LOTE = 100;
      const lotes: string[][] = [];
      for (let i = 0; i < paths.length; i += LOTE) lotes.push(paths.slice(i, i + LOTE));
      const resultados = await Promise.all(
        lotes.map((lote) => sb.storage.from(BUCKET).createSignedUrls(lote, 604800)),
      );
      for (const res of resultados) {
        for (const it of res.data ?? []) {
          if (it.signedUrl && it.path) {
            const id = idByPath.get(it.path);
            if (id) fotoUrl.set(id, it.signedUrl);
          }
        }
      }
    }
  }

  const expedicoes: AmigoExpedicao[] = [];
  for (const { exp: e, row } of unidades) {
    // Passeios opcionais comprados por ESTE passageiro (row null = admin → nada comprado).
    const meusComprados = new Set(
      row ? comprasOpc.filter((c) => c.passageiro_id === row.id).map((c) => c.passeio_opcional_id) : [],
    );
    // Extensões contratadas por ESTE passageiro. Dia/voo de extensão só aparece pra quem
    // contratou; `extensao_id` nulo = grupo principal. `apenas_sem_extensao` = só quem NÃO
    // estende (ex.: último dia/volta do grupo base, que muda pra quem fica). Migrations 0052/0053.
    const minhasExtensoes = new Set(
      row ? contratacoes.filter((c) => c.passageiro_id === row.id).map((c) => c.extensao_id) : [],
    );
    const semExtensao = minhasExtensoes.size === 0;
    const veSegmento = (extId: string | null, apenasSemExt: boolean | null | undefined): boolean =>
      extId != null ? minhasExtensoes.has(extId) : apenasSemExt ? semExtensao : true;
    // Voo por subgrupo (G1/G2): null = todos veem; senão só quem é do grupo (admin/row null vê tudo). Migration 0055.
    const veGrupo = (grupoId: string | null | undefined): boolean =>
      grupoId == null || !row || row.grupo_id === grupoId;
    const meusQuartos = row
      ? alocacoes
          .filter((a) => a.passageiro_id === row.id)
          .map((a) => quartoById.get(a.quarto_id))
          .filter((q): q is QuartoRow => !!q)
          .map<AmigoQuarto>((q) => ({
            numero: q.numero,
            tipo: q.tipo,
            hotel_cidade: q.hotel_cidade,
            check_in: q.check_in,
            check_out: q.check_out,
          }))
      : [];

    expedicoes.push({
      id: e.id,
      nome: e.nome,
      destino: e.destino,
      data_embarque: e.data_embarque,
      data_retorno: e.data_retorno,
      status: e.status,
      voo: {
        voo_interno_necessario: row?.voo_nacional_necessario ?? false,
        companhia: row?.companhia_aerea ?? null,
        localizador: row?.localizador ?? null,
      },
      links: links
        .filter((l) => l.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((l) => ({ label: l.label, url: l.url })),
      quartos: meusQuartos,
      hospedagem_voucher_url: e.hospedagem_voucher_arquivo_id ? fotoUrl.get(e.hospedagem_voucher_arquivo_id) ?? null : null,
      roteiro: roteiro
        .filter((r) => r.expedicao_id === e.id && veSegmento(r.extensao_id, r.apenas_sem_extensao))
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((r) => ({
          id: r.id, dia: r.dia, data: r.data, titulo: r.titulo, descricao: r.descricao,
          cidade: r.cidade, refeicoes: r.refeicoes, hospedagem: r.hospedagem,
          fotos: rtFotos
            .filter((f) => f.roteiro_dia_id === r.id)
            .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
            .map((f) => ({ url: fotoUrl.get(f.arquivo_id) ?? "", legenda: f.legenda }))
            .filter((x) => x.url),
          passeios_opcionais: passeiosOpc
            .filter((p) => p.roteiro_dia_id === r.id)
            .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
            .map((p) => ({
              titulo: p.titulo,
              descricao: p.descricao,
              foto_url: p.foto_arquivo_id ? fotoUrl.get(p.foto_arquivo_id) ?? null : null,
              whatsapp_url: p.whatsapp_url,
              tipo: p.tipo ?? "opcional",
              comprou: meusComprados.has(p.id),
            })),
        })),
      voos_grupo: ordenarVoosCronologico(
        voosGrupo.filter((v) => v.expedicao_id === e.id && veSegmento(v.extensao_id, v.apenas_sem_extensao) && veGrupo(v.grupo_id)),
      )
        .map((v) => ({
          trecho: v.trecho, companhia: v.companhia, numero_voo: v.numero_voo,
          origem: v.origem, destino: v.destino, partida: v.partida, chegada: v.chegada,
          localizador: v.localizador, observacoes: v.observacoes,
          voucher_url: v.arquivo_id ? fotoUrl.get(v.arquivo_id) ?? null : null,
        })),
      passeios: passeios
        .filter((p) => p.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((p) => ({
          nome: p.nome, data: p.data, horario: p.horario, local: p.local,
          incluso: p.incluso, observacoes: p.observacoes,
          voucher_url: p.arquivo_id ? fotoUrl.get(p.arquivo_id) ?? null : null,
        })),
      info: infos
        .filter((i) => i.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((i) => ({
          titulo: i.titulo,
          conteudo: i.conteudo,
          pdfs: [
            { id: i.arquivo_id, label: i.arquivo_label },
            { id: i.arquivo_id_2, label: i.arquivo_label_2 },
          ]
            .map((a) => (a.id ? { url: fotoUrl.get(a.id) ?? "", label: (a.label ?? "").trim() || "Baixar PDF" } : null))
            .filter((x): x is AmigoInfoPdf => !!x && x.url !== ""),
        })),
      avisos: avisosAll
        .filter((a) => a.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((a) => ({ tipo: a.tipo, titulo: a.titulo, conteudo: a.conteudo })),
      // Rótulos amigáveis (não o nome do arquivo); numera quando há mais de um.
      ingressos_mp: ingressoArqs
        .filter((a) => !!row && a.passageiro_id === row.id && (a.descricao ?? "").startsWith("Ingresso Machu Picchu"))
        .map((a) => fotoUrl.get(a.id) ?? "")
        .filter((url) => url)
        .map((url, i, all) => ({ nome: all.length > 1 ? `Ingresso Machu Picchu ${i + 1}` : "Ingresso Machu Picchu", url })),
      ingressos_trem: ingressoArqs
        .filter((a) => !!row && a.passageiro_id === row.id && (a.descricao ?? "").startsWith("Ingresso Trem Machu Picchu"))
        .map((a) => fotoUrl.get(a.id) ?? "")
        .filter((url) => url)
        .map((url, i, all) => ({ nome: all.length > 1 ? `Ingresso Trem Machu Picchu ${i + 1}` : "Ingresso Trem Machu Picchu", url })),
      seguros: seguroArqs
        .filter((a) => !!row && a.passageiro_id === row.id)
        .map((a) => fotoUrl.get(a.id) ?? "")
        .filter((url) => url)
        .map((url, i, all) => ({ nome: all.length > 1 ? `Seguro viagem ${i + 1}` : "Seu seguro viagem", url })),
      vouchers_voo: vvoucherArqs
        .filter((a) => !!row && a.passageiro_id === row.id)
        .map((a) => fotoUrl.get(a.id) ?? "")
        .filter((url) => url)
        .map((url, i, all) => ({ nome: all.length > 1 ? `Voucher de voo ${i + 1}` : "Seu voucher de voo", url })),
      // Rótulo amigável ("Seu cartão de embarque"), não o nome do arquivo; numera se >1.
      cartoes_embarque: cartaoArqs
        .filter((a) => !!row && a.passageiro_id === row.id)
        .map((a) => fotoUrl.get(a.id) ?? "")
        .filter((url) => url)
        .map((url, i, all) => ({ nome: all.length > 1 ? `Cartão de embarque ${i + 1}` : "Seu cartão de embarque", url })),
      extensoes_contratadas: extensoesAll
        .filter((x) => x.expedicao_id === e.id && minhasExtensoes.has(x.id))
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((x) => ({
          nome: x.nome,
          descricao: x.descricao,
          hospedagem_voucher_url: x.hospedagem_voucher_arquivo_id ? fotoUrl.get(x.hospedagem_voucher_arquivo_id) ?? null : null,
        })),
      // "Não realizou a inscrição": sem perfil_viajante (só o formulário /inscricao o preenche).
      // Admin (row null) não vê o aviso.
      inscricao_incompleta: !!row && !(
        row.perfil_viajante && (typeof row.perfil_viajante !== "object" || Object.keys(row.perfil_viajante).length > 0)
      ),
    });
  }

  if (expedicoes.length === 0) {
    return { ok: false, error: "Você ainda não tem uma viagem futura por aqui. Fale com a agência." };
  }

  // Mais próxima primeiro.
  expedicoes.sort((a, b) => (a.data_embarque ?? "").localeCompare(b.data_embarque ?? ""));

  // Log de acesso (só em logins explícitos; auto-restore de sessão passa false).
  if (registrarLogin) await registrarAcessoExpedamigo(cpf, "login");

  return {
    ok: true,
    dados: { nome, primeiro_nome: nome.split(" ")[0], expedicoes },
    precisaTrocar,
  };
}

/**
 * Registra um acesso no log do ExpedAmigo (best-effort — nunca interrompe o portal).
 * Só CPF + evento + expedição + data/hora (sem IP/dispositivo). Migration 0043.
 */
export async function registrarAcessoExpedamigo(
  cpfRaw: string,
  evento: "login" | "download_pdf" | "viagem_aberta" | "download_voucher",
  expedicaoId?: string | null,
): Promise<void> {
  try {
    const cpf = soDigitosCpf(cpfRaw ?? "");
    if (cpf.length !== 11) return;
    if (!["login", "download_pdf", "viagem_aberta", "download_voucher"].includes(evento)) return;
    const expId = expedicaoId || null;
    if (DEV_USE_MOCK_DATA) {
      mockExpedamigoAcessos.push({
        id: `acc${Math.random().toString(36).slice(2, 12)}`,
        cpf, evento, expedicao_id: expId, created_at: new Date().toISOString(),
      });
      return;
    }
    const sb = createServiceRoleClient();
    await sb.from("expedamigo_acessos").insert({ cpf, evento, expedicao_id: expId });
  } catch {
    /* best-effort */
  }
}

/**
 * Gera um token curto pra levar o passageiro do portal ao formulário de inscrição
 * JÁ com os dados dele (link `/inscricao?t=...`). Reverifica a senha do portal —
 * só quem está autenticado gera token. A senha aqui é a MESMA já usada no login.
 */
export async function gerarTokenInscricao(
  cpfRaw: string,
  senhaRaw: string,
  expedicaoId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  const senha = senhaRaw ?? "";
  if (cpf.length !== 11) return { ok: false, error: "CPF inválido." };
  if (!expedicaoId) return { ok: false, error: "Expedição inválida." };
  if (DEV_USE_MOCK_DATA) return { ok: true, token: assinarTokenInscricao(cpf, expedicaoId) };

  const sb = createServiceRoleClient();
  const { data } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", cpf).maybeSingle();
  const hashSalvo = (data as { senha_hash: string | null } | null)?.senha_hash ?? null;
  const provisoria = (data as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null;
  let okSenha = false;
  if (hashSalvo) okSenha = (await hashSenhaAcesso(cpf, senha)) === hashSalvo;
  else if (provisoria) okSenha = senha === provisoria;
  if (!okSenha) return { ok: false, error: "Sessão expirada. Entre no portal de novo." };
  return { ok: true, token: assinarTokenInscricao(cpf, expedicaoId) };
}

/** Define/troca a senha da pessoa (por CPF). Confere a senha atual antes. */
export async function definirSenhaExpedAmigo(
  cpfRaw: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<{ ok: boolean; error?: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "CPF inválido." };
  const erro = senhaNovaValida(novaSenha);
  if (erro) return { ok: false, error: erro };
  if (DEV_USE_MOCK_DATA) return { ok: true };

  const sb = createServiceRoleClient();
  const { data: cred } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", cpf).maybeSingle();
  const hashSalvo = (cred as { senha_hash: string | null } | null)?.senha_hash ?? null;
  const provisoria = (cred as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null;

  if (hashSalvo) {
    if ((await hashSenhaAcesso(cpf, senhaAtual)) !== hashSalvo) {
      return { ok: false, error: "Senha atual incorreta." };
    }
  } else if (provisoria) {
    // 1º acesso: a senha atual é a provisória (aleatória, gerada na liberação).
    if (senhaAtual !== provisoria) return { ok: false, error: "Senha atual incorreta." };
  } else {
    return { ok: false, error: "Seu acesso ainda não foi liberado. Fale com a agência." };
  }

  // Cria o hash e ZERA a provisória (não é mais necessária/visível).
  const up = await sb
    .from("acesso_senhas")
    .upsert({ cpf, senha_hash: await hashSenhaAcesso(cpf, novaSenha), senha_provisoria: null }, { onConflict: "cpf" });
  if (up.error) return { ok: false, error: up.error.message };
  return { ok: true };
}
