"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockExtensoes, mockPassageiroExtensao } from "@/lib/mock-data";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";
import type { ExtensaoRow } from "@/types/database";

/**
 * Extensões de uma expedição com o marcador "contratou" para um passageiro.
 * Usado no perfil do passageiro (drawer) para o operacional marcar quem fica os
 * dias extras. Migration 0052. Mesmo padrão dos passeios opcionais (0044).
 */
export type ExtensaoPax = {
  id: string;
  nome: string;
  descricao: string | null;
  contratou: boolean;
};

/** Lista as extensões da expedição marcando o que ESTE passageiro contratou. */
export async function listExtensoesDoPax(
  expedicaoId: string,
  passageiroId: string,
): Promise<ExtensaoPax[]> {
  let extensoes: ExtensaoRow[];
  let contratadasIds: Set<string>;

  if (DEV_USE_MOCK_DATA) {
    extensoes = mockExtensoes.filter((e) => e.expedicao_id === expedicaoId);
    contratadasIds = new Set(
      mockPassageiroExtensao.filter((c) => c.passageiro_id === passageiroId).map((c) => c.extensao_id),
    );
  } else {
    const sb = createServiceRoleClient();
    const [eRes, cRes] = await Promise.all([
      sb.from("extensoes").select("*").eq("expedicao_id", expedicaoId),
      sb.from("passageiro_extensao").select("extensao_id").eq("passageiro_id", passageiroId),
    ]);
    extensoes = (eRes.data ?? []) as ExtensaoRow[];
    contratadasIds = new Set(((cRes.data ?? []) as { extensao_id: string }[]).map((c) => c.extensao_id));
  }

  return extensoes
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      descricao: e.descricao,
      contratou: contratadasIds.has(e.id),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Marca (ou desmarca) que um passageiro contratou uma extensão. */
export async function marcarExtensao(
  passageiroId: string,
  extensaoId: string,
  contratou: boolean,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeEditar(eu?.papel)) return { ok: false, error: "Seu perfil é somente leitura." };
  if (DEV_USE_MOCK_DATA) {
    const idx = mockPassageiroExtensao.findIndex(
      (c) => c.passageiro_id === passageiroId && c.extensao_id === extensaoId,
    );
    if (contratou && idx === -1) {
      mockPassageiroExtensao.push({
        id: `pe${Math.random().toString(36).slice(2, 12)}`,
        passageiro_id: passageiroId,
        extensao_id: extensaoId,
        created_at: new Date().toISOString(),
      });
    } else if (!contratou && idx !== -1) {
      mockPassageiroExtensao.splice(idx, 1);
    }
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    return { ok: true };
  }

  const sb = createServiceRoleClient();
  if (contratou) {
    const { error } = await sb
      .from("passageiro_extensao")
      .upsert(
        { passageiro_id: passageiroId, extensao_id: extensaoId },
        { onConflict: "passageiro_id,extensao_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb
      .from("passageiro_extensao")
      .delete()
      .eq("passageiro_id", passageiroId)
      .eq("extensao_id", extensaoId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  return { ok: true };
}
