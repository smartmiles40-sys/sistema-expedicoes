import { describe, it, expect } from "vitest";
import { passageiroSyncSchema, expedicaoSyncSchema } from "./validators";

describe("passageiroSyncSchema", () => {
  const valido = {
    bitrix_deal_id: "123",
    expedicao_codigo: "PERU-AGO26",
    estagio_deal: "WON",
    nome_completo: "Maria Souza",
  };

  it("aceita um payload mínimo válido", () => {
    const r = passageiroSyncSchema.safeParse(valido);
    expect(r.success).toBe(true);
  });

  it("aceita campos opcionais nulos", () => {
    const r = passageiroSyncSchema.safeParse({
      ...valido,
      email: null,
      cpf: null,
      voo_nacional_necessario: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita quando faltam campos obrigatórios", () => {
    expect(passageiroSyncSchema.safeParse({}).success).toBe(false);
    const semNome = { ...valido } as Record<string, unknown>;
    delete semNome.nome_completo;
    expect(passageiroSyncSchema.safeParse(semNome).success).toBe(false);
  });

  it("rejeita bitrix_deal_id vazio", () => {
    expect(passageiroSyncSchema.safeParse({ ...valido, bitrix_deal_id: "" }).success).toBe(false);
  });

  it("rejeita email com formato inválido", () => {
    expect(passageiroSyncSchema.safeParse({ ...valido, email: "nao-eh-email" }).success).toBe(false);
  });

  it("aceita email válido", () => {
    const r = passageiroSyncSchema.safeParse({ ...valido, email: "maria@exemplo.com" });
    expect(r.success).toBe(true);
  });
});

describe("expedicaoSyncSchema", () => {
  const valido = {
    bitrix_pipeline_id: "10",
    codigo: "PERU-AGO26",
    nome: "Peru – Agosto 2026",
    destino: "Peru",
    data_embarque: "2026-08-10",
    data_retorno: "2026-08-20",
  };

  it("aceita um payload mínimo válido", () => {
    expect(expedicaoSyncSchema.safeParse(valido).success).toBe(true);
  });

  it("aceita números opcionais não-negativos", () => {
    const r = expedicaoSyncSchema.safeParse({ ...valido, pax_planejados: 20, preco_venda_brl: 15000 });
    expect(r.success).toBe(true);
  });

  it("rejeita pax_planejados negativo ou fracionário", () => {
    expect(expedicaoSyncSchema.safeParse({ ...valido, pax_planejados: -1 }).success).toBe(false);
    expect(expedicaoSyncSchema.safeParse({ ...valido, pax_planejados: 2.5 }).success).toBe(false);
  });

  it("rejeita preco_venda_brl negativo", () => {
    expect(expedicaoSyncSchema.safeParse({ ...valido, preco_venda_brl: -100 }).success).toBe(false);
  });

  it("rejeita quando falta um campo obrigatório", () => {
    const semDestino = { ...valido } as Record<string, unknown>;
    delete semDestino.destino;
    expect(expedicaoSyncSchema.safeParse(semDestino).success).toBe(false);
  });
});
