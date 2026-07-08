"use server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// CRUD do Roteiro do Líder (migration 0029). Usa service role (lê/escreve no banco
// real; sem branch de mock — a tabela não tem fixtures).
type Valores = Record<string, string | number | null>;

interface LooseClient {
  from(t: string): {
    select(c: string, o?: { count: "exact"; head: true }): { eq(c: string, v: string): Promise<{ count: number | null }> };
    insert(v: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    update(v: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
    delete(): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
  };
}
const loose = () => createServiceRoleClient() as unknown as LooseClient;
const rev = (id: string) => revalidatePath(`/expedicoes/${id}/roteiro-lider`);

export async function criarDiaLider(expedicaoId: string, valores: Valores): Promise<{ ok: boolean; error?: string }> {
  const sb = loose();
  const { count } = await sb.from("roteiro_lider_dias").select("id", { count: "exact", head: true }).eq("expedicao_id", expedicaoId);
  const { error } = await sb.from("roteiro_lider_dias").insert({ expedicao_id: expedicaoId, ordem: count ?? 0, ...valores });
  if (error) return { ok: false, error: error.message };
  rev(expedicaoId);
  return { ok: true };
}

export async function atualizarDiaLider(id: string, expedicaoId: string, valores: Valores): Promise<{ ok: boolean; error?: string }> {
  const sb = loose();
  const { error } = await sb.from("roteiro_lider_dias").update(valores).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev(expedicaoId);
  return { ok: true };
}

export async function excluirDiaLider(id: string, expedicaoId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = loose();
  const { error } = await sb.from("roteiro_lider_dias").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev(expedicaoId);
  return { ok: true };
}
