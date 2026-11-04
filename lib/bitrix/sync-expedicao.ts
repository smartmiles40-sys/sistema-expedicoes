/**
 * Disparo da sincronização de passageiros de uma expedição a partir do Bitrix.
 *
 * O app NÃO fala com o Bitrix direto: chama o webhook ÚNICO do n8n (`N8N_SYNC_URL`)
 * passando `expedicao_codigo` + `stage_id` (etapa do Bitrix guardada na expedição) +
 * `category_id` (derivada do prefixo "C<cat>:" do stage). O n8n só filtra os deals
 * daquela coluna e devolve via /api/bitrix/sync-contato — sem de-para hardcoded.
 *
 * Reaproveitado pelo botão "Atualizar do Bitrix" (1 expedição) e pelo fan-out
 * automático (`sincronizarTodasExpedicoesBitrix`, chamado pelo cron).
 */
import "server-only";
import type { createServiceRoleClient } from "@/lib/supabase/admin";

type Sb = ReturnType<typeof createServiceRoleClient>;

/** Categoria (pipeline) do Bitrix a partir do STAGE_ID: "C29:UC_x" → "29". */
export function categoriaDoStage(stageId: string | null | undefined): string | null {
  const m = /^C(\d+):/.exec((stageId ?? "").trim());
  return m ? m[1] : null;
}

/** Dispara a sync de UMA expedição no n8n. Best-effort: devolve ok/erro, não lança. */
export async function dispararSyncExpedicaoN8n(params: {
  codigo: string;
  stageId: string | null | undefined;
}): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.N8N_SYNC_URL;
  if (!url) return { ok: false, error: "Integração não configurada (N8N_SYNC_URL ausente)." };
  const stage = (params.stageId ?? "").trim();
  if (!stage) return { ok: false, error: "Expedição sem etapa do Bitrix (bitrix_stage_id)." };
  const category_id = categoriaDoStage(stage);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": process.env.N8N_SYNC_SECRET ?? "" },
      body: JSON.stringify({ expedicao_codigo: params.codigo, stage_id: stage, category_id }),
    });
    if (!res.ok) return { ok: false, error: `O n8n respondeu ${res.status}.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar o n8n." };
  }
}

export type SyncTodasResult = {
  ok: boolean;
  total: number;
  enviados: number;
  pulados: number;
  falhas: { codigo: string; error: string }[];
  error?: string;
};

/**
 * Fan-out: dispara a sync de TODAS as expedições ativas (não concluídas/canceladas)
 * que têm a etapa do Bitrix preenchida. Sequencial, pra não martelar o n8n/Bitrix.
 */
export async function sincronizarTodasExpedicoesBitrix(sb: Sb): Promise<SyncTodasResult> {
  const { data, error } = await sb
    .from("expedicoes")
    .select("codigo, bitrix_stage_id, status");
  if (error) return { ok: false, total: 0, enviados: 0, pulados: 0, falhas: [], error: error.message };
  const exps = ((data ?? []) as { codigo: string; bitrix_stage_id: string | null; status: string }[])
    .filter((e) => e.bitrix_stage_id && e.status !== "Concluída" && e.status !== "Cancelada");

  let enviados = 0;
  const falhas: { codigo: string; error: string }[] = [];
  for (const e of exps) {
    const r = await dispararSyncExpedicaoN8n({ codigo: e.codigo, stageId: e.bitrix_stage_id });
    if (r.ok) enviados++;
    else falhas.push({ codigo: e.codigo, error: r.error ?? "erro" });
  }
  return { ok: true, total: exps.length, enviados, pulados: exps.length - enviados, falhas };
}
