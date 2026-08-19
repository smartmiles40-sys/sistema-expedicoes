"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockPassageiros, mockExpedicoes, mockPassageiroRequisitos, mockQuartos, mockAlocacoes } from "@/lib/mock-data";
import { listArquivosMock } from "@/lib/data/arquivos-mock";
import { fetchAllRows } from "@/lib/data/expedicoes";
import { soDigitosCpf } from "@/lib/cpf";
import { hashSenhaAcesso, senhaNovaValida } from "@/lib/acesso-senha";
import { avaliarProntidao, type ChecagemProntidao } from "@/lib/prontidao/regras";
import { grupoEgito, ehExpedicaoEgito } from "@/lib/dev-grupos-egito"; // ⚠️ local/temporário (fallback G1/G2 Egito)
import type {
  PassageiroRow, ExpedicaoRow, PassageiroRequisitoRow, ArquivoRow, Prontidao, RoteiroLiderDiaRow,
  GrupoExpedicaoRow, QuartoRow, AlocacaoQuartoRow,
} from "@/types/database";

const BUCKET = "arquivos-expedicoes";

/** Categoria de arquivo de cada tipo de requisito (pra mostrar o doc ao lado). */
const CATEGORIA_REQUISITO: Record<string, string> = {
  "Passaporte": "Documentos pessoais",
  "Ingresso Machu Picchu": "Bilhetes",
  "Ingresso Trem Machu Picchu": "Bilhetes",
  "Aéreo Internacional": "Aéreos",
  "Aéreo Doméstico": "Aéreos",
  "Voo Interno": "Aéreos",
  Seguro: "Seguros",
  Vacina: "Documentos pessoais",
};

/**
 * Acesso Master: CPFs que enxergam TODAS as expedições na Área do Líder
 * (não só as que lideram). Chave = só os 11 dígitos do CPF.
 */
const MASTERS: Record<string, string> = {
  "01997549344": "Luis Antonio de Negreiros Caetano",
  "47146666816": "Beatriz Rodrigues Galvão",
  "79746748220": "Carolina Lage Taketomi",
  "40718963881": "Antonio Carlos Feitosa Beserra dos Santos",
  "20262027999": "Administrador",
};

/**
 * Confere a senha de acesso de um CPF — a MESMA regra do login: hash salvo em
 * `acesso_senhas` ou, no 1º acesso, a senha PROVISÓRIA aleatória (migration 0040;
 * a data de nascimento foi removida). Sem senha/provisória → acesso não liberado.
 *
 * Fica separado porque toda action pública que devolve dado sensível precisa
 * fazer essa checagem. `linkAssinadoLider` não fazia: bastava saber o CPF de um
 * líder pra baixar qualquer documento da expedição dele.
 */
