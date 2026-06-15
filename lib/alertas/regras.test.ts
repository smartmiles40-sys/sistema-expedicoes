import { describe, it, expect } from "vitest";
import { avaliarAlerta, regraDoTipo } from "./regras";

describe("avaliarAlerta", () => {
  it("não alerta quando resolvido (ok) ou n/a", () => {
    expect(avaliarAlerta("Passaporte", "ok", 30)).toBeNull();
    expect(avaliarAlerta("Passaporte", "na", 30)).toBeNull();
  });

  it("passaporte pendente a 60 dias dispara (exemplo do usuário)", () => {
    expect(avaliarAlerta("Passaporte", "bloqueio", 60)).toBe("critico");
    expect(avaliarAlerta("Passaporte", "atencao", 45)).toBe("atencao");
  });

  it("passaporte aparece em qualquer distância (sem janela)", () => {
    expect(avaliarAlerta("Passaporte", "bloqueio", 90)).toBe("critico");
    expect(avaliarAlerta("Passaporte", "atencao", 300)).toBe("atencao");
  });

  it("tipos com janela finita não disparam fora dela (visto a 90 dias)", () => {
    expect(avaliarAlerta("Visto", "bloqueio", 90)).toBeNull();
    expect(avaliarAlerta("Visto", "bloqueio", 60)).toBe("critico");
  });

  it("não dispara para expedições passadas (dias negativos) ou sem data", () => {
    expect(avaliarAlerta("Passaporte", "bloqueio", -5)).toBeNull();
    expect(avaliarAlerta("Passaporte", "bloqueio", null)).toBeNull();
  });

  it("pagamento só entra na janela mais curta (30 dias)", () => {
    expect(avaliarAlerta("Pagamento", "bloqueio", 45)).toBeNull();
    expect(avaliarAlerta("Pagamento", "bloqueio", 20)).toBe("critico");
  });

  it("mapeia severidade: bloqueio->critico, atencao->atencao", () => {
    expect(avaliarAlerta("Seguro", "bloqueio", 10)).toBe("critico");
    expect(avaliarAlerta("Seguro", "atencao", 10)).toBe("atencao");
  });

  it("regraDoTipo devolve a janela configurada", () => {
    expect(regraDoTipo("Passaporte")?.janelaDias).toBe(Infinity);
    expect(regraDoTipo("Pagamento")?.janelaDias).toBe(30);
  });
});
