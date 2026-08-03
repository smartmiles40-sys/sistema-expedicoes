"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { mockPassageiros } from "@/lib/mock-data";
import { mockGrupos } from "@/lib/data/grupos";
import type { GrupoExpedicaoRow } from "@/types/database";

/**
 * "Botão rápido G1/G2": atribui o passageiro a um dos dois grupos DENTRO da
 * expedição (ou tira). Cria o grupo (`grupos_expedicao` com nome "G1"/"G2")
 * automaticamente na 1ª vez. Só admin — grava com service role e checa o papel.
 * Generaliza o esquema G1/G2 (hoje hardcoded só no Egito) pra qualquer expedição.
 */
export type GrupoRapido = "G1" | "G2";

export async function definirGrupoRapido(
  paxId: string,
  expedicaoId: string,
  alvo: GrupoRapido | null,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (eu?.papel !== "admin") return { ok: false, error: "Apenas admin pode definir grupos." };

  if (DEV_USE_MOCK_DATA) {
    let grupoId: string | null = null;
    if (alvo) {
      let g = mockGrupos.find((x) => x.expedicao_id === expedicaoId && x.nome === alvo);
      if (!g) {
        const agora = new Date().toISOString();
        g = {
          id: `grp-${mockGrupos.length + 1}-${alvo}`,
          expedicao_id: expedicaoId, nome: alvo, data_embarque: null, data_retorno: null,
          pax_planejados: 0, observacoes: null, ordem: alvo === "G1" ? 1 : 2,
          created_at: agora, updated_at: agora,
        } as GrupoExpedicaoRow;
        mockGrupos.push(g);
      }
      grupoId = g.id;
    }
    const p = mockPassageiros.find((x) => x.id === paxId);
    if (p) { p.grupo_id = grupoId; p.updated_at = new Date().toISOString(); }
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    return { ok: true };
  }

  const sb = createServiceRoleClient();
  let grupoId: string | null = null;
  if (alvo) {
    // Acha o grupo "G1"/"G2" desta expedição; se não existir, cria.
    const { data: existente } = await sb
      .from("grupos_expedicao").select("id")
      .eq("expedicao_id", expedicaoId).eq("nome", alvo).limit(1).maybeSingle();
    if (existente?.id) {
      grupoId = existente.id as string;
    } else {
      const { data: novo, error } = await sb
        .from("grupos_expedicao")
        .insert({ expedicao_id: expedicaoId, nome: alvo, pax_planejados: 0, ordem: alvo === "G1" ? 1 : 2 })
        .select("id").single();
      if (error) return { ok: false, error: error.message };
      grupoId = (novo as { id: string }).id;
    }
  }
  const { error } = await sb.from("passageiros").update({ grupo_id: grupoId }).eq("id", paxId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}/grupos`);
  return { ok: true };
}
