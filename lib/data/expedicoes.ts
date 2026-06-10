import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { daysUntil } from "@/lib/utils";
import { faseAtualChecklist } from "@/lib/constants";
import {
  mockExpedicoes,
  mockPassageiros,
  mockCustos,
  mockPagamentos,
  mockChecklistItens,
  mockDocumentos,
  mockQuartos,
  mockUsuarios,
  mockLinksExpedicao,
  getExpedicoesComAgregados,
} from "@/lib/mock-data";
import type {
  Tables,
  ExpedicaoComAgregados,
  ExpedicaoRow,
  PassageiroRow,
  CustoRow,
  PagamentoRow,
  ChecklistItemRow,
  DocumentoRow,
  QuartoRow,
  UsuarioRow,
  LinkExpedicaoRow,
  EtapaChecklist,
} from "@/types/database";

export async function listExpedicoesComAgregados(): Promise<ExpedicaoComAgregados[]> {
  if (DEV_USE_MOCK_DATA) return getExpedicoesComAgregados();

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("expedicoes")
    .select("*")
    .order("ordem", { ascending: true, nullsFirst: false })
    .order("data_embarque", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as ExpedicaoRow[];
  // TODO: agregar via view/RPC quando Supabase estiver conectado
  return rows.map((e) => ({
    ...e,
    pax_confirmados: 0,
    receita_prevista_brl: e.preco_venda_brl * (e.pax_planejados - e.pax_cortesia),
    custo_planejado_brl: 0,
    margem_prevista: 0,
    pagamentos_vencidos: 0,
    docs_pendentes: 0,
    responsavel_op_nome: null,
    responsavel_com_nome: null,
  }));
}

export async function getExpedicao(id: string): Promise<ExpedicaoRow | null> {
  if (DEV_USE_MOCK_DATA) {
    return mockExpedicoes.find((e) => e.id === id) ?? null;
  }
  const supabase = await getServerClient();
  const { data } = await supabase.from("expedicoes").select("*").eq("id", id).maybeSingle();
  return (data as ExpedicaoRow | null) ?? null;
}

export async function getExpedicaoComAgregados(id: string): Promise<ExpedicaoComAgregados | null> {
  if (DEV_USE_MOCK_DATA) {
    return getExpedicoesComAgregados().find((e) => e.id === id) ?? null;
  }
  const e = await getExpedicao(id);
  if (!e) return null;
  return {
    ...e,
    pax_confirmados: 0,
    receita_prevista_brl: e.preco_venda_brl * (e.pax_planejados - e.pax_cortesia),
    custo_planejado_brl: 0,
    margem_prevista: 0,
    pagamentos_vencidos: 0,
    docs_pendentes: 0,
    responsavel_op_nome: null,
    responsavel_com_nome: null,
  };
}

export async function listPassageiros(expedicaoId: string): Promise<PassageiroRow[]> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros.filter((p) => p.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as PassageiroRow[];
}

export async function getPassageiro(passageiroId: string): Promise<PassageiroRow | null> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros.find((p) => p.id === passageiroId) ?? null;
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").eq("id", passageiroId).maybeSingle();
  return (data as PassageiroRow | null) ?? null;
}

export async function listCustos(expedicaoId: string): Promise<CustoRow[]> {
  if (DEV_USE_MOCK_DATA) return mockCustos.filter((c) => c.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("custos").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as CustoRow[];
}

export async function listPagamentos(expedicaoId: string): Promise<PagamentoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    const custosIds = new Set(mockCustos.filter((c) => c.expedicao_id === expedicaoId).map((c) => c.id));
    return mockPagamentos.filter((p) => custosIds.has(p.custo_id));
  }
  const supabase = await getServerClient();
  const { data: custos } = await supabase.from("custos").select("id").eq("expedicao_id", expedicaoId);
  const custosArr = (custos ?? []) as { id: string }[];
  if (!custosArr.length) return [];
  const ids = custosArr.map((c) => c.id);
  const { data } = await supabase.from("pagamentos").select("*").in("custo_id", ids);
  return (data ?? []) as PagamentoRow[];
}