async function conferirSenhaAcesso(
  cpf: string,
  senha: string,
): Promise<{ ok: true; precisaTrocar: boolean } | { ok: false; error: string }> {
  if (DEV_USE_MOCK_DATA) return { ok: true, precisaTrocar: false };
  if (!(senha ?? "").trim()) return { ok: false, error: "Informe sua senha." };

  const sb = createServiceRoleClient();
  const { data: cred } = await sb
    .from("acesso_senhas")
    .select("senha_hash,senha_provisoria")
    .eq("cpf", cpf)
    .maybeSingle();
  const hashSalvo = (cred as { senha_hash: string | null } | null)?.senha_hash ?? null;
  const provisoria = (cred as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null;

  if (hashSalvo) {
    if ((await hashSenhaAcesso(cpf, senha)) !== hashSalvo) {
      return { ok: false, error: "Senha incorreta." };
    }
    return { ok: true, precisaTrocar: false };
  }
  if (provisoria) {
    if (senha !== provisoria) return { ok: false, error: "Senha incorreta." };
    return { ok: true, precisaTrocar: true };
  }
  return { ok: false, error: "Seu acesso ainda não foi liberado. Fale com a agência." };
}

export type LiderArquivo = { id: string; nome: string; mime: string | null; categoria: string };
export type LiderChecagem = ChecagemProntidao & { arquivos: LiderArquivo[] };
export type LiderPax = {
  id: string;
  nome_completo: string;
  tipo: string;
  status_reserva: string;
  cpf: string | null;
  passaporte: string | null;
  validade_passaporte: string | null;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_fone: string | null;
  restricoes_alimentares: string | null;
  condicoes_medicas: string | null;
  /** Foto do passageiro (signed URL / rota mock) pra mostrar no avatar. */
  foto_url: string | null;
  /** Grupo G1/G2 do passageiro (grupo_id real, ou fallback Egito). */
  grupo: string | null;
  /** Quartos alocados (por hotel) + com quem divide — das alocações do Rooming. */
  quartos_alocados: { hotel: string | null; numero: string; tipo: string }[];
  companheiros_quarto: string[];
  /** Acompanhante indicado na inscrição (pra conferir com o quarto real). */
  acompanhante_nome: string | null;
  prontidao: Prontidao;
  checagens: LiderChecagem[];
  arquivos: LiderArquivo[];
};
export type LiderGrupoRoteiro = { rotulo: string | null; dias: RoteiroLiderDiaRow[] };
export type LiderExpedicao = {
  id: string;
  codigo: string;
  nome: string;
  destino: string;
  data_embarque: string;
  data_retorno: string;
  status: string;
  grupo_rotulo: string | null;
  viagem_grupo: string | null;
  /** Roteiro operacional do líder desta expedição (migration 0029). */
  roteiro: RoteiroLiderDiaRow[];
  /** Todos os grupos irmãos da viagem (inclui este) — para o Mapa de Líderes e alertas. */
  grupos: LiderGrupoRoteiro[];
  passageiros: LiderPax[];
};
export type LiderDados = { nome: string; master: boolean; expedicoes: LiderExpedicao[] };

/** Acesso do LÍDER por CPF (sem login). Só leitura. Valida pelo cadastro tipo "Líder". */
export async function buscarDadosLider(
  cpfRaw: string,
  senhaRaw: string,
): Promise<{ ok: true; dados: LiderDados; precisaTrocar: boolean } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "Digite um CPF válido (11 dígitos)." };
  if (!(senhaRaw ?? "").trim()) return { ok: false, error: "Informe sua senha." };

  let pax: PassageiroRow[];
  let exps: ExpedicaoRow[];
  let reqs: PassageiroRequisitoRow[];
  let arqs: { id: string; nome: string; mime: string | null; passageiro_id: string | null; categoria: string; descricao: string | null }[];
  let rl: RoteiroLiderDiaRow[] = [];
  let gruposExp: GrupoExpedicaoRow[] = [];
  let quartos: QuartoRow[] = [];
  let alocacoes: AlocacaoQuartoRow[] = [];
  // arquivo_id -> URL da foto (signed URL em prod, rota de download no mock).
  const fotoUrl = new Map<string, string>();

  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros;
    exps = mockExpedicoes;
    reqs = mockPassageiroRequisitos;
    quartos = mockQuartos;
    alocacoes = mockAlocacoes;
    arqs = (await listArquivosMock()).map((a) => ({ id: a.id, nome: a.nome, mime: a.mime, passageiro_id: a.passageiro_id, categoria: a.categoria, descricao: a.descricao }));
    for (const p of pax) if (p.foto_arquivo_id) fotoUrl.set(p.foto_arquivo_id, `/api/arquivos/${p.foto_arquivo_id}/download?inline=1`);
  } else {
    const sb = createServiceRoleClient();
    // Pagina (PostgREST corta em 1000) — senão o líder veria prontidão errada
    // quando a base passa de 1000 requisitos/arquivos.
    const [er, paxAll, reqAll, arqAll, grpAll, quaAll, aloAll] = await Promise.all([
      sb.from("expedicoes").select("*"),
      fetchAllRows<PassageiroRow>((from, to) => sb.from("passageiros").select("*").order("id").range(from, to)),
      fetchAllRows<PassageiroRequisitoRow>((from, to) => sb.from("passageiro_requisitos").select("*").order("id").range(from, to)),
      fetchAllRows<typeof arqs[number]>((from, to) => sb.from("arquivos").select("id,nome,mime,passageiro_id,categoria,descricao").order("id").range(from, to)),
      fetchAllRows<GrupoExpedicaoRow>((from, to) => sb.from("grupos_expedicao").select("*").order("id").range(from, to)),
      fetchAllRows<QuartoRow>((from, to) => sb.from("quartos").select("*").order("id").range(from, to)),
      fetchAllRows<AlocacaoQuartoRow>((from, to) => sb.from("passageiro_quarto").select("*").order("id").range(from, to)),
    ]);
    exps = (er.data ?? []) as ExpedicaoRow[];
    pax = paxAll;
    reqs = reqAll;
    arqs = arqAll;
    gruposExp = grpAll;
    quartos = quaAll;
    alocacoes = aloAll;
    try {
      rl = await fetchAllRows<RoteiroLiderDiaRow>((from, to) =>
        sb.from("roteiro_lider_dias").select("*").order("id").range(from, to));
    } catch {
      rl = [];
    }
    // Signed URLs das fotos dos passageiros (mesmo padrão do ExpedAmigo).
    const fotoIds = [...new Set(pax.map((p) => p.foto_arquivo_id).filter((id): id is string => !!id))];
    if (fotoIds.length > 0) {
      const { data: arqFotos } = await sb.from("arquivos").select("id,storage_path").in("id", fotoIds);
      const pathById = new Map(((arqFotos ?? []) as { id: string; storage_path: string }[]).map((a) => [a.id, a.storage_path]));
      for (const id of fotoIds) {
        const sp = pathById.get(id);
        if (!sp) continue;
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(sp, 604800); // 7 dias
        if (data?.signedUrl) fotoUrl.set(id, data.signedUrl);
      }
    }
  }
  // Mapa grupo_id -> nome ("G1"/"G2") pra marcar cada passageiro.
  const grupoNomePorId = new Map(gruposExp.map((g) => [g.id, g.nome]));
  // Divisão por grupos é OPT-IN: só as expedições com G1 E G2 usam grupos.
  const expComG1 = new Set(gruposExp.filter((g) => g.nome === "G1").map((g) => g.expedicao_id));
  const expUsaGrupos = new Set(
    gruposExp.filter((g) => g.nome === "G2" && expComG1.has(g.expedicao_id)).map((g) => g.expedicao_id),
  );
  const grupoDoPax = (p: PassageiroRow, exp: ExpedicaoRow): string | null => {
    if (!expUsaGrupos.has(exp.id)) return null;
    if (p.grupo_id && grupoNomePorId.has(p.grupo_id)) {
      const nome = grupoNomePorId.get(p.grupo_id)!;
      if (nome === "G1" || nome === "G2") return nome;
    }
    return ehExpedicaoEgito(exp.destino) ? grupoEgito(p.nome_completo) : null;
  };

  // Alocações reais (M2M) do Rooming: quarto real + companheiros por passageiro.
  const quartoById = new Map(quartos.map((q) => [q.id, q]));
  const nomePorPaxId = new Map(pax.map((p) => [p.id, p.nome_completo]));
  const paxPorQuarto = new Map<string, string[]>();
  const quartosDoPax = new Map<string, string[]>();
  for (const a of alocacoes) {
    if (!paxPorQuarto.has(a.quarto_id)) paxPorQuarto.set(a.quarto_id, []);
    paxPorQuarto.get(a.quarto_id)!.push(a.passageiro_id);
    if (!quartosDoPax.has(a.passageiro_id)) quartosDoPax.set(a.passageiro_id, []);
    quartosDoPax.get(a.passageiro_id)!.push(a.quarto_id);
  }
  const infoQuarto = (p: PassageiroRow) => {
    const qids = quartosDoPax.get(p.id) ?? [];
    const quartos_alocados = qids
      .map((qid) => quartoById.get(qid))
      .filter((q): q is QuartoRow => !!q)
      .sort((a, b) => (a.check_in ?? "").localeCompare(b.check_in ?? ""))
      .map((q) => ({ hotel: q.hotel_cidade, numero: q.numero, tipo: q.tipo }));
    const companheiros_quarto = [...new Set(
      qids.flatMap((qid) => (paxPorQuarto.get(qid) ?? []).filter((id) => id !== p.id)),
    )].map((id) => nomePorPaxId.get(id)).filter((n): n is string => !!n);
    return { quartos_alocados, companheiros_quarto };
  };

  // Linha pendente de aprovação veio do formulário público e não vale como
  // cadastro — nem pra autorizar, nem como fonte da senha do 1º acesso (a data de
  // nascimento). Mesma trava do ExpedAmigo.
  const minhasRows = pax.filter(
    (p) => soDigitosCpf(p.cpf ?? "") === cpf && !p.pendente_aprovacao,
  );
  const ehMaster = MASTERS[cpf] !== undefined;
  const ehLider = minhasRows.some((p) => p.tipo === "Líder");
  if (!ehMaster && !ehLider) {
    return { ok: false, error: "Não encontramos expedições para este CPF. Confira com a equipe." };
  }

  // Senha por pessoa (migration 0031). No 1º acesso a senha é a data de nascimento.
  const conf = await conferirSenhaAcesso(cpf, senhaRaw ?? "");
  if (!conf.ok) return { ok: false, error: conf.error };
  const precisaTrocar = conf.precisaTrocar;

  let nome: string;
  let expIds: string[];
  if (ehMaster) {
    // Acesso Master: enxerga TODAS as expedições.
    nome = MASTERS[cpf];
    expIds = exps.map((e) => e.id);
  } else {
    // Foi líder ao menos 1 vez → enxerga TODAS as expedições que participa (só leitura).
    nome = (minhasRows.find((p) => p.tipo === "Líder") ?? minhasRows[0]).nome_completo;
    expIds = [...new Set(minhasRows.map((p) => p.expedicao_id).filter((id): id is string => !!id))];
  }

  const reqsPorPax = new Map<string, PassageiroRequisitoRow[]>();
  for (const r of reqs) {
    const arr = reqsPorPax.get(r.passageiro_id) ?? [];
    arr.push(r);
    reqsPorPax.set(r.passageiro_id, arr);
  }
  type ArqTrab = LiderArquivo & { descricao: string | null };
  const arqsPorPax = new Map<string, ArqTrab[]>();
  for (const a of arqs) {
    if (!a.passageiro_id) continue;
    const arr = arqsPorPax.get(a.passageiro_id) ?? [];
    arr.push({ id: a.id, nome: a.nome, mime: a.mime, categoria: a.categoria, descricao: a.descricao });
    arqsPorPax.set(a.passageiro_id, arr);
  }

  const expById = new Map(exps.map((e) => [e.id, e]));
  const rlByExp = new Map<string, RoteiroLiderDiaRow[]>();
  for (const d of rl) {
    const arr = rlByExp.get(d.expedicao_id) ?? [];
    arr.push(d);
    rlByExp.set(d.expedicao_id, arr);
  }
  const ordenaDias = (a: RoteiroLiderDiaRow, b: RoteiroLiderDiaRow) => (a.ordem - b.ordem) || (a.dia - b.dia);
  const expedicoes: LiderExpedicao[] = [];
  for (const eid of expIds) {
    const e = expById.get(eid);
    if (!e) continue;
    const roteiro = (rlByExp.get(eid) ?? []).slice().sort(ordenaDias);
    const irmas = e.viagem_grupo
      ? exps.filter((x) => x.viagem_grupo && x.viagem_grupo === e.viagem_grupo)
      : [e];
    const grupos = irmas
      .map((x) => ({ rotulo: x.grupo_rotulo ?? null, dias: (rlByExp.get(x.id) ?? []).slice().sort(ordenaDias) }))
      .filter((g) => g.dias.length > 0)
      .sort((a, b) => (a.rotulo ?? "").localeCompare(b.rotulo ?? ""));
    const paxDaExp = pax.filter((p) => p.expedicao_id === eid && p.status_reserva !== "Cancelado");
    const passageiros: LiderPax[] = paxDaExp
      .map((p) => {
        const res = avaliarProntidao({ passageiro: p, expedicao: e, destino: e.destino, requisitos: reqsPorPax.get(p.id) ?? [] });
        const arquivosPax = arqsPorPax.get(p.id) ?? [];
        const semDescricao = (a: ArqTrab): LiderArquivo => ({ id: a.id, nome: a.nome, mime: a.mime, categoria: a.categoria });
        const checagens: LiderChecagem[] = res.checagens.map((c) => {
          const cat = CATEGORIA_REQUISITO[c.tipo];
          // Vários tipos dividem a mesma categoria (Doc Pessoal/Vacina → "Documentos
          // pessoais"; os 3 aéreos → "Aéreos"). Separa pela descrição "<tipo> — prontidão"
          // que o upload grava, pra cada exigência mostrar só o SEU anexo.
          const arqsDaChecagem = cat
            ? arquivosPax.filter((a) => a.categoria === cat && (a.descricao ?? "").startsWith(c.tipo))
            : [];
          return { ...c, arquivos: arqsDaChecagem.map(semDescricao) };
        });
        return {
          id: p.id,
          nome_completo: p.nome_completo,
          tipo: p.tipo,
          status_reserva: p.status_reserva,
          cpf: p.cpf,
          passaporte: p.passaporte,
          validade_passaporte: p.validade_passaporte,
          data_nascimento: p.data_nascimento,
          email: p.email,
          telefone: p.telefone,
          contato_emergencia_nome: p.contato_emergencia_nome,
          contato_emergencia_fone: p.contato_emergencia_fone,
          restricoes_alimentares: p.restricoes_alimentares,
          condicoes_medicas: p.condicoes_medicas,
          foto_url: p.foto_arquivo_id ? fotoUrl.get(p.foto_arquivo_id) ?? null : null,
          grupo: grupoDoPax(p, e),
          ...infoQuarto(p),
          acompanhante_nome: p.acompanhante_nome,
          prontidao: res.prontidao,
          checagens,
          arquivos: arquivosPax.map(semDescricao),
        };
      })
      .sort((a, b) => (a.tipo === "Líder" ? 0 : 1) - (b.tipo === "Líder" ? 0 : 1) || a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
    expedicoes.push({
      id: e.id,
      codigo: e.codigo,
      nome: e.nome,
      destino: e.destino,
      data_embarque: e.data_embarque,
      data_retorno: e.data_retorno,
      status: e.status,
      grupo_rotulo: e.grupo_rotulo ?? null,
      viagem_grupo: e.viagem_grupo ?? null,
      roteiro,
      grupos,
      passageiros,
    });
  }
  // Mesmo racional da lista de expedições: as PRÓXIMAS (futuras/hoje) primeiro,
  // da mais perto pra mais longe; as PASSADAS no fim, da mais recente pra mais antiga.
  const hoje = new Date().toISOString().slice(0, 10);
  expedicoes.sort((a, b) => {
    const da = (a.data_embarque ?? "").slice(0, 10);
    const db = (b.data_embarque ?? "").slice(0, 10);
    const fa = da !== "" && da >= hoje;
    const fb = db !== "" && db >= hoje;
    if (fa !== fb) return fa ? -1 : 1; // futuras antes das passadas
    return fa ? da.localeCompare(db) : db.localeCompare(da);
  });

  return { ok: true, dados: { nome, master: ehMaster, expedicoes }, precisaTrocar };
}

