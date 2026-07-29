"use server";
import { revalidatePath } from "next/cache";
import { sincronizarTaxas, type SyncCambiosResult } from "@/lib/cambio/sync";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";

/**
 * Sincroniza as taxas de câmbio (botão "Atualizar agora").
 *
 * É um server action — roda no mesmo contexto do server component da página,
 * então a mutação do mock é visível na próxima renderização (o route handler
 * `/api/cambios/sync`, usado pelo cron, roda em outro bundle e por isso não
 * refletia em dev).
 */
export async function sincronizarCambios(): Promise<SyncCambiosResult> {
  const eu = await getCurrentUser();
  if (!podeEditar(eu?.papel)) return { ok: false, error: "Seu perfil é somente leitura." };
  const r = await sincronizarTaxas();
  if (r.ok) {
    revalidatePath("/cambios");
    revalidatePath("/dashboard");
  }
  return r;
}
