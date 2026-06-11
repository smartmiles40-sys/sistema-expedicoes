import { describe, it, expect } from "vitest";
import {
  parseCSV,
  detectarDelimitador,
  normalizarData,
  parsePassageirosCSV,
  cpfDigitos,
} from "./passageiros-import";

describe("detectarDelimitador", () => {
  it("detecta ; quando predomina", () => {
    expect(detectarDelimitador("a;b;c\n1;2;3")).toBe(";");
  });
  it("usa , por padrão", () => {
    expect(detectarDelimitador("a,b,c")).toBe(",");
  });
});

describe("parseCSV", () => {
  it("respeita aspas com delimitador e escape interno", () => {
    const grade = parseCSV('nome,obs\n"Silva, João","disse ""oi"""');
    expect(grade).toEqual([
      ["nome", "obs"],
      ["Silva, João", 'disse "oi"'],
    ]);
  });
  it("ignora linhas vazias e BOM", () => {
    const grade = parseCSV("﻿a;b\n\n1;2\n");
    expect(grade).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("suporta campo multilinha entre aspas", () => {
    const grade = parseCSV('nome;obs\nMaria;"linha1\nlinha2"');
    expect(grade[1]).toEqual(["Maria", "linha1\nlinha2"]);
  });
});

describe("normalizarData", () => {
  it("aceita ISO", () => {
    expect(normalizarData("1990-05-12").iso).toBe("1990-05-12");
  });
  it("converte DD/MM/AAAA", () => {
    expect(normalizarData("12/05/1990").iso).toBe("1990-05-12");
  });
  it("expande ano de 2 dígitos", () => {
    expect(normalizarData("12/05/90").iso).toBe("1990-05-12");
    expect(normalizarData("12/05/10").iso).toBe("2010-05-12");
  });
  it("reporta data inválida", () => {
    expect(normalizarData("31/13/2020").erro).toBeTruthy();
  });
  it("vazio vira null sem erro", () => {
    expect(normalizarData("  ")).toEqual({ iso: null });
  });
});

describe("cpfDigitos", () => {
  it("extrai 11 dígitos", () => {
    expect(cpfDigitos("111.222.333-44")).toBe("11122233344");
  });
  it("rejeita tamanho errado", () => {
    expect(cpfDigitos("123")).toBeNull();
  });
});

describe("parsePassageirosCSV", () => {
  it("mapeia cabeçalhos com acento/caixa e normaliza dados", () => {
    const csv = [
      "Nome Completo;Data de Nascimento;CPF;Passaporte;Validade;E-mail;Telefone;Tipo",
      "Maria Souza;12/05/1990;111.222.333-44;FA123456;01/01/2030;maria@x.com;11999990000;Pagante",
    ].join("\n");
    const r = parsePassageirosCSV(csv);
    expect(r.erroGeral).toBeNull();
    expect(r.colunasReconhecidas).toContain("nome_completo");
    expect(r.linhas).toHaveLength(1);
    const d = r.linhas[0].dados;
    expect(d.nome_completo).toBe("Maria Souza");
    expect(d.data_nascimento).toBe("1990-05-12");
    expect(d.validade_passaporte).toBe("2030-01-01");
    expect(d.tipo).toBe("Pagante");
    expect(r.linhas[0].erros).toHaveLength(0);
  });

  it("acusa erro geral sem coluna de nome", () => {
    const r = parsePassageirosCSV("cpf;email\n123;a@b.com");
    expect(r.erroGeral).toMatch(/nome/i);
  });

  it("valida CPF, e-mail e nome por linha", () => {
    const csv = [
      "nome;cpf;email",
      ";123;foo", // sem nome, cpf curto, email inválido
      "João Lima;111.222.333-44;joao@x.com",
    ].join("\n");
    const r = parsePassageirosCSV(csv);
    expect(r.linhas[0].erros.length).toBeGreaterThanOrEqual(3);
    expect(r.linhas[1].erros).toHaveLength(0);
  });

  it("faz fallback de tipo/status inválidos", () => {
    const csv = "nome;tipo;status\nAna;Foo;Bar";
    const d = parsePassageirosCSV(csv).linhas[0].dados;
    expect(d.tipo).toBe("Pagante");
    expect(d.status_reserva).toBe("Lead");
  });
});
