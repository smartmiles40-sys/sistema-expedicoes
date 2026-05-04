import { DEV_BYPASS } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import {
  mockExpedicoes,
  mockPassageiros,
  mockCustos,
  mockPagamentos,
  mockChecklistItens,
  mockDocumentos,
  mockQuartos,
  mockUsuarios,
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
} from "@/types/database";

export async function listExpedicoesComAgregados(): Promise<ExpedicaoComAgregados[]> {
  if (DEV_BYPASS) return getExpedicoesComAgregados();

  const supabase = await getServerClient();
  const { data, error } = await supabase.from("expedicoes").select("*");
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
  if (DEV_BYPASS) {
    return mockExpedicoes.find((e) => e.id === id) ?? null;
  }
  const supabase = await getServerClient();
  const { data } = await supabase.from("expedicoes").select("*").eq("id", id).maybeSingle();
  return (data as ExpedicaoRow | null) ?? null;
}

export async function getExpedicaoComAgregados(id: string): Promise<ExpedicaoComAgregados | null> {
  if (DEV_BYPASS) {
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
  if (DEV_BYPASS) return mockPassageiros.filter((p) => p.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as PassageiroRow[];
}

export async function listCustos(expedicaoId: string): Promise<CustoRow[]> {
  if (DEV_BYPASS) return mockCustos.filter((c) => c.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("custos").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as CustoRow[];
}

export async function listPagamentos(expedicaoId: string): Promise<PagamentoRow[]> {
  if (DEV_BYPASS) {
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
  if (DEV_BYPASS) return mockChecklistItens.filter((c) => c.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("checklist_itens").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as ChecklistItemRow[];
}

export async function listDocumentos(expedicaoId: string): Promise<DocumentoRow[]> {
  if (DEV_BYPASS) {
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
  if (DEV_BYPASS) return mockQuartos.filter((q) => q.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("quartos").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as QuartoRow[];
}

export async function listUsuarios(): Promise<UsuarioRow[]> {
  if (DEV_BYPASS) return mockUsuarios;
  const supabase = await getServerClient();
  const { data } = await supabase.from("usuarios").select("*");
  return (data ?? []) as UsuarioRow[];
}

// Re-export Tables type pra compatibilidade
export type { Tables };
