import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Log de decisões sobre inscrições (aprovou/recusou/restaurou/excluiu). Escrito
 * pelas server actions de `/inscricoes`; lido pela visão admin (migration 0047).
 * O registro é BEST-EFFORT: nunca lança — logar não pode derrubar a decisão.
 */
export type AcaoInscricao = "aprovada" | "recusada" | "restaurada" | "excluida";

export type DecisaoInscricao = {
  id: string;
  expedicao_id: string | null;
  expedicao_nome: string | null;
  cpf: string | null;
  nome_completo: string | null;
  acao: AcaoInscricao;
  motivo: string | null;
  decidido_por_nome: string | null;
  created_at: string;
};

// Store em memória pro modo mock (persiste entre recompilações do dev via globalThis).
const g = globalThis as unknown as { __mockDecisoes?: DecisaoInscricao[] };
g.__mockDecisoes ??= [];

export async function registrarDecisaoInscricao(input: {
  expedicaoId: string | null;
  cpf: string | null;
  nome: string | null;
  acao: AcaoInscricao;
  motivo?: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
}): Promise<void> {
  try {
    if (DEV_USE_MOCK_DATA) {
      g.__mockDecisoes!.unshift({
        id: `mock-${g.__mockDecisoes!.length + 1}`,
        expedicao_id: input.expedicaoId,
        expedicao_nome: null,
        cpf: input.cpf,
        nome_completo: input.nome,
        acao: input.acao,
        motivo: input.motivo ?? null,
        decidido_por_nome: input.usuarioNome,
        created_at: new Date().toISOString(),
      });
      return;
    }
    const sb = createServiceRoleClient();
    await sb.from("inscricoes_decisoes").insert({
      expedicao_id: input.expedicaoId,
      cpf: input.cpf,
      nome_completo: input.nome,
      acao: input.acao,
      motivo: input.motivo ?? null,
      decidido_por: input.usuarioId,
      decidido_por_nome: input.usuarioNome,
    });
  } catch {
    // best-effort: um log que falha não pode quebrar a aprovação/recusa.
  }
}

export async function listDecisoesInscricao(limite = 300): Promise<DecisaoInscricao[]> {
  if (DEV_USE_MOCK_DATA) return g.__mockDecisoes!.slice(0, limite);
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("inscricoes_decisoes")
    .select("id,expedicao_id,cpf,nome_completo,acao,motivo,decidido_por_nome,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  const linhas = (data ?? []) as Omit<DecisaoInscricao, "expedicao_nome">[];
  // Resolve o nome da expedição (uma consulta só).
  const ids = [...new Set(linhas.map((l) => l.expedicao_id).filter((x): x is string => Boolean(x)))];
  let nomes: Record<string, string> = {};
  if (ids.length) {
    const { data: exps } = await sb.from("expedicoes").select("id,nome").in("id", ids);
    nomes = Object.fromEntries(((exps ?? []) as { id: string; nome: string }[]).map((e) => [e.id, e.nome]));
  }
  return linhas.map((l) => ({ ...l, expedicao_nome: l.expedicao_id ? (nomes[l.expedicao_id] ?? null) : null }));
}
