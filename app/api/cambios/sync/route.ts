import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isValidCronBearer } from "@/lib/security/secrets";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sincronizarTaxas } from "@/lib/cambio/sync";
import type { AnyClient } from "@/lib/supabase/typed";

export const dynamic = "force-dynamic";

/**
 * Sincronização de câmbios para o cron (GET com Bearer) e chamadas autenticadas.
 * O botão "Atualizar agora" da UI NÃO usa esta rota — usa o server action
 * `sincronizarCambios`, pois a mutação do mock precisa rodar no mesmo bundle
 * da página. Aqui o núcleo é o mesmo (`sincronizarTaxas`).
 */
async function handler(req: NextRequest) {
  if (!DEV_AUTH_BYPASS) {
    if (req.method === "GET") {
      if (!isValidCronBearer(req.headers.get("authorization"))) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  // Cron não tem sessão de usuário: usa service role pra furar a RLS no upsert.
  // Em modo mock o client é ignorado pelo núcleo.
  const client = DEV_USE_MOCK_DATA
    ? undefined
    : (createServiceRoleClient() as unknown as AnyClient);
  const r = await sincronizarTaxas(client);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

export const GET = handler;
export const POST = handler;
