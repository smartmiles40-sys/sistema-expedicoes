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

/**
 * Ativa a divisão por grupos numa expedição: garante que os grupos "G1" e "G2"
 * existam (cria os que faltarem). A partir daí a coluna Grupo aparece na tabela.
 * Só admin.
 */
export async function ativarDivisaoGrupos(
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (eu?.papel !== "admin") return { ok: false, error: "Apenas admin pode ativar grupos." };
  if (DEV_USE_MOCK_DATA) {
    const agora = new Date().toISOString();
    for (const nome of ["G1", "G2"] as const) {
      if (!mockGrupos.some((g) => g.expedicao_id === expedicaoId && g.nome === nome)) {
        mockGrupos.push({
          id: `grp-${mockGrupos.length + 1}-${nome}`, expedicao_id: expedicaoId, nome,
          data_embarque: null, data_retorno: null, pax_planejados: 0, observacoes: null,
          ordem: nome === "G1" ? 1 : 2, created_at: agora, updated_at: agora,
        } as GrupoExpedicaoRow);
      }
    }
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { data: exist } = await sb.from("grupos_expedicao").select("nome").eq("expedicao_id", expedicaoId);
  const nomes = new Set(((exist ?? []) as { nome: string }[]).map((g) => g.nome));
  const criar = (["G1", "G2"] as const).filter((n) => !nomes.has(n))
    .map((nome) => ({ expedicao_id: expedicaoId, nome, pax_planejados: 0, ordem: nome === "G1" ? 1 : 2 }));
  if (criar.length) {
    const { error } = await sb.from("grupos_expedicao").insert(criar);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}/rooming`);
  return { ok: true };
}

/**
 * Remove a divisão por grupos: apaga os grupos "G1"/"G2" da expedição e zera o
 * grupo_id dos passageiros dela. Só admin. (A coluna Grupo some.)
 */
export async function removerDivisaoGrupos(
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (eu?.papel !== "admin") return { ok: false, error: "Apenas admin pode remover grupos." };
  if (DEV_USE_MOCK_DATA) {
    for (let i = mockGrupos.length - 1; i >= 0; i--) if (mockGrupos[i].expedicao_id === expedicaoId) mockGrupos.splice(i, 1);
    for (const p of mockPassageiros) if (p.expedicao_id === expedicaoId) p.grupo_id = null;
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  await sb.from("passageiros").update({ grupo_id: null }).eq("expedicao_id", expedicaoId);
  const { error } = await sb.from("grupos_expedicao").delete().eq("expedicao_id", expedicaoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}/rooming`);
  return { ok: true };
}
