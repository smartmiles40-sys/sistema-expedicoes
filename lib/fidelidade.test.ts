import { describe, it, expect } from "vitest";
import {
  construirPosicoesFidelidade,
  ehMarco,
  ordinalFem,
  nivelFidelidade,
  MARCOS_FIDELIDADE,
} from "./fidelidade";
import type { PessoaAgregada } from "@/lib/data/pessoas";

// A função só lê `expedicoes`; montamos pessoas mínimas e casteamos.
function pessoa(expedicoes: Array<{
  expedicao_id: string;
  passageiro_id: string;
  data_embarque: string;
  status_reserva?: string;
}>): PessoaAgregada {
  return {
    expedicoes: expedicoes.map((e) => ({
      expedicao_id: e.expedicao_id,
      passageiro_id: e.passageiro_id,
      nome: "Exp " + e.expedicao_id,
      destino: "X",
      data_embarque: e.data_embarque,
      status_reserva: e.status_reserva ?? "Confirmado",
      tipo: "Pagante",
    })),
  } as unknown as PessoaAgregada;
}

describe("ehMarco", () => {
  it("reconhece 3, 5 e 10 como marcos", () => {
    expect(ehMarco(3)).toBe(true);
    expect(ehMarco(5)).toBe(true);
    expect(ehMarco(10)).toBe(true);
  });
  it("rejeita não-marcos e nulos", () => {
    expect(ehMarco(1)).toBe(false);
    expect(ehMarco(2)).toBe(false);
    expect(ehMarco(4)).toBe(false);
    expect(ehMarco(11)).toBe(false);
    expect(ehMarco(null)).toBe(false);
    expect(ehMarco(undefined)).toBe(false);
  });
  it("MARCOS_FIDELIDADE é [3,5,10]", () => {
    expect([...MARCOS_FIDELIDADE]).toEqual([3, 5, 10]);
  });
});

describe("ordinalFem", () => {
  it("formata ordinal feminino", () => {
    expect(ordinalFem(1)).toBe("1ª");
    expect(ordinalFem(10)).toBe("10ª");
  });
});

describe("nivelFidelidade", () => {
  it("tiers por total de viagens", () => {
    expect(nivelFidelidade(0).tier).toBe("Estreante");
    expect(nivelFidelidade(1).tier).toBe("Viajante");
    expect(nivelFidelidade(3).tier).toBe("Explorador");
    expect(nivelFidelidade(5).tier).toBe("Aventureiro");
    expect(nivelFidelidade(12).tier).toBe("Lenda");
  });
  it("próximo marco e quanto falta", () => {
    expect(nivelFidelidade(0).proximo).toBe(3);
    expect(nivelFidelidade(0).faltam).toBe(3);
    expect(nivelFidelidade(4).proximo).toBe(5);
    expect(nivelFidelidade(4).faltam).toBe(1);
    expect(nivelFidelidade(10).proximo).toBeNull();
    expect(nivelFidelidade(10).progresso).toBe(1);
  });
  it("conquistados acumulam", () => {
    expect(nivelFidelidade(2).conquistados).toEqual([]);
    expect(nivelFidelidade(5).conquistados).toEqual([3, 5]);
    expect(nivelFidelidade(10).conquistados).toEqual([3, 5, 10]);
  });
  it("progresso dentro da faixa (0..1)", () => {
    // 4 viagens: faixa 3→5, progresso (4-3)/(5-3)=0.5
    expect(nivelFidelidade(4).progresso).toBeCloseTo(0.5);
  });
});

describe("construirPosicoesFidelidade", () => {
  it("ordena por data de embarque (1ª = mais antiga)", () => {
    const pessoas = [
      pessoa([
        { expedicao_id: "B", passageiro_id: "pax-B", data_embarque: "2025-08-01" },
        { expedicao_id: "A", passageiro_id: "pax-A", data_embarque: "2023-03-01" },
        { expedicao_id: "C", passageiro_id: "pax-C", data_embarque: "2026-01-01" },
      ]),
    ];
    expect(construirPosicoesFidelidade(pessoas, "A")["pax-A"]).toBe(1);
    expect(construirPosicoesFidelidade(pessoas, "B")["pax-B"]).toBe(2);
    expect(construirPosicoesFidelidade(pessoas, "C")["pax-C"]).toBe(3);
  });

  it("ignora participações canceladas na contagem", () => {
    const pessoas = [
      pessoa([
        { expedicao_id: "A", passageiro_id: "pax-A", data_embarque: "2023-01-01" },
        { expedicao_id: "B", passageiro_id: "pax-B", data_embarque: "2024-01-01", status_reserva: "Cancelado" },
        { expedicao_id: "C", passageiro_id: "pax-C", data_embarque: "2025-01-01" },
      ]),
    ];
    const pos = construirPosicoesFidelidade(pessoas, "C");
    expect(pos["pax-C"]).toBe(2); // B cancelada não conta → C é a 2ª
    expect(construirPosicoesFidelidade(pessoas, "B")["pax-B"]).toBeUndefined();
  });

  it("desempata por expedicao_id quando a data é igual", () => {
    const pessoas = [
      pessoa([
        { expedicao_id: "ZZZ", passageiro_id: "pax-Z", data_embarque: "2026-06-01" },
        { expedicao_id: "AAA", passageiro_id: "pax-A", data_embarque: "2026-06-01" },
      ]),
    ];
    expect(construirPosicoesFidelidade(pessoas, "AAA")["pax-A"]).toBe(1);
    expect(construirPosicoesFidelidade(pessoas, "ZZZ")["pax-Z"]).toBe(2);
  });

  it("mapeia várias pessoas pela linha desta expedição", () => {
    const pessoas = [
      pessoa([{ expedicao_id: "X", passageiro_id: "pax-1", data_embarque: "2026-01-01" }]),
      pessoa([
        { expedicao_id: "W", passageiro_id: "pax-2w", data_embarque: "2023-01-01" },
        { expedicao_id: "X", passageiro_id: "pax-2x", data_embarque: "2026-01-01" },
      ]),
    ];
    const pos = construirPosicoesFidelidade(pessoas, "X");
    expect(pos["pax-1"]).toBe(1); // primeira viagem da pessoa 1
    expect(pos["pax-2x"]).toBe(2); // segunda viagem da pessoa 2
  });
});
