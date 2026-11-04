/**
 * Link mágico de acesso ao ExpedAmigo (1º acesso / reset de senha).
 *
 * Em vez de gerar uma senha provisória aleatória, o operacional gera um LINK que
 * leva o viajante a `/amigo/acesso?t=…` (ou ao link curto `/a/<codigo>`), onde ele
 * cria a própria senha SEM precisar de senha anterior (o token já autentica).
 *
 * Reaproveitado pelo onboarding diário (n8n) e pelos botões de admin (liberar/reset).
 * Só código de servidor importa este módulo.
 */
import "server-only";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import type { createServiceRoleClient } from "@/lib/supabase/admin";
import { assinarTokenAcesso } from "@/lib/expedamigo/first-access-token";

type Sb = ReturnType<typeof createServiceRoleClient>;

/** Código curto (sem caracteres ambíguos) pro link /a/<codigo>. */
export function gerarCodigoCurto(n = 10): string {
  const alfa = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += alfa[b[i] % alfa.length];
  return s;
}

/**
 * Base URL do portal: NEXT_PUBLIC_SITE_URL quando definido; senão deriva dos
 * headers da request (server action). Sem barra no fim.
 */
export async function baseUrlPortal(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/**
 * Cria o link CURTO (grava um código em `acesso_links`, válido 30 dias); se o
 * insert falhar, cai no link longo por token (`/amigo/acesso?t=…`).
 */
export async function criarLinkAcesso(sb: Sb, passageiroId: string, base: string): Promise<string> {
  const expira_em = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  for (let i = 0; i < 4; i++) {
    const codigo = gerarCodigoCurto();
    const { error } = await sb.from("acesso_links").insert({ codigo, passageiro_id: passageiroId, expira_em });
    if (!error) return `${base}/a/${codigo}`;
    if (!/duplicate|unique/i.test(error.message)) break; // colisão → tenta outro; outro erro → fallback
  }
  return `${base}/amigo/acesso?t=${assinarTokenAcesso(passageiroId)}`;
}