/** Define/troca a senha da pessoa (por CPF). Confere a senha atual antes. */
export async function definirSenhaLider(
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
    if (senhaAtual !== provisoria) return { ok: false, error: "Senha atual incorreta." };
  } else {
    return { ok: false, error: "Seu acesso ainda não foi liberado. Fale com a agência." };
  }
  const up = await sb
    .from("acesso_senhas")
    .upsert({ cpf, senha_hash: await hashSenhaAcesso(cpf, novaSenha), senha_provisoria: null }, { onConflict: "cpf" });
  if (up.error) return { ok: false, error: up.error.message };
  return { ok: true };
}

/** Gera um link de visualização do documento para o líder (sem login). */
export async function linkAssinadoLider(
  cpfRaw: string,
  senhaRaw: string,
  arquivoId: string,
  download = false,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "CPF inválido" };

  // Sem isso, o CPF sozinho — que é dado semi-público — liberava qualquer
  // documento da expedição (inclusive scans de passaporte) por esta action.
  const conf = await conferirSenhaAcesso(cpf, senhaRaw ?? "");
  if (!conf.ok) return { ok: false, error: conf.error };

  if (DEV_USE_MOCK_DATA) {
    const arq = (await listArquivosMock()).find((a) => a.id === arquivoId);
    if (!arq) return { ok: false, error: "Arquivo não encontrado" };
    return { ok: true, url: download ? `/api/arquivos/${arquivoId}/download` : `/api/arquivos/${arquivoId}/download?inline=1` };
  }

  const sb = createServiceRoleClient();
  const { data: arq } = await sb
    .from("arquivos")
    .select("storage_path,nome,expedicao_id")
    .eq("id", arquivoId)
    .maybeSingle();
  if (!arq) return { ok: false, error: "Arquivo não encontrado" };
  const a = arq as { storage_path: string; nome: string; expedicao_id: string };

  // Autoriza: Master vê tudo; senão o CPF tem que ser líder da expedição dona do arquivo.
  let autorizado = MASTERS[cpf] !== undefined;
  if (!autorizado) {
    const { data: liderRows } = await sb
      .from("passageiros")
      .select("cpf")
      .eq("expedicao_id", a.expedicao_id)
      .eq("tipo", "Líder");
    autorizado = (liderRows ?? []).some((r) => soDigitosCpf((r as { cpf: string | null }).cpf ?? "") === cpf);
  }
  if (!autorizado) return { ok: false, error: "Sem acesso a este documento" };

  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(a.storage_path, 300, download ? { download: a.nome } : {});
  if (error || !data?.signedUrl) return { ok: false, error: "Falha ao gerar o link" };
  return { ok: true, url: data.signedUrl };
}
