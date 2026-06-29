"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  mockPassageiros, mockExpedicoes, mockLinksExpedicao, mockQuartos, mockAlocacoes,
} from "@/lib/mock-data";
import { fetchAllRows } from "@/lib/data/expedicoes";
import { soDigitosCpf } from "@/lib/cpf";
import type {
  PassageiroRow, ExpedicaoRow, LinkExpedicaoRow, QuartoRow, AlocacaoQuartoRow,
} from "@/types/database";

/**
 * Portal do ExpedAmigo (passageiro). Acesso público por CPF + data de
 * nascimento, só leitura. Mostra APENAS expedições futuras da pessoa, com a
 * cara de um produto do viajante (sem nada do sistema operacional interno).
 */

export type AmigoVoo = {
  voo_interno_necessario: boolean;
  companhia: string | null;
  localizador: string | null;
};
export type AmigoLink = { label: string; url: string };
export type AmigoQuarto = {
  numero: string;
  tipo: string;
  hotel_cidade: string | null;
  check_in: string | null;
  check_out: string | null;
};
export type AmigoExpedicao = {
  id: string;
  nome: string;
  destino: string;
  data_embarque: string;
  data_retorno: string;
  status: string;
  voo: AmigoVoo;
  links: AmigoLink[];
  quartos: AmigoQuarto[];
};
export type AmigoDados = {
  nome: string;
  primeiro_nome: string;
  expedicoes: AmigoExpedicao[];
};

export async function entrarExpedAmigo(
  cpfRaw: string,
  nascimentoRaw: string,
): Promise<{ ok: true; dados: AmigoDados } | { ok: false; error: string }> {
  const cpf = soDigitosCpf(cpfRaw ?? "");
  const nasc = (nascimentoRaw ?? "").slice(0, 10);
  if (cpf.length !== 11) return { ok: false, error: "Digite um CPF válido (11 dígitos)." };
  if (!nasc) return { ok: false, error: "Informe sua data de nascimento." };

  let pax: PassageiroRow[];
  let exps: ExpedicaoRow[];
  let links: LinkExpedicaoRow[];
  let quartos: QuartoRow[];
  let alocacoes: AlocacaoQuartoRow[];

  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros;
    exps = mockExpedicoes;
    links = mockLinksExpedicao;
    quartos = mockQuartos;
    alocacoes = mockAlocacoes;
  } else {
    const sb = createServiceRoleClient();
    const [paxAll, er, linkAll, qAll, alocAll] = await Promise.all([
      fetchAllRows<PassageiroRow>((from, to) => sb.from("passageiros").select("*").order("id").range(from, to)),
      sb.from("expedicoes").select("*"),
      fetchAllRows<LinkExpedicaoRow>((from, to) => sb.from("links_expedicao").select("*").order("id").range(from, to)),
      fetchAllRows<QuartoRow>((from, to) => sb.from("quartos").select("*").order("id").range(from, to)),
      fetchAllRows<AlocacaoQuartoRow>((from, to) => sb.from("passageiro_quarto").select("*").order("id").range(from, to)),
    ]);
    pax = paxAll;
    exps = (er.data ?? []) as ExpedicaoRow[];
    links = linkAll;
    quartos = qAll;
    alocacoes = alocAll;
  }

  // 1) Acha as linhas da pessoa pelo CPF.
  const minhasRows = pax.filter((p) => soDigitosCpf(p.cpf ?? "") === cpf);
  if (minhasRows.length === 0) {
    return { ok: false, error: "Não encontramos seu cadastro com este CPF. Fale com a agência." };
  }

  // 2) Confere a data de nascimento (senha). Bloqueia quem não tem nascimento.
  const ordenadas = [...minhasRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const nascCadastro = ordenadas.find((p) => p.data_nascimento)?.data_nascimento?.slice(0, 10) ?? null;
  if (!nascCadastro) {
    return { ok: false, error: "Seu cadastro está sem data de nascimento. Fale com a agência para liberar seu acesso." };
  }
  if (nascCadastro !== nasc) {
    return { ok: false, error: "Data de nascimento não confere com o cadastro." };
  }

  const nome = ordenadas[0].nome_completo;

  // 3) Só expedições futuras (embarque hoje em diante) e não-canceladas.
  const hoje = new Date().toISOString().slice(0, 10);
  const expById = new Map(exps.map((e) => [e.id, e]));
  const quartoById = new Map(quartos.map((q) => [q.id, q]));

  const expedicoes: AmigoExpedicao[] = [];
  for (const row of minhasRows) {
    if (!row.expedicao_id || row.status_reserva === "Cancelado") continue;
    const e = expById.get(row.expedicao_id);
    if (!e) continue;
    if ((e.data_embarque ?? "").slice(0, 10) < hoje) continue;

    const meusQuartos = alocacoes
      .filter((a) => a.passageiro_id === row.id)
      .map((a) => quartoById.get(a.quarto_id))
      .filter((q): q is QuartoRow => !!q)
      .map<AmigoQuarto>((q) => ({
        numero: q.numero,
        tipo: q.tipo,
        hotel_cidade: q.hotel_cidade,
        check_in: q.check_in,
        check_out: q.check_out,
      }));

    expedicoes.push({
      id: e.id,
      nome: e.nome,
      destino: e.destino,
      data_embarque: e.data_embarque,
      data_retorno: e.data_retorno,
      status: e.status,
      voo: {
        voo_interno_necessario: row.voo_nacional_necessario,
        companhia: row.companhia_aerea,
        localizador: row.localizador,
      },
      links: links
        .filter((l) => l.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((l) => ({ label: l.label, url: l.url })),
      quartos: meusQuartos,
    });
  }

  if (expedicoes.length === 0) {
    return { ok: false, error: "Você ainda não tem uma viagem futura por aqui. Fale com a agência." };
  }

  // Mais próxima primeiro.
  expedicoes.sort((a, b) => (a.data_embarque ?? "").localeCompare(b.data_embarque ?? ""));

  return {
    ok: true,
    dados: { nome, primeiro_nome: nome.split(" ")[0], expedicoes },
  };
}
