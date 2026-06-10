import { describe, it, expect } from "vitest";
import { extractCustom } from "./mapping";

describe("extractCustom", () => {
  it("extrai um campo custom presente como string", () => {
    const obj = { UF_CRM_CPF: "123.456.789-00" };
    expect(extractCustom(obj, "CPF")).toBe("123.456.789-00");
  });

  it("pega o primeiro elemento quando o campo é multivalor (array)", () => {
    const obj = { UF_CRM_PASSAPORTE: ["AB123456", "CD789012"] };
    expect(extractCustom(obj, "PASSAPORTE")).toBe("AB123456");
  });

  it("retorna null para campo ausente", () => {
    expect(extractCustom({}, "CPF")).toBeNull();
  });

  it("retorna null quando o valor é null ou undefined", () => {
    expect(extractCustom({ UF_CRM_CPF: null }, "CPF")).toBeNull();
    expect(extractCustom({ UF_CRM_CPF: undefined }, "CPF")).toBeNull();
  });

  it("retorna null para array vazio", () => {
    expect(extractCustom({ UF_CRM_PASSAPORTE: [] }, "PASSAPORTE")).toBeNull();
  });
});
