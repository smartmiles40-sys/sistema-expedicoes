"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";
import { mockExpedicoes } from "@/lib/mock-data";

/**
 * Dispara a sincronização dos passageiros desta expedição a partir do Bitrix.
 * NÃO fala com o Bitrix direto: chama um webhook do n8n (que já tem as credenciais
 * e o mapeamento do pipeline) passando o CÓDIGO da expedição. O n8n puxa só os deals
 * daquela coluna e faz upsert via /api/bitrix/passageiro-sync. Como a tabela de
 * passageiros tem realtime, as linhas aparecem/atualizam sozinhas em seguida.
 *
 * Config (env): N8N_SYNC_URL (URL do webhook) + N8N_SYNC_SECRET (segredo enviado no header).
 */
export async function sincronizarExpedicaoBitrix(
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeEditar(eu?.papel)) return { ok: false, error: "Seu perfil é somente leitura." };
  const url = process.env.N8N_SYNC_URL;
  if (!url) return { ok: false, error: "Integração não configurada (N8N_SYNC_URL ausente)." };

  // Resolve o código da expedição (é ele que o n8n usa pra achar a coluna no Bitrix).
  let codigo: string | null = null;
  if (DEV_USE_MOCK_DATA) {
    codigo = mockExpedicoes.find((e) => e.id === expedicaoId)?.codigo ?? null;
  } else {
    const sb = createServiceRoleClient();
    const { data } = await sb.from("expedicoes").select("codigo").eq("id", expedicaoId).maybeSingle();
    codigo = (data as { codigo: string } | null)?.codigo ?? null;
  }
  if (!codigo) return { ok: false, error: "Expedição sem código." };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": process.env.N8N_SYNC_SECRET ?? "" },
      body: JSON.stringify({ expedicao_codigo: codigo }),
    });
    if (!res.ok) return { ok: false, error: `O n8n respondeu ${res.status}.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar o n8n." };
  }
}
