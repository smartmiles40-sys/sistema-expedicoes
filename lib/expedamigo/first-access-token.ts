/**
 * Token de PRIMEIRO ACESSO ao portal do ExpedAmigo (link mágico).
 *
 * Usado no onboarding automático (cron diário via n8n): em vez de mandar a senha
 * provisória em texto, mandamos um link `/amigo/acesso?t=<token>` que identifica o
 * passageiro e deixa ele criar a própria senha — sem depender do CPF (útil pra quem
 * comprou sem CPF: o próprio link pede o CPF no 1º acesso).
 *
 * HMAC-SHA256 com segredo do servidor. Validade longa (30 dias) porque o viajante
 * pode clicar dias depois. Só código de servidor importa este módulo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.N8N_SYNC_SECRET || "expedamigo-acesso-dev";
}
function assinar(b64: string): string {
  return createHmac("sha256", secret()).update(b64).digest("base64url");
}

/** Gera o token de 1º acesso (identifica a LINHA de passageiro). */
export function assinarTokenAcesso(passageiroId: string): string {
  const payload = { p: passageiroId, e: Date.now() + TTL_MS };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${assinar(b64)}`;
}

/** Valida o token (assinatura + validade). Retorna o passageiro_id, ou null. */
export function verificarTokenAcesso(token: string): { passageiroId: string } | null {
  const [b64, sig] = (token ?? "").split(".");
  if (!b64 || !sig) return null;
  const esperado = assinar(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { p: string; e: number };
    if (!p.p || typeof p.e !== "number" || Date.now() > p.e) return null;
    return { passageiroId: p.p };
  } catch {
    return null;
  }
}
