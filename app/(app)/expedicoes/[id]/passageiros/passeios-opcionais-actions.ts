"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockPasseiosOpcionais, mockPasseioOpcionalCompras, mockRoteiroDias } from "@/lib/mock-data";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";
import type { PasseioOpcionalRow } from "@/types/database";

type DiaLite = { id: string; dia: number; titulo: string };

/**
 * Passeios opcionais oferecidos numa expedição, com o marcador "comprou" para um
 * passageiro específico. Usado no perfil do passageiro (drawer) para o operacional
 * marcar manualmente a compra. Migration 0044.
 */
export type PasseioOpcionalPax = {
  id: string;
  roteiro_dia_id: string;
  dia: number | null;
  dia_titulo: string;
  titulo: string | null;
  descricao: string | null;
  comprou: boolean;
};

/** Lista os passeios opcionais da expedição marcando o que ESTE passageiro comprou. */
export async function listPasseiosOpcionaisDoPax(
  expedicaoId: string,
  passageiroId: string,
): Promise<PasseioOpcionalPax[]> {
  let passeios: PasseioOpcionalRow[];
  let dias: DiaLite[];
  let compradosIds: Set<string>;

  if (DEV_USE_MOCK_DATA) {
    passeios = mockPasseiosOpcionais.filter((p) => p.expedicao_id === expedicaoId);
    dias = mockRoteiroDias.filter((d) => d.expedicao_id === expedicaoId);
    compradosIds = new Set(
      mockPasseioOpcionalCompras.filter((c) => c.passageiro_id === passageiroId).map((c) => c.passeio_opcional_id),
    );
  } else {
    const sb = createServiceRoleClient();
    const [pRes, dRes, cRes] = await Promise.all([
      sb.from("passeios_opcionais").select("*").eq("expedicao_id", expedicaoId),
      sb.from("roteiro_dias").select("id,dia,titulo").eq("expedicao_id", expedicaoId),
      sb.from("passeio_opcional_compras").select("passeio_opcional_id").eq("passageiro_id", passageiroId),
    ]);
    passeios = (pRes.data ?? []) as PasseioOpcionalRow[];
    dias = (dRes.data ?? []) as DiaLite[];
    compradosIds = new Set(
      ((cRes.data ?? []) as { passeio_opcional_id: string }[]).map((c) => c.passeio_opcional_id),
    );
  }

  const diaById = new Map(dias.map((d) => [d.id, d]));
  return passeios
    .map((p) => {
      const d = diaById.get(p.roteiro_dia_id);
      return {
        id: p.id,
        roteiro_dia_id: p.roteiro_dia_id,
        dia: d?.dia ?? null,
        dia_titulo: d?.titulo ?? "Dia",
        titulo: p.titulo,
        descricao: p.descricao,
        comprou: compradosIds.has(p.id),
      };
    })
    .sort((a, b) => (a.dia ?? 0) - (b.dia ?? 0) || (a.titulo ?? "").localeCompare(b.titulo ?? ""));
}

/** Marca (ou desmarca) que um passageiro comprou um passeio opcional. */
export async function marcarCompraPasseioOpcional(
  passageiroId: string,
  passeioOpcionalId: string,
  comprou: boolean,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeEditar(eu?.papel)) return { ok: false, error: "Seu perfil é somente leitura." };
  if (DEV_USE_MOCK_DATA) {
    const idx = mockPasseioOpcionalCompras.findIndex(
      (c) => c.passageiro_id === passageiroId && c.passeio_opcional_id === passeioOpcionalId,
    );
    if (comprou && idx === -1) {
      mockPasseioOpcionalCompras.push({
        id: `poc${Math.random().toString(36).slice(2, 12)}`,
        passageiro_id: passageiroId,
        passeio_opcional_id: passeioOpcionalId,
        created_at: new Date().toISOString(),
      });
    } else if (!comprou && idx !== -1) {
      mockPasseioOpcionalCompras.splice(idx, 1);
    }
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
    return { ok: true };
  }

  const sb = createServiceRoleClient();
  if (comprou) {
    const { error } = await sb
      .from("passeio_opcional_compras")
      .upsert(
        { passageiro_id: passageiroId, passeio_opcional_id: passeioOpcionalId },
        { onConflict: "passageiro_id,passeio_opcional_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb
      .from("passeio_opcional_compras")
      .delete()
      .eq("passageiro_id", passageiroId)
      .eq("passeio_opcional_id", passeioOpcionalId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  return { ok: true };
}
