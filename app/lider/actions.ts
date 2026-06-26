"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockPassageiros, mockExpedicoes, mockPassageiroRequisitos } from "@/lib/mock-data";
import { listArquivosMock } from "@/lib/data/arquivos-mock";
import { soDigitosCpf } from "@/lib/cpf";
import { avaliarProntidao, type ChecagemProntidao } from "@/lib/prontidao/regras";
import type {
  PassageiroRow, ExpedicaoRow, PassageiroRequisitoRow, ArquivoRow, Prontidao,
} from "@/types/database";

const BUCKET = "arquivos-expedicoes";

/** Categoria de arquivo de cada tipo de requisito (pra mostrar o doc ao lado). */
const CATEGORIA_REQUISITO: Record<string, string> = {
  "Documento Pessoal": "Documentos pessoais",
  "Aéreo Internacional": "Aéreos",
  "Aéreo Doméstico": "Aéreos",
  Seguro: "Seguros",
  Vacina: "Documentos pessoais",
};

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
  prontidao: Prontidao;
  checagens: LiderChecagem[];
  arquivos: LiderArquivo[];
};
export type LiderExpedicao = {
  id: string;
  codigo: string;
  nome: string;
  destino: string;
  data_embarque: string;
  data_retorno: string;
  status: string;
  passageiros: LiderPax[];
};
export type LiderDados = { nome: string; expedicoes: LiderExpedicao[] };

/** Acesso do LÍDER por CPF (sem login). Só leitura. Valida pelo cadastro tipo "Líder". */
export async function buscarDadosLider(
  cpfRaw: string,
): Promise<{ ok: true; dados: LiderDados } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "Digite um CPF válido (11 dígitos)." };

  let pax: PassageiroRow[];
  let exps: ExpedicaoRow[];
  let reqs: PassageiroRequisitoRow[];
  let arqs: { id: string; nome: string; mime: string | null; passageiro_id: string | null; categoria: string; descricao: string | null }[];

  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros;
    exps = mockExpedicoes;
    reqs = mockPassageiroRequisitos;
    arqs = (await listArquivosMock()).map((a) => ({ id: a.id, nome: a.nome, mime: a.mime, passageiro_id: a.passageiro_id, categoria: a.categoria, descricao: a.descricao }));
  } else {
    const sb = createServiceRoleClient();
    const [pr, er, rr, ar] = await Promise.all([
      sb.from("passageiros").select("*"),
      sb.from("expedicoes").select("*"),
      sb.from("passageiro_requisitos").select("*"),
      sb.from("arquivos").select("id,nome,mime,passageiro_id,categoria,descricao"),
    ]);
    pax = (pr.data ?? []) as PassageiroRow[];
    exps = (er.data ?? []) as ExpedicaoRow[];
    reqs = (rr.data ?? []) as PassageiroRequisitoRow[];
    arqs = (ar.data ?? []) as typeof arqs;
  }

  const liderRows = pax.filter((p) => p.tipo === "Líder" && soDigitosCpf(p.cpf ?? "") === cpf);
  if (!liderRows.length) {
    return { ok: false, error: "Não encontramos expedições para este CPF. Confira com a equipe." };
  }
  const nome = liderRows[0].nome_completo;
  const expIds = [...new Set(liderRows.map((p) => p.expedicao_id).filter((id): id is string => !!id))];

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
  const expedicoes: LiderExpedicao[] = [];
  for (const eid of expIds) {
    const e = expById.get(eid);
    if (!e) continue;
    const paxDaExp = pax.filter((p) => p.expedicao_id === eid && p.status_reserva !== "Cancelado");
    const passageiros: LiderPax[] = paxDaExp
      .map((p) => {
        const res = avaliarProntidao({ passageiro: p, expedicao: e, destino: e.destino, requisitos: reqsPorPax.get(p.id) ?? [] });
        const arquivosPax = arqsPorPax.get(p.id) ?? [];
        const semDescricao = (a: ArqTrab): LiderArquivo => ({ id: a.id, nome: a.nome, mime: a.mime, categoria: a.categoria });
        const checagens: LiderChecagem[] = res.checagens.map((c) => {
          const ehAereoCheck = c.tipo === "Aéreo Internacional" || c.tipo === "Aéreo Doméstico";
          const arqsDaChecagem = arquivosPax.filter(
            (a) =>
              a.categoria === CATEGORIA_REQUISITO[c.tipo] &&
              // separa internacional/doméstico pela descrição "<tipo> — prontidão".
              (!ehAereoCheck || (a.descricao ?? "").startsWith(c.tipo)),
          );
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
      passageiros,
    });
  }
  expedicoes.sort((a, b) => (a.data_embarque ?? "").localeCompare(b.data_embarque ?? ""));

  return { ok: true, dados: { nome, expedicoes } };
}

/** Gera um link de visualização do documento para o líder (sem login). */
export async function linkAssinadoLider(
  cpfRaw: string,
  arquivoId: string,
  download = false,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "CPF inválido" };

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

  // Autoriza: o CPF tem que ser líder da expedição dona do arquivo.
  const { data: liderRows } = await sb
    .from("passageiros")
    .select("cpf")
    .eq("expedicao_id", a.expedicao_id)
    .eq("tipo", "Líder");
  const autorizado = (liderRows ?? []).some((r) => soDigitosCpf((r as { cpf: string | null }).cpf ?? "") === cpf);
  if (!autorizado) return { ok: false, error: "Sem acesso a este documento" };

  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(a.storage_path, 300, download ? { download: a.nome } : {});
  if (error || !data?.signedUrl) return { ok: false, error: "Falha ao gerar o link" };
  return { ok: true, url: data.signedUrl };
}
