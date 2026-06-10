"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import {
  mockExpedicoes,
  mockPassageiros,
  mockQuartos,
  mockCustos,
  mockPagamentos,
  mockChecklistItens,
  mockLinksExpedicao,
  mockUsuarios,
} from "@/lib/mock-data";
import { construirChecklistPadrao } from "@/lib/processos/template";
import { ETAPA_CHECKLIST } from "@/lib/constants";
import type { PapelUsuario } from "@/types/database";

function genId(prefix = "") {
  return `${prefix}${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;
}

const criarSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(3),
  destino: z.string().min(2),
  data_embarque: z.string().min(1),
  data_retorno: z.string().min(1),
  pax_planejados: z.number().int().min(1),
  preco_venda_brl: z.number().min(0),
  responsavel_operacional_id: z.string().optional(),
  responsavel_comercial_id: z.string().optional(),
});

export type CriarExpedicaoResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function criarExpedicao(input: z.infer<typeof criarSchema>): Promise<CriarExpedicaoResult> {
  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const id = `e${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;
    mockExpedicoes.push({
      id,
      codigo: data.codigo,
      nome: data.nome,
      destino: data.destino,
      data_embarque: data.data_embarque,
      data_retorno: data.data_retorno,
      responsavel_operacional_id: data.responsavel_operacional_id ?? null,
      responsavel_comercial_id: data.responsavel_comercial_id ?? null,
      dmc_principal_id: null,
      status: "Planejamento",
      pax_planejados: data.pax_planejados,
      pax_cortesia: 0,
      preco_venda_brl: data.preco_venda_brl,
      bitrix_pipeline_id: null,
      ordem: null,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath("/expedicoes");
    revalidatePath("/dashboard");
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const result = await supabase
    .from("expedicoes")
    .insert({
      codigo: data.codigo,
      nome: data.nome,
      destino: data.destino,
      data_embarque: data.data_embarque,
      data_retorno: data.data_retorno,
      responsavel_operacional_id: data.responsavel_operacional_id ?? null,
      responsavel_comercial_id: data.responsavel_comercial_id ?? null,
      pax_planejados: data.pax_planejados,
      preco_venda_brl: data.preco_venda_brl,
      status: "Planejamento",
    })
    .select("id")
    .single();
  if (result.error) return { ok: false, error: result.error.message };
  revalidatePath("/expedicoes");
  revalidatePath("/dashboard");
  return { ok: true, id: (result.data as { id: string }).id };
}

const CAMPOS_EXPEDICAO_EDITAVEIS = new Set([
  "nome",
  "destino",
  "data_embarque",
  "data_retorno",
  "status",
  "pax_planejados",
  "pax_cortesia",
  "preco_venda_brl",
  "observacoes",
  "responsavel_operacional_id",
  "responsavel_comercial_id",
  "dmc_principal_id",
  "ordem",
]);

const editarLoteSchema = z.object({
  nome: z.string().min(3).optional(),
  destino: z.string().min(2).optional(),
  data_embarque: z.string().min(1).optional(),
  data_retorno: z.string().min(1).optional(),
  pax_planejados: z.number().int().min(0).optional(),
  pax_cortesia: z.number().int().min(0).optional(),
  preco_venda_brl: z.number().min(0).optional(),
  status: z
    .enum(["Planejamento", "Vendas Abertas", "Em andamento", "Concluída", "Cancelada"])
    .optional(),
  observacoes: z.string().nullable().optional(),
  responsavel_operacional_id: z.string().nullable().optional(),
  responsavel_comercial_id: z.string().nullable().optional(),
});

export type EditarExpedicaoInput = z.infer<typeof editarLoteSchema>;

export async function atualizarExpedicaoLote(
  expedicaoId: string,
  input: EditarExpedicaoInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = editarLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const dados = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const idx = mockExpedicoes.findIndex((e) => e.id === expedicaoId);
    if (idx === -1) return { ok: false, error: "Expedição não encontrada" };
    Object.assign(mockExpedicoes[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath("/expedicoes");
    revalidatePath(`/expedicoes/${expedicaoId}`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("expedicoes").update(dados).eq("id", expedicaoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expedicoes");
  revalidatePath(`/expedicoes/${expedicaoId}`);
  return { ok: true };
}

export async function reordenarExpedicoes(
  ids: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const map = new Map(ids.map((id, i) => [id, i]));
    for (const e of mockExpedicoes) {
      const ord = map.get(e.id);
      if (ord != null) (e as unknown as { ordem: number }).ordem = ord;
    }
    revalidatePath("/expedicoes");
    return { ok: true };
  }
  const supabase = await getServerClient();
  const results = await Promise.all(
    ids.map((id, i) =>
      supabase.from("expedicoes").update({ ordem: i }).eq("id", id),
    ),
  );
  const err = results.find((r) => r.error)?.error;
  if (err) return { ok: false, error: err.message };
  revalidatePath("/expedicoes");
  return { ok: true };
}

export async function atualizarExpedicaoCampo(
  expedicaoId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!CAMPOS_EXPEDICAO_EDITAVEIS.has(campo)) {
    return { ok: false, error: `Campo "${campo}" não é editável` };
  }

  if (DEV_USE_MOCK_DATA) {
    const idx = mockExpedicoes.findIndex((e) => e.id === expedicaoId);
    if (idx === -1) return { ok: false, error: "Expedição não encontrada" };
    (mockExpedicoes[idx] as unknown as Record<string, unknown>)[campo] = valor;
    mockExpedicoes[idx].updated_at = new Date().toISOString();
    revalidatePath("/expedicoes");
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase
    .from("expedicoes")
    .update({ [campo]: valor })
    .eq("id", expedicaoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expedicoes");
  revalidatePath("/dashboard");
  return { ok: true };
}

const editarPassageiroLoteSchema = z.object({
  nome_completo: z.string().min(2).optional(),
  tipo: z.enum(["Pagante", "Cortesia", "Líder"]).optional(),
  status_reserva: z.enum(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]).optional(),
  cpf: z.string().nullable().optional(),
  passaporte: z.string().nullable().optional(),
  validade_passaporte: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  email: z.string().email().or(z.literal("")).nullable().optional(),
  telefone: z.string().nullable().optional(),
  companhia_aerea: z.string().nullable().optional(),
  localizador: z.string().nullable().optional(),
  voo_nacional_necessario: z.boolean().optional(),
  observacoes: z.string().nullable().optional(),
});

export async function atualizarPassageiroLote(
  passageiroId: string,
  expedicaoId: string,
  input: z.infer<typeof editarPassageiroLoteSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = editarPassageiroLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const dados = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const idx = mockPassageiros.findIndex((p) => p.id === passageiroId);
    if (idx === -1) return { ok: false, error: "Passageiro não encontrado" };
    Object.assign(mockPassageiros[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("passageiros").update(dados).eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
  return { ok: true };
}

export async function atualizarPassageiroCampo(
  passageiroId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const { mockPassageiros } = await import("@/lib/mock-data");
    const idx = mockPassageiros.findIndex((p) => p.id === passageiroId);
    if (idx === -1) return { ok: false, error: "Passageiro não encontrado" };
    (mockPassageiros[idx] as unknown as Record<string, unknown>)[campo] = valor;
    mockPassageiros[idx].updated_at = new Date().toISOString();
    revalidatePath("/expedicoes");
    return { ok: true };
  }
  const supabase = await getServerClient();
  const { error } = await supabase
    .from("passageiros")
    .update({ [campo]: valor })
    .eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function atualizarCustoCampo(
  custoId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const { mockCustos } = await import("@/lib/mock-data");
    const idx = mockCustos.findIndex((c) => c.id === custoId);
    if (idx === -1) return { ok: false, error: "Custo não encontrado" };
    (mockCustos[idx] as unknown as Record<string, unknown>)[campo] = valor;
    mockCustos[idx].updated_at = new Date().toISOString();
    revalidatePath("/expedicoes");
    return { ok: true };
  }
  const supabase = await getServerClient();
  const { error } = await supabase
    .from("custos")
    .update({ [campo]: valor })
    .eq("id", custoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function atualizarChecklistCampo(
  itemId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const { mockChecklistItens } = await import("@/lib/mock-data");
    const idx = mockChecklistItens.findIndex((c) => c.id === itemId);
    if (idx === -1) return { ok: false, error: "Item não encontrado" };
    (mockChecklistItens[idx] as unknown as Record<string, unknown>)[campo] = valor;
    mockChecklistItens[idx].updated_at = new Date().toISOString();
    revalidatePath("/expedicoes");
    return { ok: true };
  }
  const supabase = await getServerClient();
  const { error } = await supabase
    .from("checklist_itens")
    .update({ [campo]: valor })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =============================================================================
// CRIAR — actions de inserção pra cada tab dentro de uma expedição
// =============================================================================

const novoPassageiroSchema = z.object({
  expedicao_id: z.string().min(1),
  nome_completo: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["Pagante", "Cortesia", "Líder"]),
  status_reserva: z.enum(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]).default("Lead"),
  cpf: z.string().optional().nullable(),
  passaporte: z.string().optional().nullable(),
  validade_passaporte: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function criarPassageiro(
  input: z.infer<typeof novoPassageiroSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = novoPassageiroSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const payload = {
    expedicao_id: d.expedicao_id,
    nome_completo: d.nome_completo,
    tipo: d.tipo,
    status_reserva: d.status_reserva,
    cpf: d.cpf || null,
    passaporte: d.passaporte || null,
    validade_passaporte: d.validade_passaporte || null,
    data_nascimento: d.data_nascimento || null,
    email: d.email || null,
    telefone: d.telefone || null,
    observacoes: d.observacoes || null,
  };

  if (DEV_USE_MOCK_DATA) {
    const id = genId("p");
    mockPassageiros.push({
      ...payload,
      id,
      grupo_id: null,
      bitrix_contact_id: null,
      bitrix_deal_id: null,
      voo_nacional_necessario: false,
      companhia_aerea: null,
      localizador: null,
      quarto_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/expedicoes/${d.expedicao_id}`);
    revalidatePath(`/expedicoes/${d.expedicao_id}/passageiros`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("passageiros").insert(payload).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${d.expedicao_id}`);
  revalidatePath(`/expedicoes/${d.expedicao_id}/passageiros`);
  return { ok: true, id: (r.data as { id: string }).id };
}

const novoQuartoSchema = z.object({
  expedicao_id: z.string().min(1),
  numero: z.string().min(1, "Número obrigatório"),
  tipo: z.enum(["Single", "Duplo", "Twin", "Triplo", "Compartilhado", "Líder"]),
  hotel_cidade: z.string().optional().nullable(),
  check_in: z.string().optional().nullable(),
  check_out: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function criarQuarto(
  input: z.infer<typeof novoQuartoSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = novoQuartoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const payload = {
    expedicao_id: d.expedicao_id,
    numero: d.numero,
    tipo: d.tipo,
    hotel_cidade: d.hotel_cidade || null,
    check_in: d.check_in || null,
    check_out: d.check_out || null,
    observacoes: d.observacoes || null,
    status: "ativo",
  };

  if (DEV_USE_MOCK_DATA) {
    const id = genId("q");
    mockQuartos.push({
      ...payload,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/expedicoes/${d.expedicao_id}/rooming`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("quartos").insert(payload).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${d.expedicao_id}/rooming`);
  return { ok: true, id: (r.data as { id: string }).id };
}

const novoCustoSchema = z.object({
  expedicao_id: z.string().min(1),
  categoria: z.enum([
    "Hotelaria", "Aéreo", "Terrestre", "Ingressos", "Guias",
    "Seguro", "Taxas", "Brindes", "Outros",
  ]),
  servico: z.string().min(2, "Descrição obrigatória"),
  fornecedor_id: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  data_servico: z.string().optional().nullable(),
  moeda: z.string().min(2),
  valor_planejado: z.number().min(0),
  cambio_aplicado: z.number().min(0).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function criarCusto(
  input: z.infer<typeof novoCustoSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = novoCustoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const cambio = d.cambio_aplicado ?? (d.moeda === "BRL" ? 1 : 1);
  const valor_planejado_brl = d.valor_planejado * cambio;
  const payload = {
    expedicao_id: d.expedicao_id,
    categoria: d.categoria,
    servico: d.servico,
    fornecedor_id: d.fornecedor_id || null,
    cidade: d.cidade || null,
    data_servico: d.data_servico || null,
    moeda: d.moeda,
    valor_planejado: d.valor_planejado,
    cambio_aplicado: cambio,
    valor_planejado_brl,
    valor_realizado: null,
    valor_realizado_brl: null,
    status: "A programar" as const,
    pago_por: null,
    observacoes: d.observacoes || null,
  };

  if (DEV_USE_MOCK_DATA) {
    const id = genId("c");
    mockCustos.push({
      ...payload,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/expedicoes/${d.expedicao_id}/custos`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("custos").insert(payload).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${d.expedicao_id}/custos`);
  revalidatePath(`/expedicoes/${d.expedicao_id}`);
  return { ok: true, id: (r.data as { id: string }).id };
}

const novoPagamentoSchema = z.object({
  expedicao_id: z.string().min(1),
  custo_id: z.string().min(1, "Selecione um custo"),
  fornecedor_id: z.string().optional().nullable(),
  servico: z.string().min(2),
  moeda: z.string().min(2),
  valor_total: z.number().min(0),
  entrada: z.number().min(0).default(0),
  vencimento_saldo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function criarPagamento(
  input: z.infer<typeof novoPagamentoSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = novoPagamentoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const saldo = d.valor_total - d.entrada;
  const payload = {
    custo_id: d.custo_id,
    fornecedor_id: d.fornecedor_id || null,
    servico: d.servico,
    moeda: d.moeda,
    valor_total: d.valor_total,
    entrada: d.entrada,
    saldo,
    vencimento_saldo: d.vencimento_saldo || null,
    status: (saldo === 0 ? "Pago" : "Pendente") as "Pago" | "Pendente",
    observacoes: d.observacoes || null,
  };

  if (DEV_USE_MOCK_DATA) {
    const id = genId("pg");
    mockPagamentos.push({
      ...payload,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/expedicoes/${d.expedicao_id}/pagamentos`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("pagamentos").insert(payload).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${d.expedicao_id}/pagamentos`);
  revalidatePath(`/expedicoes/${d.expedicao_id}`);
  return { ok: true, id: (r.data as { id: string }).id };
}

const novoChecklistSchema = z.object({
  expedicao_id: z.string().min(1),
  etapa: z.enum([...ETAPA_CHECKLIST] as [(typeof ETAPA_CHECKLIST)[number], ...(typeof ETAPA_CHECKLIST)[number][]]),
  tarefa: z.string().min(2, "Tarefa obrigatória"),
  responsavel_id: z.string().optional().nullable(),
  prazo: z.string().optional().nullable(),
  prioridade: z.enum(["Baixa", "Média", "Alta", "Crítica"]).default("Média"),
  parent_id: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export async function criarChecklistItem(
  input: z.infer<typeof novoChecklistSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = novoChecklistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;
  const parentId = d.parent_id || null;
  // ordem = nº de irmãos (mesmo pai, ou top-level da mesma fase) + 1
  const irmaos = mockChecklistItens.filter((c) =>
    c.expedicao_id === d.expedicao_id &&
    (parentId ? c.parent_id === parentId : c.parent_id === null && c.etapa === d.etapa),
  ).length;
  const payload = {
    expedicao_id: d.expedicao_id,
    etapa: d.etapa,
    tarefa: d.tarefa,
    responsavel_id: d.responsavel_id || null,
    prazo: d.prazo || null,
    prioridade: d.prioridade,
    status: "Pendente" as const,
    dependencia_id: null,
    parent_id: parentId,
    ordem: irmaos + 1,
    evidencia_url: null,
    bitrix_task_id: null,
    observacoes: d.observacoes || null,
  };

  if (DEV_USE_MOCK_DATA) {
    const id = genId("ck");
    mockChecklistItens.push({
      ...payload,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/expedicoes/${d.expedicao_id}/checklist`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("checklist_itens").insert(payload).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${d.expedicao_id}/checklist`);
  revalidatePath(`/expedicoes/${d.expedicao_id}`);
  return { ok: true, id: (r.data as { id: string }).id };
}

// =============================================================================
// SEEDING — gera o checklist padrão (31 processos do SOP) numa expedição
// =============================================================================

/** Mapeia papel → primeiro usuário daquele papel (pra atribuir responsável padrão). */
function primeiroPorPapel(
  usuarios: { id: string; papel: PapelUsuario }[],
): Partial<Record<PapelUsuario, string>> {
  const map: Partial<Record<PapelUsuario, string>> = {};
  for (const u of usuarios) {
    if (!map[u.papel]) map[u.papel] = u.id;
  }
  return map;
}

export async function gerarChecklistPadrao(
  expedicaoId: string,
): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  if (DEV_USE_MOCK_DATA) {
    const exp = mockExpedicoes.find((e) => e.id === expedicaoId);
    if (!exp) return { ok: false, error: "Expedição não encontrada" };
    if (mockChecklistItens.some((c) => c.expedicao_id === expedicaoId)) {
      return { ok: false, error: "Esta expedição já tem checklist. Apague os itens antes de regerar." };
    }
    const rows = construirChecklistPadrao({
      expedicaoId,
      dataEmbarque: exp.data_embarque,
      responsavelPorPapel: primeiroPorPapel(mockUsuarios),
      createdAt: new Date().toISOString(),
    });
    mockChecklistItens.push(...rows);
    revalidatePath(`/expedicoes/${expedicaoId}/checklist`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    return { ok: true, total: rows.length };
  }

  const supabase = await getServerClient();
  const { data: exp, error: expErr } = await supabase
    .from("expedicoes")
    .select("data_embarque")
    .eq("id", expedicaoId)
    .maybeSingle();
  if (expErr) return { ok: false, error: expErr.message };
  if (!exp) return { ok: false, error: "Expedição não encontrada" };

  const { count } = await supabase
    .from("checklist_itens")
    .select("id", { count: "exact", head: true })
    .eq("expedicao_id", expedicaoId);
  if (count && count > 0) {
    return { ok: false, error: "Esta expedição já tem checklist. Apague os itens antes de regerar." };
  }

  const { data: usuarios } = await supabase.from("usuarios").select("id, papel");
  const responsavelPorPapel = primeiroPorPapel(
    (usuarios ?? []) as { id: string; papel: PapelUsuario }[],
  );

  // IDs temporários só pra ligar pai↔filho; o banco gera os UUIDs reais.
  const rows = construirChecklistPadrao({
    expedicaoId,
    dataEmbarque: (exp as { data_embarque: string }).data_embarque,
    responsavelPorPapel,
    idPrefix: "tmp",
  });
  const stripInsert = (r: (typeof rows)[number]) => ({
    expedicao_id: r.expedicao_id,
    etapa: r.etapa,
    tarefa: r.tarefa,
    responsavel_id: r.responsavel_id,
    status: r.status,
    prazo: r.prazo,
    prioridade: r.prioridade,
    ordem: r.ordem,
  });

  // 1) insere pais e captura os UUIDs reais (ordem preservada)
  const pais = rows.filter((r) => !r.parent_id);
  const insPais = await supabase
    .from("checklist_itens")
    .insert(pais.map(stripInsert))
    .select("id");
  if (insPais.error) return { ok: false, error: insPais.error.message };
  const idReal = new Map<string, string>();
  (insPais.data as { id: string }[]).forEach((row, i) => idReal.set(pais[i].id, row.id));

  // 2) insere filhos apontando pro UUID real do pai
  const filhos = rows.filter((r) => r.parent_id);
  if (filhos.length) {
    const insFilhos = await supabase.from("checklist_itens").insert(
      filhos.map((f) => ({ ...stripInsert(f), parent_id: idReal.get(f.parent_id as string) ?? null })),
    );
    if (insFilhos.error) return { ok: false, error: insFilhos.error.message };
  }

  revalidatePath(`/expedicoes/${expedicaoId}/checklist`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  return { ok: true, total: rows.length };
}

// =============================================================================
// ATUALIZAR LOTE — drawers de edição completa (custo, pagamento, quarto)
// =============================================================================

const editarCustoLoteSchema = z.object({
  categoria: z.enum([
    "Hotelaria", "Aéreo", "Terrestre", "Ingressos", "Guias",
    "Seguro", "Taxas", "Brindes", "Outros",
  ]).optional(),
  servico: z.string().min(2).optional(),
  fornecedor_id: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  data_servico: z.string().nullable().optional(),
  moeda: z.string().min(2).optional(),
  valor_planejado: z.number().min(0).optional(),
  valor_realizado: z.number().min(0).nullable().optional(),
  cambio_aplicado: z.number().min(0).optional(),
  status: z.enum(["A programar", "Programado", "Pago", "Parcial", "Vencido"]).optional(),
  observacoes: z.string().nullable().optional(),
});

export async function atualizarCustoLote(
  custoId: string,
  expedicaoId: string,
  input: z.infer<typeof editarCustoLoteSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = editarCustoLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const dados = { ...parsed.data };

  // Recalcula BRL se valor/câmbio mudou
  if (dados.valor_planejado != null || dados.cambio_aplicado != null) {
    if (DEV_USE_MOCK_DATA) {
      const existing = mockCustos.find((c) => c.id === custoId);
      if (existing) {
        const novoValor = dados.valor_planejado ?? existing.valor_planejado;
        const novoCambio = dados.cambio_aplicado ?? existing.cambio_aplicado ?? 1;
        (dados as Record<string, unknown>).valor_planejado_brl = novoValor * novoCambio;
      }
    }
  }
  if (dados.valor_realizado != null) {
    if (DEV_USE_MOCK_DATA) {
      const existing = mockCustos.find((c) => c.id === custoId);
      if (existing) {
        const cambio = dados.cambio_aplicado ?? existing.cambio_aplicado ?? 1;
        (dados as Record<string, unknown>).valor_realizado_brl = dados.valor_realizado * cambio;
      }
    }
  }

  if (DEV_USE_MOCK_DATA) {
    const idx = mockCustos.findIndex((c) => c.id === custoId);
    if (idx === -1) return { ok: false, error: "Custo não encontrado" };
    Object.assign(mockCustos[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/custos`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  // Em produção, BRL é recalculado por trigger ou view — aqui mandamos só os campos brutos
  const { error } = await supabase.from("custos").update(dados).eq("id", custoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/custos`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  return { ok: true };
}

const editarPagamentoLoteSchema = z.object({
  servico: z.string().min(2).optional(),
  fornecedor_id: z.string().nullable().optional(),
  moeda: z.string().min(2).optional(),
  valor_total: z.number().min(0).optional(),
  entrada: z.number().min(0).optional(),
  vencimento_saldo: z.string().nullable().optional(),
  status: z.enum(["Pendente", "Programado", "Pago", "Parcial", "Vencido", "Cancelado"]).optional(),
  observacoes: z.string().nullable().optional(),
});

export async function atualizarPagamentoLote(
  pagamentoId: string,
  expedicaoId: string,
  input: z.infer<typeof editarPagamentoLoteSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = editarPagamentoLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const dados: Record<string, unknown> = { ...parsed.data };

  // Recalcula saldo se valor/entrada mudou
  if (dados.valor_total != null || dados.entrada != null) {
    if (DEV_USE_MOCK_DATA) {
      const existing = mockPagamentos.find((p) => p.id === pagamentoId);
      if (existing) {
        const novoTotal = (dados.valor_total as number) ?? existing.valor_total;
        const novaEntrada = (dados.entrada as number) ?? existing.entrada;
        dados.saldo = Math.max(0, novoTotal - novaEntrada);
      }
    } else {
      // No Supabase, deixamos um saldo provisório (trigger pode recomputar)
      const total = (dados.valor_total as number | undefined);
      const ent = (dados.entrada as number | undefined);
      if (total != null && ent != null) dados.saldo = Math.max(0, total - ent);
    }
  }

  if (DEV_USE_MOCK_DATA) {
    const idx = mockPagamentos.findIndex((p) => p.id === pagamentoId);
    if (idx === -1) return { ok: false, error: "Pagamento não encontrado" };
    Object.assign(mockPagamentos[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/pagamentos`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("pagamentos").update(dados).eq("id", pagamentoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/pagamentos`);
  return { ok: true };
}

const editarQuartoSchema = z.object({
  numero: z.string().min(1).optional(),
  tipo: z.enum(["Single", "Duplo", "Twin", "Triplo", "Compartilhado", "Líder"]).optional(),
  hotel_cidade: z.string().nullable().optional(),
  check_in: z.string().nullable().optional(),
  check_out: z.string().nullable().optional(),
  status: z.string().optional(),
  observacoes: z.string().nullable().optional(),
});

export async function atualizarQuarto(
  quartoId: string,
  expedicaoId: string,
  input: z.infer<typeof editarQuartoSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = editarQuartoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const dados = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const idx = mockQuartos.findIndex((q) => q.id === quartoId);
    if (idx === -1) return { ok: false, error: "Quarto não encontrado" };
    Object.assign(mockQuartos[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/rooming`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("quartos").update(dados).eq("id", quartoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/rooming`);
  return { ok: true };
}

// =============================================================================
// EXCLUIR — actions de exclusão pra cada entidade
// =============================================================================

export async function excluirExpedicao(
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockExpedicoes.findIndex((e) => e.id === expedicaoId);
    if (idx === -1) return { ok: false, error: "Expedição não encontrada" };
    // Cascata em memória: remove filhos
    mockExpedicoes.splice(idx, 1);
    const removePassageiros = mockPassageiros.filter((p) => p.expedicao_id === expedicaoId);
    for (const p of removePassageiros) {
      const i = mockPassageiros.indexOf(p);
      if (i >= 0) mockPassageiros.splice(i, 1);
    }
    for (let i = mockQuartos.length - 1; i >= 0; i--) {
      if (mockQuartos[i].expedicao_id === expedicaoId) mockQuartos.splice(i, 1);
    }
    for (let i = mockCustos.length - 1; i >= 0; i--) {
      if (mockCustos[i].expedicao_id === expedicaoId) mockCustos.splice(i, 1);
    }
    for (let i = mockChecklistItens.length - 1; i >= 0; i--) {
      if (mockChecklistItens[i].expedicao_id === expedicaoId) mockChecklistItens.splice(i, 1);
    }
    revalidatePath("/expedicoes");
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("expedicoes").delete().eq("id", expedicaoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expedicoes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function excluirPassageiro(
  passageiroId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockPassageiros.findIndex((p) => p.id === passageiroId);
    if (idx === -1) return { ok: false, error: "Passageiro não encontrado" };
    mockPassageiros.splice(idx, 1);
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("passageiros").delete().eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  return { ok: true };
}

export async function excluirQuarto(
  quartoId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockQuartos.findIndex((q) => q.id === quartoId);
    if (idx === -1) return { ok: false, error: "Quarto não encontrado" };
    mockQuartos.splice(idx, 1);
    // Desvincula passageiros
    for (const p of mockPassageiros) {
      if (p.quarto_id === quartoId) p.quarto_id = null;
    }
    revalidatePath(`/expedicoes/${expedicaoId}/rooming`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  // Desvincula passageiros antes
  await supabase.from("passageiros").update({ quarto_id: null }).eq("quarto_id", quartoId);
  const { error } = await supabase.from("quartos").delete().eq("id", quartoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/rooming`);
  return { ok: true };
}

export async function excluirCusto(
  custoId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockCustos.findIndex((c) => c.id === custoId);
    if (idx === -1) return { ok: false, error: "Custo não encontrado" };
    // Bloqueia exclusão se tem pagamento vinculado
    const pagamentosLigados = mockPagamentos.filter((p) => p.custo_id === custoId);
    if (pagamentosLigados.length > 0) {
      return {
        ok: false,
        error: `Existem ${pagamentosLigados.length} pagamento(s) vinculado(s). Exclua-os antes.`,
      };
    }
    mockCustos.splice(idx, 1);
    revalidatePath(`/expedicoes/${expedicaoId}/custos`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { count } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("custo_id", custoId);
  if (count && count > 0) {
    return {
      ok: false,
      error: `Existem ${count} pagamento(s) vinculado(s). Exclua-os antes.`,
    };
  }
  const { error } = await supabase.from("custos").delete().eq("id", custoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/custos`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  return { ok: true };
}

export async function excluirPagamento(
  pagamentoId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockPagamentos.findIndex((p) => p.id === pagamentoId);
    if (idx === -1) return { ok: false, error: "Pagamento não encontrado" };
    mockPagamentos.splice(idx, 1);
    revalidatePath(`/expedicoes/${expedicaoId}/pagamentos`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("pagamentos").delete().eq("id", pagamentoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/pagamentos`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  return { ok: true };
}

// =============================================================================
// LINKS DA EXPEDIÇÃO
// =============================================================================

const linkSchema = z.object({
  expedicao_id: z.string().min(1),
  label: z.string().min(1, "Nome do link obrigatório").max(80),
  url: z.string().url("URL inválida"),
});

export async function criarLink(
  input: z.infer<typeof linkSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const d = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const id = genId("l");
    const ordemAtual = mockLinksExpedicao.filter((l) => l.expedicao_id === d.expedicao_id).length;
    mockLinksExpedicao.push({
      id,
      expedicao_id: d.expedicao_id,
      label: d.label.trim(),
      url: d.url.trim(),
      ordem: ordemAtual,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/expedicoes/${d.expedicao_id}/links`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const { count } = await supabase
    .from("links_expedicao")
    .select("id", { count: "exact", head: true })
    .eq("expedicao_id", d.expedicao_id);
  const r = await supabase
    .from("links_expedicao")
    .insert({
      expedicao_id: d.expedicao_id,
      label: d.label.trim(),
      url: d.url.trim(),
      ordem: count ?? 0,
    })
    .select("id")
    .single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${d.expedicao_id}/links`);
  return { ok: true, id: (r.data as { id: string }).id };
}

const editarLinkSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  url: z.string().url("URL inválida").optional(),
  ordem: z.number().int().min(0).optional(),
});

export async function atualizarLink(
  linkId: string,
  expedicaoId: string,
  input: z.infer<typeof editarLinkSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = editarLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const dados = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const idx = mockLinksExpedicao.findIndex((l) => l.id === linkId);
    if (idx === -1) return { ok: false, error: "Link não encontrado" };
    Object.assign(mockLinksExpedicao[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/links`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("links_expedicao").update(dados).eq("id", linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/links`);
  return { ok: true };
}

export async function excluirLink(
  linkId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockLinksExpedicao.findIndex((l) => l.id === linkId);
    if (idx === -1) return { ok: false, error: "Link não encontrado" };
    mockLinksExpedicao.splice(idx, 1);
    revalidatePath(`/expedicoes/${expedicaoId}/links`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("links_expedicao").delete().eq("id", linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/links`);
  return { ok: true };
}

export async function excluirChecklistItem(
  itemId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockChecklistItens.findIndex((c) => c.id === itemId);
    if (idx === -1) return { ok: false, error: "Item não encontrado" };
    mockChecklistItens.splice(idx, 1);
    // Limpa dependências apontando pra este item
    for (const it of mockChecklistItens) {
      if (it.dependencia_id === itemId) it.dependencia_id = null;
    }
    revalidatePath(`/expedicoes/${expedicaoId}/checklist`);
    return { ok: true };
  }

  const supabase = await getServerClient();
  await supabase.from("checklist_itens").update({ dependencia_id: null }).eq("dependencia_id", itemId);
  const { error } = await supabase.from("checklist_itens").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/checklist`);
  return { ok: true };
}
