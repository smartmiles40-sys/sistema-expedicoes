/**
 * Token curto e assinado que liga o **portal do ExpedAmigo** ao formulário de
 * inscrição. O portal já autenticou a pessoa (CPF + senha) — auth mais forte que
 * a data de nascimento —, então esse token deixa o `/inscricao?t=...` carregar os
 * dados dela DIRETO, pulando o portão de nascimento.
 *
 * HMAC-SHA256 com um segredo do servidor; validade curta (30 min). Só código de
 * servidor importa este módulo (usa node:crypto e o segredo).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { soDigitosCpf } from "@/lib/cpf";

const TTL_MS = 30 * 60 * 1000; // 30 minutos

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.N8N_SYNC_SECRET || "expedamigo-token-dev";
}
function assinar(b64: string): string {
  return createHmac("sha256", secret()).update(b64).digest("base64url");
}

/** Gera o token (payload base64url + assinatura). */
export function assinarTokenInscricao(cpf: string, expedicaoId: string): string {
  const payload = { c: soDigitosCpf(cpf ?? ""), x: expedicaoId, e: Date.now() + TTL_MS };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${assinar(b64)}`;
}

/** Valida o token (assinatura + validade). Retorna cpf + expedição, ou null. */
export function verificarTokenInscricao(token: string): { cpf: string; expedicaoId: string } | null {
  const [b64, sig] = (token ?? "").split(".");
  if (!b64 || !sig) return null;
  const esperado = assinar(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { c: string; x: string; e: number };
    if (!p.c || !p.x || typeof p.e !== "number" || Date.now() > p.e) return null;
    return { cpf: p.c, expedicaoId: p.x };
  } catch {
    return null;
  }
}
