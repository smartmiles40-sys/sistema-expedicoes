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
import { construirRequisitosPadrao } from "@/lib/prontidao/template";
import { ETAPA_CHECKLIST, STATUS_REQUISITO, TIPO_PASSAGEIRO, STATUS_RESERVA } from "@/lib/constants";
import { cpfDigitos } from "@/lib/csv/passageiros-import";
import { cpfValido } from "@/lib/cpf";
import { chaveIdentidade } from "@/lib/data/pessoas";
import type { PapelUsuario, PassageiroRow } from "@/types/database";
import { mockPassageiroRequisitos } from "@/lib/mock-data";

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
  preco_venda_brl: z.number().min(0).optional(),
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
      preco_venda_brl: data.preco_venda_brl ?? 0,
      bitrix_pipeline_id: null,
      ordem: null,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    // Checklist padrão gerado automaticamente em TODA expedição criada.
    await gerarChecklistPadrao(id);
    revalidatePath("/expedicoes");
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
      preco_venda_brl: data.preco_venda_brl ?? 0,
      status: "Planejamento",
    })
    .select("id")
    .single();
  if (result.error) return { ok: false, error: result.error.message };
  const novoId = (result.data as { id: string }).id;
  // Checklist padrão gerado automaticamente em TODA expedição criada.
  await gerarChecklistPadrao(novoId);
  revalidatePath("/expedicoes");
  return { ok: true, id: novoId };
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
  contrato_assinado: z.boolean().optional(),
  checkin_online_feito: z.boolean().optional(),
  observacoes: z.string().nullable().optional(),
});

// =============================================================================
// Dados PESSOAIS x dados da RESERVA — "retroalimentação" do perfil
// -----------------------------------------------------------------------------
// Uma pessoa pode estar em várias expedições (uma linha `passageiros` por
// expedição). Os campos abaixo pertencem à PESSOA, não à reserva: ao editar um,
// propagamos pra todas as linhas da mesma identidade (CPF→Bitrix→e-mail→nome).
// =============================================================================
const CAMPOS_PESSOAIS = [
  "nome_completo",
  "cpf",
  "passaporte",
  "validade_passaporte",
  "data_nascimento",
  "email",
  "telefone",
  "contato_emergencia_nome",
  "contato_emergencia_fone",
  "restricoes_alimentares",
  "condicoes_medicas",
] as const;

function soPessoais(dados: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of CAMPOS_PESSOAIS) if (c in dados) out[c] = dados[c];
  return out;
}

/**
 * Propaga os campos pessoais de `dados` para TODAS as linhas que compartilham
 * identidade com `refId` (inclusive ela mesma). Retorna os `expedicao_id`
 * afetados, pra revalidar as páginas certas.
 */
async function propagarDadosPessoais(
  refId: string,
  dados: Record<string, unknown>,
): Promise<string[]> {
  const patch = soPessoais(dados);
  if (Object.keys(patch).length === 0) return [];

  if (DEV_USE_MOCK_DATA) {
    const ref = mockPassageiros.find((p) => p.id === refId);
    if (!ref) return [];
    const chave = chaveIdentidade(ref);
    const afetados = new Set<string>();
    for (const p of mockPassageiros) {
      if (chaveIdentidade(p) !== chave) continue;
      Object.assign(p, patch, { updated_at: new Date().toISOString() });
      afetados.add(p.expedicao_id);
    }
    return [...afetados];
  }

  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*");
  const rows = (data ?? []) as PassageiroRow[];
  const ref = rows.find((p) => p.id === refId);
  if (!ref) return [];
  const chave = chaveIdentidade(ref);
  const irmaos = rows.filter((p) => chaveIdentidade(p) === chave);
  const { error } = await supabase
    .from("passageiros")
    .update(patch)
    .in("id", irmaos.map((p) => p.id));
  if (error) throw new Error(error.message);
  return [...new Set(irmaos.map((p) => p.expedicao_id))];
}

