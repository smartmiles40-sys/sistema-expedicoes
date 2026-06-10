import { NextResponse } from "next/server";
import { DEV_AUTH_BYPASS } from "@/lib/dev-mode";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!DEV_AUTH_BYPASS) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true });
}
