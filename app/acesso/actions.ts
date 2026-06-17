"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_AUTH_COOKIE, tokenAcesso, tokenDeSenha } from "@/lib/site-auth";

export async function entrar(formData: FormData) {
  const senha = String(formData.get("senha") ?? "");
  const nextRaw = String(formData.get("next") ?? "/");
  // só permite redirect interno (evita open-redirect)
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const esperado = await tokenAcesso();
  if (!esperado) redirect(next); // gate desligado

  const informado = await tokenDeSenha(senha);
  if (informado !== esperado) {
    redirect(`/acesso?erro=1&next=${encodeURIComponent(next)}`);
  }

  const c = await cookies();
  c.set(SITE_AUTH_COOKIE, esperado, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  redirect(next);
}
