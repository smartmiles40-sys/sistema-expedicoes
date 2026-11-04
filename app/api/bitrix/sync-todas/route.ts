import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";
import { isValidCronBearer } from "@/lib/security/secrets";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sincronizarTodasExpedicoesBitrix } from "@/lib/bitrix/sync-expedicao";

export const dynamic = "force-dynamic";

/**
 * Sincroniza os passageiros de TODAS as expedições ativas a partir do Bitrix
 * (fan-out para o webhook único do n8n). GET = cron (Bearer CRON_SECRET);
 * POST = chamada autenticada da UI (editor). O n8n continua com 1 só workflow.
 */
async function handler(req: NextRequest) {
  if (!DEV_AUTH_BYPASS) {
    if (req.method === "GET") {
      if (!isValidCronBearer(req.headers.get("authorization"))) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const user = await getCurrentUser();
      if (!podeEditar(user?.papel)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  if (DEV_USE_MOCK_DATA) {
    return NextResponse.json({ ok: true, total: 0, enviados: 0, pulados: 0, falhas: [], nota: "mock" });
  }

  const sb = createServiceRoleClient();
  const r = await sincronizarTodasExpedicoesBitrix(sb);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

export const GET = handler;
export const POST = handler;
