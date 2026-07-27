import { NextRequest, NextResponse } from "next/server";
import { passageiroSyncSchema } from "@/lib/bitrix/validators";
import { upsertPassageiroBitrix } from "@/lib/bitrix/upsert-passageiro";
import { isValidWebhookSecret } from "@/lib/security/secrets";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req.headers.get("x-webhook-secret"))) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = passageiroSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const r = await upsertPassageiroBitrix(parsed.data);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, passageiro_id: r.passageiro_id, action: r.action });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
