import { NextResponse } from "next/server";

/**
 * Automações DESATIVADAS por decisão do operacional — bloqueadas direto no app,
 * independente do que o n8n faça. Cada flag = uma rota que responde 403 (desativada).
 *
 * Pra REATIVAR qualquer uma: mude pra `false` e faça deploy.
 *
 * ⚠️ NÃO inclui a sync de passageiros do fan-out (`/api/bitrix/sync-contato` e
 * `/api/bitrix/sync-todas`) nem o health — essas continuam ativas.
 */
export const ROTA_DESATIVADA = {
  onboardingDiario: true, // /api/expedamigo/onboarding-diario (onboarding por WhatsApp)
  bitrixPassageiroSync: true, // /api/bitrix/passageiro-sync (sync por evento do Bitrix)
  bitrixExpedicaoSync: true, // /api/bitrix/expedicao-sync (expedição por evento do Bitrix)
  importarCompras: true, // /api/bitrix/importar-compras (base Clientes & compras)
} as const;

/** Resposta padrão de rota desativada (403). */
export function respostaRotaDesativada() {
  return NextResponse.json(
    { ok: false, disabled: true, error: "Rota desativada no sistema." },
    { status: 403 },
  );
}