function revalidarPessoa(expedicaoIds: string[]) {
  for (const eid of expedicaoIds) {
    revalidatePath(`/expedicoes/${eid}/passageiros`);
    revalidatePath(`/expedicoes/${eid}`);
  }
  revalidatePath("/passageiros");
  // Avisos/prontidão derivam dos dados do passageiro (ex.: validade do
  // passaporte) — revalidar pra o aviso sumir/atualizar na hora.
  revalidatePath("/avisos");
}

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
    // Reserva (esta linha) recebe tudo; pessoais propagam pras demais expedições.
    Object.assign(mockPassageiros[idx], dados, { updated_at: new Date().toISOString() });
    const afetados = await propagarDadosPessoais(passageiroId, dados);
    revalidarPessoa(afetados.length ? afetados : [expedicaoId]);
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("passageiros").update(dados).eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  let afetados: string[];
  try {
    afetados = await propagarDadosPessoais(passageiroId, dados);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao propagar dados pessoais" };
  }
  revalidarPessoa(afetados.length ? afetados : [expedicaoId]);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
  return { ok: true };
}

const dadosPessoaisSchema = z.object({
  nome_completo: z.string().min(2, "Mínimo 2 caracteres"),
  cpf: z.string().nullable().optional(),
  passaporte: z.string().nullable().optional(),
  validade_passaporte: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").or(z.literal("")).nullable().optional(),
  telefone: z.string().nullable().optional(),
  contato_emergencia_nome: z.string().nullable().optional(),
  contato_emergencia_fone: z.string().nullable().optional(),
  restricoes_alimentares: z.string().nullable().optional(),
  condicoes_medicas: z.string().nullable().optional(),
});

/**
 * Edita os dados pessoais de uma pessoa a partir do perfil GLOBAL e propaga pra
 * todas as expedições dela. `refId` é qualquer linha `passageiros` da pessoa.
 */
export async function atualizarDadosPessoais(
  refId: string,
  input: z.infer<typeof dadosPessoaisSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = dadosPessoaisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  try {
    const afetados = await propagarDadosPessoais(refId, parsed.data);
    if (afetados.length === 0) return { ok: false, error: "Passageiro não encontrado" };
    revalidarPessoa(afetados);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
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
    revalidatePath("/passageiros");
    revalidatePath("/avisos");
    return { ok: true };
  }
  const supabase = await getServerClient();
  const { error } = await supabase
    .from("passageiros")
    .update({ [campo]: valor })
    .eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expedicoes");
  revalidatePath("/passageiros");
  revalidatePath("/avisos");
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
  nome_completo: z.string().min(2, "Nome completo obrigatório"),
  tipo: z.enum(["Pagante", "Cortesia", "Líder"]),
  status_reserva: z.enum(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]).default("Lead"),
  cpf: z.string().refine(cpfValido, "CPF inválido ou ausente"),
  data_nascimento: z.string().min(1, "Data de nascimento obrigatória"),
  passaporte: z.string().optional().nullable(),
  validade_passaporte: z.string().optional().nullable(),
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
      valor_contratado_brl: 0,
      valor_pago_brl: 0,
      saldo_brl: 0,
      status_financeiro: "Em aberto",
      contato_emergencia_nome: null,
      contato_emergencia_fone: null,
      restricoes_alimentares: null,
      condicoes_medicas: null,
      contrato_assinado: false,
      checkin_online_feito: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    // Prontidão: já instancia os requisitos do destino pro novo passageiro.
    await gerarRequisitosPadrao(d.expedicao_id);
    revalidatePath(`/expedicoes/${d.expedicao_id}`);
    revalidatePath(`/expedicoes/${d.expedicao_id}/passageiros`);
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("passageiros").insert(payload).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  // Prontidão: já instancia os requisitos do destino pro novo passageiro.
  await gerarRequisitosPadrao(d.expedicao_id);
  revalidatePath(`/expedicoes/${d.expedicao_id}`);
  revalidatePath(`/expedicoes/${d.expedicao_id}/passageiros`);
  return { ok: true, id: (r.data as { id: string }).id };
}

