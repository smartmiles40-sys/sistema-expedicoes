import type { StatusReserva } from "@/types/database";

/**
 * Mapeamento de estágios do Bitrix24 → status_reserva interno.
 * O ID do estágio (UF_DEAL_STATUS / STAGE_ID) varia por pipeline; ajuste por agência.
 *
 * Convenção sugerida no Bitrix:
 *   NEW / LEAD / PREPARATION  → Lead
 *   PROPOSAL / NEGOTIATION    → Pré-reserva
 *   WON / SIGNED              → Confirmado
 *   LOST / CANCELED           → Cancelado
 */
export const BITRIX_STAGE_MAP: Record<string, StatusReserva> = {
  NEW: "Lead",
  LEAD: "Lead",
  PREPARATION: "Lead",
  "1": "Lead",

  PROPOSAL: "Pré-reserva",
  NEGOTIATION: "Pré-reserva",
  PRE_RESERVA: "Pré-reserva",
  "2": "Pré-reserva",
  "3": "Pré-reserva",

  WON: "Confirmado",
  SIGNED: "Confirmado",
  CONFIRMED: "Confirmado",
  "4": "Confirmado",

  LOST: "Cancelado",
  CANCELED: "Cancelado",
  CANCELLED: "Cancelado",
  REJECTED: "Cancelado",
  "5": "Cancelado",
};

export function mapBitrixStage(stageId: string | null | undefined): StatusReserva {
  if (!stageId) return "Lead";
  const upper = String(stageId).toUpperCase().trim();
  return BITRIX_STAGE_MAP[upper] ?? "Lead";
}
