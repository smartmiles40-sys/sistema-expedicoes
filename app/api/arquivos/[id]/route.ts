import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const BUCKET = "arquivos-expedicoes";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!DEV_AUTH_BYPASS) {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("arquivos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });
  const r = row as { storage_path: string };

  await supabase.storage.from(BUCKET).remove([r.storage_path]);
  const { error } = await supabase.from("arquivos").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
