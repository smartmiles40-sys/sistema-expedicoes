import { describe, it, expect } from "vitest";
import { cpfValido, soDigitosCpf, formatarCpf } from "./cpf";

describe("cpfValido", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(cpfValido("111.222.333-44")).toBe(false);
    expect(cpfValido("123.456.789-00")).toBe(false);
  });

  it("rejeita tamanho errado e todos iguais", () => {
    expect(cpfValido("123")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
    expect(cpfValido("")).toBe(false);
    expect(cpfValido(null)).toBe(false);
  });
});

describe("soDigitosCpf / formatarCpf", () => {
  it("extrai dígitos", () => {
    expect(soDigitosCpf("111.444.777-35")).toBe("11144477735");
  });
  it("formata 11 dígitos", () => {
    expect(formatarCpf("11144477735")).toBe("111.444.777-35");
  });
});