/**
 * Adiciona uma pessoa JÁ EXISTENTE (de outra expedição) à expedição alvo,
 * copiando os dados pessoais (CAMPOS_PESSOAIS) de uma linha de referência. A
 * reserva começa do zero (tipo Pagante, status Lead, sem quarto/financeiro).
 * `refPassageiroId` é qualquer linha `passageiros` da pessoa.
 */
export async function adicionarPassageiroExistente(
  expedicaoId: string,
  refPassageiroId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const camposPessoais = (origem: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const c of CAMPOS_PESSOAIS) out[c] = origem[c] ?? null;
    return out;
  };

  if (DEV_USE_MOCK_DATA) {
    const ref = mockPassageiros.find((p) => p.id === refPassageiroId);
    if (!ref) return { ok: false, error: "Passageiro de origem não encontrado" };
    const chave = chaveIdentidade(ref);
    if (mockPassageiros.some((p) => p.expedicao_id === expedicaoId && chaveIdentidade(p) === chave)) {
      return { ok: false, error: "Essa pessoa já está nesta expedição" };
    }
    const id = genId("p");
    mockPassageiros.push({
      ...ref,
      ...(camposPessoais(ref as unknown as Record<string, unknown>) as Partial<PassageiroRow>),
      id,
      expedicao_id: expedicaoId,
      grupo_id: null,
      quarto_id: null,
      tipo: "Pagante",
      status_reserva: "Lead",
      voo_nacional_necessario: false,
      companhia_aerea: null,
      localizador: null,
      valor_contratado_brl: 0,
      valor_pago_brl: 0,
      saldo_brl: 0,
      status_financeiro: "Em aberto",
      contrato_assinado: false,
      checkin_online_feito: false,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as PassageiroRow);
    await gerarRequisitosPadrao(expedicaoId);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    revalidatePath("/passageiros");
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const { data: refData } = await supabase.from("passageiros").select("*").eq("id", refPassageiroId).maybeSingle();
  if (!refData) return { ok: false, error: "Passageiro de origem não encontrado" };
  const ref = refData as PassageiroRow;
  const chave = chaveIdentidade(ref);

  const { data: naExp } = await supabase.from("passageiros").select("*").eq("expedicao_id", expedicaoId);
  if (((naExp ?? []) as PassageiroRow[]).some((p) => chaveIdentidade(p) === chave)) {
    return { ok: false, error: "Essa pessoa já está nesta expedição" };
  }

  const payload = {
    ...camposPessoais(ref as unknown as Record<string, unknown>),
    expedicao_id: expedicaoId,
    tipo: "Pagante",
    status_reserva: "Lead",
  };
  const ins = await supabase.from("passageiros").insert(payload).select("id").single();
  if (ins.error) return { ok: false, error: ins.error.message };
  await gerarRequisitosPadrao(expedicaoId);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath("/passageiros");
  return { ok: true, id: (ins.data as { id: string }).id };
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
    revalidatePath("/avisos");
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("passageiros").delete().eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  revalidatePath("/avisos");
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

// =============================================================================
// PRONTIDÃO — instâncias de requisito por passageiro (P9)
// =============================================================================

/**
 * Instancia os requisitos do destino para os passageiros da expedição que
 * ainda não os têm (idempotente por pax). Disparado pelo empty-state da aba e
 * pelo passageiro-sync do Bitrix ao confirmar um pax.
 */
export async function gerarRequisitosPadrao(
  expedicaoId: string,
): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  if (DEV_USE_MOCK_DATA) {
    const exp = mockExpedicoes.find((e) => e.id === expedicaoId);
    if (!exp) return { ok: false, error: "Expedição não encontrada" };
    const pax = mockPassageiros.filter(
      (p) => p.expedicao_id === expedicaoId && p.status_reserva !== "Cancelado",
    );
    let total = 0;
    for (const p of pax) {
      if (mockPassageiroRequisitos.some((r) => r.passageiro_id === p.id)) continue;
      const rows = construirRequisitosPadrao({
        passageiro: p,
        destino: exp.destino,
        createdAt: new Date().toISOString(),
      });
      mockPassageiroRequisitos.push(...rows);
      total += rows.length;
    }
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    revalidatePath("/avisos");
    return { ok: true, total };
  }

  const supabase = await getServerClient();
  const { data: exp, error: expErr } = await supabase
    .from("expedicoes")
    .select("destino")
    .eq("id", expedicaoId)
    .maybeSingle();
  if (expErr) return { ok: false, error: expErr.message };
  if (!exp) return { ok: false, error: "Expedição não encontrada" };
  const destino = (exp as { destino: string }).destino;

  const { data: pax } = await supabase
    .from("passageiros")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .neq("status_reserva", "Cancelado");
  const passageiros = (pax ?? []) as PassageiroRow[];
  if (!passageiros.length) return { ok: true, total: 0 };

  // Pula quem já tem requisitos.
  const { data: existentes } = await supabase
    .from("passageiro_requisitos")
    .select("passageiro_id")
    .in("passageiro_id", passageiros.map((p) => p.id));
  const jaTem = new Set((existentes ?? []).map((r) => (r as { passageiro_id: string }).passageiro_id));

  const novos = passageiros
    .filter((p) => !jaTem.has(p.id))
    .flatMap((p) => construirRequisitosPadrao({ passageiro: p, destino, idPrefix: "tmp" }))
    .map((r) => ({
      passageiro_id: r.passageiro_id,
      tipo: r.tipo,
      descricao: r.descricao,
      status: r.status,
      obrigatoriedade: r.obrigatoriedade,
      bloqueia_embarque: r.bloqueia_embarque,
      numero: r.numero,
      observacoes: r.observacoes,
    }));
  if (!novos.length) return { ok: true, total: 0 };

  const { error } = await supabase.from("passageiro_requisitos").insert(novos);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  revalidatePath("/avisos");
  return { ok: true, total: novos.length };
}

const CAMPOS_REQUISITO_EDITAVEIS = new Set([
  "status",
  "validade",
  "numero",
  "obrigatoriedade",
  "bloqueia_embarque",
  "arquivo_id",
  "responsavel_id",
  "observacoes",
]);

const STATUS_VERIFICAVEIS = new Set(["Aprovado", "Reprovado", "Dispensado"]);

export async function atualizarRequisitoCampo(
  requisitoId: string,
  expedicaoId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!CAMPOS_REQUISITO_EDITAVEIS.has(campo)) {
    return { ok: false, error: `Campo "${campo}" não é editável` };
  }
  if (campo === "status" && !STATUS_REQUISITO.includes(valor as (typeof STATUS_REQUISITO)[number])) {
    return { ok: false, error: "Status inválido" };
  }

  // Ao mudar status para um veredito, carimba verificado_em.
  const extra: Record<string, unknown> = {};
  if (campo === "status" && STATUS_VERIFICAVEIS.has(valor as string)) {
    extra.verificado_em = new Date().toISOString();
  }

  if (DEV_USE_MOCK_DATA) {
    const idx = mockPassageiroRequisitos.findIndex((r) => r.id === requisitoId);
    if (idx === -1) return { ok: false, error: "Requisito não encontrado" };
    (mockPassageiroRequisitos[idx] as unknown as Record<string, unknown>)[campo] = valor;
    Object.assign(mockPassageiroRequisitos[idx], extra, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    revalidatePath(`/expedicoes/${expedicaoId}`);
    revalidatePath("/avisos");
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase
    .from("passageiro_requisitos")
    .update({ [campo]: valor, ...extra })
    .eq("id", requisitoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}`);
  revalidatePath("/avisos");
  return { ok: true };
}

// =============================================================================
// IMPORTAÇÃO EM LOTE — passageiros via CSV
// =============================================================================

const importRowSchema = z.object({
  nome_completo: z.string().min(2),
  tipo: z.enum([...TIPO_PASSAGEIRO] as [TipoPassageiroEnum, ...TipoPassageiroEnum[]]),
  status_reserva: z.enum([...STATUS_RESERVA] as [StatusReservaEnum, ...StatusReservaEnum[]]),
  cpf: z.string().nullable().refine((v) => cpfValido(v), { message: "CPF inválido ou ausente" }),
  passaporte: z.string().nullable().optional(),
  validade_passaporte: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().refine((v) => !!v && v.trim().length > 0, {
    message: "Data de nascimento obrigatória",
  }),
  email: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  valor_contratado_brl: z.number().nonnegative().nullable().optional(),
  valor_pago_brl: z.number().nonnegative().nullable().optional(),
});
type TipoPassageiroEnum = (typeof TIPO_PASSAGEIRO)[number];
type StatusReservaEnum = (typeof STATUS_RESERVA)[number];

/** Deriva o status financeiro a partir dos valores e do tipo de pax. */
function statusFinanceiroDe(contratado: number, pago: number, tipo: TipoPassageiroEnum): string {
  if (tipo !== "Pagante" && contratado === 0) return "Cortesia";
  if (contratado > 0 && pago >= contratado) return "Quitado";
  return "Em aberto";
}

const importarSchema = z.object({
  expedicao_id: z.string().min(1),
  linhas: z.array(importRowSchema).min(1, "Nenhuma linha para importar").max(1000),
});

export type ImportarResult =
  | { ok: true; inseridos: number; ignorados: number }
  | { ok: false; error: string };

function novoPassageiroDeImport(
  expedicaoId: string,
  d: z.infer<typeof importRowSchema>,
): PassageiroRow {
  const now = new Date().toISOString();
  const contratado = d.valor_contratado_brl ?? 0;
  const pago = d.valor_pago_brl ?? 0;
  return {
    id: genId("p"),
    expedicao_id: expedicaoId,
    grupo_id: null,
    bitrix_contact_id: null,
    bitrix_deal_id: null,
    nome_completo: d.nome_completo,
    tipo: d.tipo,
    cpf: d.cpf ?? null,
    passaporte: d.passaporte ?? null,
    data_nascimento: d.data_nascimento ?? null,
    validade_passaporte: d.validade_passaporte ?? null,
    email: d.email ?? null,
    telefone: d.telefone ?? null,
    status_reserva: d.status_reserva,
    voo_nacional_necessario: false,
    companhia_aerea: null,
    localizador: null,
    quarto_id: null,
    valor_contratado_brl: contratado,
    valor_pago_brl: pago,
    saldo_brl: contratado - pago,
    status_financeiro: statusFinanceiroDe(contratado, pago, d.tipo),
    contato_emergencia_nome: null,
    contato_emergencia_fone: null,
    restricoes_alimentares: null,
    condicoes_medicas: null,
    contrato_assinado: false,
    checkin_online_feito: false,
    observacoes: d.observacoes ?? null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Importa passageiros em lote numa expedição. Pula linhas cujo CPF já existe na
 * expedição (ou repetido dentro do próprio lote) e instancia os requisitos de
 * embarque de cada novo pax. Devolve quantos entraram e quantos foram ignorados.
 */
export async function importarPassageiros(
  input: z.infer<typeof importarSchema>,
): Promise<ImportarResult> {
  const parsed = importarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { expedicao_id, linhas } = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const exp = mockExpedicoes.find((e) => e.id === expedicao_id);
    if (!exp) return { ok: false, error: "Expedição não encontrada" };
    const cpfsExistentes = new Set(
      mockPassageiros
        .filter((p) => p.expedicao_id === expedicao_id)
        .map((p) => cpfDigitos(p.cpf))
        .filter(Boolean),
    );
    let inseridos = 0;
    let ignorados = 0;
    for (const d of linhas) {
      const cpf = cpfDigitos(d.cpf ?? null);
      if (cpf && cpfsExistentes.has(cpf)) { ignorados++; continue; }
      if (cpf) cpfsExistentes.add(cpf);
      const novo = novoPassageiroDeImport(expedicao_id, d);
      mockPassageiros.push(novo);
      mockPassageiroRequisitos.push(
        ...construirRequisitosPadrao({ passageiro: novo, destino: exp.destino }),
      );
      inseridos++;
    }
    revalidatePath(`/expedicoes/${expedicao_id}/passageiros`);
    revalidatePath(`/expedicoes/${expedicao_id}`);
    revalidatePath("/passageiros");
    return { ok: true, inseridos, ignorados };
  }

  const supabase = await getServerClient();
  const { data: exp } = await supabase
    .from("expedicoes")
    .select("id")
    .eq("id", expedicao_id)
    .maybeSingle();
  if (!exp) return { ok: false, error: "Expedição não encontrada" };

  const { data: existentes } = await supabase
    .from("passageiros")
    .select("cpf")
    .eq("expedicao_id", expedicao_id);
  const cpfsExistentes = new Set(
    ((existentes ?? []) as { cpf: string | null }[])
      .map((p) => cpfDigitos(p.cpf))
      .filter(Boolean),
  );

  let ignorados = 0;
  const aInserir: Record<string, unknown>[] = [];
  for (const d of linhas) {
    const cpf = cpfDigitos(d.cpf ?? null);
    if (cpf && cpfsExistentes.has(cpf)) { ignorados++; continue; }
    if (cpf) cpfsExistentes.add(cpf);
    const contratado = d.valor_contratado_brl ?? 0;
    const pago = d.valor_pago_brl ?? 0;
    aInserir.push({
      expedicao_id,
      nome_completo: d.nome_completo,
      tipo: d.tipo,
      status_reserva: d.status_reserva,
      cpf: d.cpf ?? null,
      passaporte: d.passaporte ?? null,
      data_nascimento: d.data_nascimento ?? null,
      validade_passaporte: d.validade_passaporte ?? null,
      email: d.email ?? null,
      telefone: d.telefone ?? null,
      observacoes: d.observacoes ?? null,
      valor_contratado_brl: contratado,
      valor_pago_brl: pago,
      status_financeiro: statusFinanceiroDe(contratado, pago, d.tipo),
    });
  }

  if (aInserir.length) {
    const { error } = await supabase.from("passageiros").insert(aInserir);
    if (error) return { ok: false, error: error.message };
    // Instancia requisitos pros novos pax (idempotente por pax).
    await gerarRequisitosPadrao(expedicao_id);
  }

  revalidatePath(`/expedicoes/${expedicao_id}/passageiros`);
  revalidatePath(`/expedicoes/${expedicao_id}`);
  revalidatePath("/passageiros");
  return { ok: true, inseridos: aInserir.length, ignorados };
}

// --- Importação GLOBAL: cada linha indica a expedição pelo código ------------

const globalRowSchema = importRowSchema.extend({
  expedicao_codigo: z.string().min(1, "Código de expedição ausente"),
});
const importarGlobalSchema = z.object({
  linhas: z.array(globalRowSchema).min(1, "Nenhuma linha para importar").max(2000),
});

export type ImportarGlobalResult =
  | { ok: true; inseridos: number; ignorados: number; semExpedicao: number }
  | { ok: false; error: string };

export async function importarPassageirosGlobal(
  input: z.infer<typeof importarGlobalSchema>,
): Promise<ImportarGlobalResult> {
  const parsed = importarGlobalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { linhas } = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const porCodigo = new Map(mockExpedicoes.map((e) => [e.codigo, e]));
    const cpfsPorExp = new Map<string, Set<string>>();
    const cpfSet = (expId: string) => {
      let s = cpfsPorExp.get(expId);
      if (!s) {
        s = new Set(
          mockPassageiros
            .filter((p) => p.expedicao_id === expId)
            .map((p) => cpfDigitos(p.cpf))
            .filter((c): c is string => Boolean(c)),
        );
        cpfsPorExp.set(expId, s);
      }
      return s;
    };
    let inseridos = 0, ignorados = 0, semExpedicao = 0;
    for (const d of linhas) {
      const exp = porCodigo.get(d.expedicao_codigo);
      if (!exp) { semExpedicao++; continue; }
      const cpf = cpfDigitos(d.cpf ?? null);
      const set = cpfSet(exp.id);
      if (cpf && set.has(cpf)) { ignorados++; continue; }
      if (cpf) set.add(cpf);
      const novo = novoPassageiroDeImport(exp.id, d);
      mockPassageiros.push(novo);
      mockPassageiroRequisitos.push(
        ...construirRequisitosPadrao({ passageiro: novo, destino: exp.destino }),
      );
      inseridos++;
    }
    revalidatePath("/passageiros");
    revalidatePath("/dashboard");
    return { ok: true, inseridos, ignorados, semExpedicao };
  }

  const supabase = await getServerClient();
  const codigos = [...new Set(linhas.map((l) => l.expedicao_codigo))];
  const { data: exps } = await supabase
    .from("expedicoes")
    .select("id, codigo, destino")
    .in("codigo", codigos);
  const porCodigo = new Map(
    ((exps ?? []) as { id: string; codigo: string }[]).map((e) => [e.codigo, e.id]),
  );

  const idsEnvolvidos = [...porCodigo.values()];
  const cpfsPorExp = new Map<string, Set<string>>();
  if (idsEnvolvidos.length) {
    const { data: existentes } = await supabase
      .from("passageiros")
      .select("expedicao_id, cpf")
      .in("expedicao_id", idsEnvolvidos);
    for (const p of (existentes ?? []) as { expedicao_id: string; cpf: string | null }[]) {
      const cpf = cpfDigitos(p.cpf);
      if (!cpf) continue;
      const s = cpfsPorExp.get(p.expedicao_id) ?? new Set<string>();
      s.add(cpf);
      cpfsPorExp.set(p.expedicao_id, s);
    }
  }

  let ignorados = 0, semExpedicao = 0;
  const aInserir: Record<string, unknown>[] = [];
  const expedicoesComInsercao = new Set<string>();
  for (const d of linhas) {
    const expId = porCodigo.get(d.expedicao_codigo);
    if (!expId) { semExpedicao++; continue; }
    const cpf = cpfDigitos(d.cpf ?? null);
    const set = cpfsPorExp.get(expId) ?? new Set<string>();
    cpfsPorExp.set(expId, set);
    if (cpf && set.has(cpf)) { ignorados++; continue; }
    if (cpf) set.add(cpf);
    const contratado = d.valor_contratado_brl ?? 0;
    const pago = d.valor_pago_brl ?? 0;
    expedicoesComInsercao.add(expId);
    aInserir.push({
      expedicao_id: expId,
      nome_completo: d.nome_completo,
      tipo: d.tipo,
      status_reserva: d.status_reserva,
      cpf: d.cpf ?? null,
      passaporte: d.passaporte ?? null,
      data_nascimento: d.data_nascimento ?? null,
      validade_passaporte: d.validade_passaporte ?? null,
      email: d.email ?? null,
      telefone: d.telefone ?? null,
      observacoes: d.observacoes ?? null,
      valor_contratado_brl: contratado,
      valor_pago_brl: pago,
      status_financeiro: statusFinanceiroDe(contratado, pago, d.tipo),
    });
  }

  if (aInserir.length) {
    const { error } = await supabase.from("passageiros").insert(aInserir);
    if (error) return { ok: false, error: error.message };
    for (const expId of expedicoesComInsercao) await gerarRequisitosPadrao(expId);
  }

  revalidatePath("/passageiros");
  revalidatePath("/dashboard");
  return { ok: true, inseridos: aInserir.length, ignorados, semExpedicao };
}
