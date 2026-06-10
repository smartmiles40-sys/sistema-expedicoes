"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { DEV_AUTH_BYPASS } from "@/lib/dev-mode";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email() });

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "Email inválido" };

  if (DEV_AUTH_BYPASS) {
    return { ok: true };
  }

  const h = await headers();
  const origin = h.get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
