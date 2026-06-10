import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Comparação de strings em tempo constante (resistente a timing attack).
 *
 * Faz hash SHA-256 dos dois lados antes de comparar com `timingSafeEqual`.
 * Isso resolve dois problemas do `===`/`!==` simples:
 *   1. O tempo de comparação não vaza, byte a byte, o conteúdo do segredo.
 *   2. `timingSafeEqual` exige buffers do mesmo tamanho — o SHA-256 normaliza
 *      o comprimento, então também não vaza o tamanho do segredo esperado.
 *
 * Retorna `false` (em vez de lançar) quando algum lado não é string.
 */
export function timingSafeEqualStr(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Valida o header `x-webhook-secret` contra `process.env.WEBHOOK_SECRET`
 * em tempo constante. Retorna `false` se o segredo não estiver configurado.
 */
export function isValidWebhookSecret(received: string | null | undefined): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  return timingSafeEqualStr(received, expected);
}

/**
 * Valida o header `Authorization: Bearer <CRON_SECRET>` em tempo constante.
 * Retorna `false` se `CRON_SECRET` não estiver configurado.
 */
export function isValidCronBearer(authHeader: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return timingSafeEqualStr(authHeader, `Bearer ${secret}`);
}