export async function listChecklist(expedicaoId: string): Promise<ChecklistItemRow[]> {
  if (DEV_USE_MOCK_DATA) return mockChecklistItens.filter((c) => c.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("checklist_itens").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as ChecklistItemRow[];
}

export async function listDocumentos(expedicaoId: string): Promise<DocumentoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    const paxIds = new Set(mockPassageiros.filter((p) => p.expedicao_id === expedicaoId).map((p) => p.id));
    return mockDocumentos.filter((d) => paxIds.has(d.passageiro_id));
  }
  const supabase = await getServerClient();
  const { data: pax } = await supabase.from("passageiros").select("id").eq("expedicao_id", expedicaoId);
  const paxArr = (pax ?? []) as { id: string }[];
  if (!paxArr.length) return [];
  const ids = paxArr.map((p) => p.id);
  const { data } = await supabase.from("documentos").select("*").in("passageiro_id", ids);
  return (data ?? []) as DocumentoRow[];
}

export async function listQuartos(expedicaoId: string): Promise<QuartoRow[]> {
  if (DEV_USE_MOCK_DATA) return mockQuartos.filter((q) => q.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("quartos").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as QuartoRow[];
}

export async function listUsuarios(): Promise<UsuarioRow[]> {
  if (DEV_USE_MOCK_DATA) return mockUsuarios;
  const supabase = await getServerClient();
  const { data } = await supabase.from("usuarios").select("*");
  return (data ?? []) as UsuarioRow[];
}

export async function listLinks(expedicaoId: string): Promise<LinkExpedicaoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockLinksExpedicao
      .filter((l) => l.expedicao_id === expedicaoId)
      .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
  }
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("links_expedicao")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  // Se a migration 0008 ainda não foi aplicada, a tabela não existe.
  // Retorna [] em vez de quebrar a página inteira.
  if (error) {
    if (error.code === "42P01" /* undefined_table */) return [];
    console.error("[listLinks] erro:", error);
    return [];
  }
  return (data ?? []) as LinkExpedicaoRow[];
}

// =============================================================================
// Resumo de processos (checklist) cross-expedição — usado no dashboard
// =============================================================================

export type ResumoProcessoExpedicao = {
  id: string;
  nome: string;
  data_embarque: string;
  status: string;
  faseAtual: EtapaChecklist | null;
  total: number;
  concluidos: number;
  atrasados: number;
  proximos7d: number;
};

type CkLite = { expedicao_id: string; status: string; prazo: string | null; parent_id: string | null };

function montarResumo(
  exp: { id: string; nome: string; data_embarque: string; status: string },
  itens: CkLite[],
): ResumoProcessoExpedicao {
  const topo = itens.filter((i) => !i.parent_id);
  let concluidos = 0, atrasados = 0, proximos7d = 0;
  for (const i of topo) {
    const concluido = i.status === "Concluído";
    if (concluido) concluidos++;
    const d = daysUntil(i.prazo);
    if (!concluido && d != null) {
      if (d < 0) atrasados++;
      else if (d <= 7) proximos7d++;
    }
  }
  return {
    id: exp.id,
    nome: exp.nome,
    data_embarque: exp.data_embarque,
    status: exp.status,
    faseAtual: faseAtualChecklist(daysUntil(exp.data_embarque)),
    total: topo.length,
    concluidos,
    atrasados,
    proximos7d,
  };
}

export async function getResumoProcessos(): Promise<ResumoProcessoExpedicao[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockExpedicoes.map((e) =>
      montarResumo(e, mockChecklistItens.filter((c) => c.expedicao_id === e.id)),
    );
  }
  const supabase = await getServerClient();
  const [{ data: exps }, { data: cks }] = await Promise.all([
    supabase.from("expedicoes").select("id, nome, data_embarque, status"),
    supabase.from("checklist_itens").select("expedicao_id, status, prazo, parent_id"),
  ]);
  const itens = (cks ?? []) as CkLite[];
  return ((exps ?? []) as { id: string; nome: string; data_embarque: string; status: string }[]).map(
    (e) => montarResumo(e, itens.filter((c) => c.expedicao_id === e.id)),
  );
}

// Re-export Tables type pra compatibilidade
export type { Tables };
