"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockExpedicoes } from "@/lib/mock-data";

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

  if (DEV_BYPASS) {
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

export async function atualizarPassageiroCampo(
  passageiroId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_BYPASS) {
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
  if (DEV_BYPASS) {
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
  if (DEV_BYPASS) {
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
