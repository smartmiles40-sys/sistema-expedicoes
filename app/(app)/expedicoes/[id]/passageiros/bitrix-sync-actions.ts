"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";
import { mockExpedicoes } from "@/lib/mock-data";
import { dispararSyncExpedicaoN8n } from "@/lib/bitrix/sync-expedicao";

/**
 * Dispara a sincronização dos passageiros desta expedição a partir do Bitrix.
 * NÃO fala com o Bitrix direto: chama o webhook ÚNICO do n8n passando o CÓDIGO +
 * a ETAPA do Bitrix (`bitrix_stage_id`) guardada na expedição. O n8n filtra os deals
 * daquela coluna e faz upsert via /api/bitrix/sync-contato. Como a tabela de
 * passageiros tem realtime, as linhas aparecem/atualizam sozinhas em seguida.
 *
 * Config (env): N8N_SYNC_URL (URL do webhook) + N8N_SYNC_SECRET (segredo no header).
 */
export async function sincronizarExpedicaoBitrix(
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeEditar(eu?.papel)) return { ok: false, error: "Seu perfil é somente leitura." };

  // Resolve código + etapa do Bitrix (é o que o n8n usa pra achar a coluna).
  let codigo: string | null = null;
  let stageId: string | null = null;
  if (DEV_USE_MOCK_DATA) {
    codigo = mockExpedicoes.find((e) => e.id === expedicaoId)?.codigo ?? null;
  } else {
    const sb = createServiceRoleClient();
    const { data } = await sb.from("expedicoes").select("codigo, bitrix_stage_id").eq("id", expedicaoId).maybeSingle();
    codigo = (data as { codigo: string } | null)?.codigo ?? null;
    stageId = (data as { bitrix_stage_id: string | null } | null)?.bitrix_stage_id ?? null;
  }
  if (!codigo) return { ok: false, error: "Expedição sem código." };
  if (!DEV_USE_MOCK_DATA && !stageId) {
    return { ok: false, error: "Configure a Etapa do Bitrix (STAGE_ID) na expedição antes de sincronizar." };
  }
  if (DEV_USE_MOCK_DATA) return { ok: true };

  return dispararSyncExpedicaoN8n({ codigo, stageId });
}
