"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockFornecedores, mockCustos } from "@/lib/mock-data";

const fornecedorSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["DMC", "Hotel", "Guia", "Aéreo", "Receptivo", "Seguro", "Outros"]),
  contato_nome: z.string().nullable().optional(),
  contato_email: z.string().email("E-mail inválido").or(z.literal("")).nullable().optional(),
  contato_whatsapp: z.string().nullable().optional(),
  destino_cidade: z.string().nullable().optional(),
  moeda_padrao: z.string().min(2).default("BRL"),
  politica_pagamento: z.string().nullable().optional(),
  status: z.enum(["Ativo", "Pausado", "Bloqueado"]).default("Ativo"),
  observacoes: z.string().nullable().optional(),
});

export type FornecedorInput = z.infer<typeof fornecedorSchema>;

function genId(prefix = "f") {
  return `${prefix}${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;
}

function normalizar(d: FornecedorInput) {
  return {
    nome: d.nome.trim(),
    tipo: d.tipo,
    contato_nome: d.contato_nome?.trim() || null,
    contato_email: d.contato_email?.trim() || null,
    contato_whatsapp: d.contato_whatsapp?.trim() || null,
    destino_cidade: d.destino_cidade?.trim() || null,
    moeda_padrao: d.moeda_padrao,
    politica_pagamento: d.politica_pagamento?.trim() || null,
    status: d.status,
    observacoes: d.observacoes?.trim() || null,
  };
}

export async function criarFornecedor(
  input: FornecedorInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = fornecedorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const dados = normalizar(parsed.data);

  if (DEV_USE_MOCK_DATA) {
    const id = genId("f");
    mockFornecedores.push({
      ...dados,
      id,
      servicos: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath("/fornecedores");
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase.from("fornecedores").insert(dados).select("id").single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath("/fornecedores");
  return { ok: true, id: (r.data as { id: string }).id };
}

export async function atualizarFornecedor(
  fornecedorId: string,
  input: Partial<FornecedorInput>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = fornecedorSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const raw = parsed.data;
  const dados: Record<string, unknown> = {};
  for (const k of Object.keys(raw) as (keyof FornecedorInput)[]) {
    const v = raw[k];
    if (v === undefined) continue;
    if (typeof v === "string") {
      dados[k] = v.trim() === "" && k !== "nome" && k !== "tipo" && k !== "moeda_padrao" && k !== "status"
        ? null
        : v.trim();
    } else {
      dados[k] = v;
    }
  }

  if (DEV_USE_MOCK_DATA) {
    const idx = mockFornecedores.findIndex((f) => f.id === fornecedorId);
    if (idx === -1) return { ok: false, error: "Fornecedor não encontrado" };
    Object.assign(mockFornecedores[idx], dados, { updated_at: new Date().toISOString() });
    revalidatePath("/fornecedores");
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("fornecedores").update(dados).eq("id", fornecedorId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fornecedores");
  return { ok: true };
}

export async function excluirFornecedor(
  fornecedorId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockFornecedores.findIndex((f) => f.id === fornecedorId);
    if (idx === -1) return { ok: false, error: "Fornecedor não encontrado" };
    const usado = mockCustos.filter((c) => c.fornecedor_id === fornecedorId);
    if (usado.length > 0) {
      return {
        ok: false,
        error: `Fornecedor usado em ${usado.length} custo(s). Remova ou substitua antes.`,
      };
    }
    mockFornecedores.splice(idx, 1);
    revalidatePath("/fornecedores");
    return { ok: true };
  }

  const supabase = await getServerClient();
  const { count } = await supabase
    .from("custos")
    .select("id", { count: "exact", head: true })
    .eq("fornecedor_id", fornecedorId);
  if (count && count > 0) {
    return {
      ok: false,
      error: `Fornecedor usado em ${count} custo(s). Remova ou substitua antes.`,
    };
  }
  const { error } = await supabase.from("fornecedores").delete().eq("id", fornecedorId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fornecedores");
  return { ok: true };
}
