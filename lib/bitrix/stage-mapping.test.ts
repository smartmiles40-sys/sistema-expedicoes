import { describe, it, expect } from "vitest";
import { mapBitrixStage, BITRIX_STAGE_MAP } from "./stage-mapping";

describe("mapBitrixStage", () => {
  it("mapeia estágios conhecidos para o status_reserva correto", () => {
    expect(mapBitrixStage("NEW")).toBe("Lead");
    expect(mapBitrixStage("PROPOSAL")).toBe("Pré-reserva");
    expect(mapBitrixStage("WON")).toBe("Confirmado");
    expect(mapBitrixStage("LOST")).toBe("Cancelado");
  });

  it("mapeia IDs numéricos de estágio", () => {
    expect(mapBitrixStage("1")).toBe("Lead");
    expect(mapBitrixStage("2")).toBe("Pré-reserva");
    expect(mapBitrixStage("4")).toBe("Confirmado");
    expect(mapBitrixStage("5")).toBe("Cancelado");
  });

  it("é case-insensitive e ignora espaços em volta", () => {
    expect(mapBitrixStage("won")).toBe("Confirmado");
    expect(mapBitrixStage("  Lost  ")).toBe("Cancelado");
    expect(mapBitrixStage("Proposal")).toBe("Pré-reserva");
  });

  it("usa fallback 'Lead' para valores nulos/vazios/desconhecidos", () => {
    expect(mapBitrixStage(null)).toBe("Lead");
    expect(mapBitrixStage(undefined)).toBe("Lead");
    expect(mapBitrixStage("")).toBe("Lead");
    expect(mapBitrixStage("ESTAGIO_QUE_NAO_EXISTE")).toBe("Lead");
  });

  it("todos os valores do mapa são status_reserva válidos", () => {
    const validos = new Set(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]);
    for (const status of Object.values(BITRIX_STAGE_MAP)) {
      expect(validos.has(status)).toBe(true);
    }
  });
});
