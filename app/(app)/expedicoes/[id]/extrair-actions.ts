"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { montarDossieClaude, type DossieClaude } from "@/lib/extrair/dossie";

/** "Extrair dados p/ Claude": só leitura — qualquer perfil logado (inclusive Relacionamento). */
export async function extrairDossieClaude(
  expedicaoId: string,
  passageiroId?: string | null,
): Promise<{ ok: true; dossie: DossieClaude } | { ok: false; error: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Não autenticado" };
  try {
    const dossie = await montarDossieClaude(expedicaoId, passageiroId ?? null);
    if (!dossie) return { ok: false, error: "Expedição/passageiro não encontrado" };
    return { ok: true, dossie };
  } catch (e) {
    console.error("[extrairDossieClaude]", e);
    return { ok: false, error: "Falha ao montar os dados" };
  }
}
