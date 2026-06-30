"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  mockPassageiros, mockExpedicoes, mockLinksExpedicao, mockQuartos, mockAlocacoes,
  mockRoteiroDias, mockExpedicaoVoos, mockExpedicaoPasseios, mockExpedicaoInfo,
  mockRoteiroDiaFotos, mockExpedicaoAvisos,
} from "@/lib/mock-data";
import { fetchAllRows } from "@/lib/data/expedicoes";
import { soDigitosCpf } from "@/lib/cpf";
import type {
  PassageiroRow, ExpedicaoRow, LinkExpedicaoRow, QuartoRow, AlocacaoQuartoRow,
  RoteiroDiaRow, ExpedicaoVooRow, ExpedicaoPasseioRow, ExpedicaoInfoRow,
  RoteiroDiaFotoRow, ExpedicaoAvisoRow,
} from "@/types/database";

const BUCKET = "arquivos-expedicoes";

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
export type AmigoFoto = { url: string; legenda: string | null };
export type AmigoRoteiroDia = {
  id: string;
  dia: number;
  data: string | null;
  titulo: string;
  descricao: string | null;
  cidade: string | null;
  refeicoes: string | null;
  hospedagem: string | null;
  fotos: AmigoFoto[];
};
export type AmigoAviso = { tipo: string; titulo: string; conteudo: string };
export type AmigoVooGrupo = {
  trecho: string;
  companhia: string | null;
  numero_voo: string | null;
  origem: string | null;
  destino: string | null;
  partida: string | null;
  chegada: string | null;
  localizador: string | null;
  observacoes: string | null;
  voucher_url: string | null;
};
export type AmigoPasseio = {
  nome: string;
  data: string | null;
  horario: string | null;
  local: string | null;
  incluso: boolean;
  observacoes: string | null;
  voucher_url: string | null;
};
export type AmigoInfo = { titulo: string; conteudo: string };

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
  roteiro: AmigoRoteiroDia[];
  voos_grupo: AmigoVooGrupo[];
  passeios: AmigoPasseio[];
  info: AmigoInfo[];
  avisos: AmigoAviso[];
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
  let roteiro: RoteiroDiaRow[];
  let voosGrupo: ExpedicaoVooRow[];
  let passeios: ExpedicaoPasseioRow[];
  let infos: ExpedicaoInfoRow[];
  let avisosAll: ExpedicaoAvisoRow[];
  let rtFotos: RoteiroDiaFotoRow[];

  const sb = DEV_USE_MOCK_DATA ? null : createServiceRoleClient();

  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros;
    exps = mockExpedicoes;
    links = mockLinksExpedicao;
    quartos = mockQuartos;
    alocacoes = mockAlocacoes;
    roteiro = mockRoteiroDias;
    voosGrupo = mockExpedicaoVoos;
    passeios = mockExpedicaoPasseios;
    infos = mockExpedicaoInfo;
    avisosAll = mockExpedicaoAvisos;
    rtFotos = mockRoteiroDiaFotos;
  } else {
    const cli = sb!;
    const [paxAll, er, linkAll, qAll, alocAll, rtAll, voAll, psAll, inAll, avAll, ftAll] = await Promise.all([
      fetchAllRows<PassageiroRow>((from, to) => cli.from("passageiros").select("*").order("id").range(from, to)),
      cli.from("expedicoes").select("*"),
      fetchAllRows<LinkExpedicaoRow>((from, to) => cli.from("links_expedicao").select("*").order("id").range(from, to)),
      fetchAllRows<QuartoRow>((from, to) => cli.from("quartos").select("*").order("id").range(from, to)),
      fetchAllRows<AlocacaoQuartoRow>((from, to) => cli.from("passageiro_quarto").select("*").order("id").range(from, to)),
      fetchAllRows<RoteiroDiaRow>((from, to) => cli.from("roteiro_dias").select("*").order("id").range(from, to)),
      fetchAllRows<ExpedicaoVooRow>((from, to) => cli.from("expedicao_voos").select("*").order("id").range(from, to)),
      fetchAllRows<ExpedicaoPasseioRow>((from, to) => cli.from("expedicao_passeios").select("*").order("id").range(from, to)),
      fetchAllRows<ExpedicaoInfoRow>((from, to) => cli.from("expedicao_info").select("*").order("id").range(from, to)),
      fetchAllRows<ExpedicaoAvisoRow>((from, to) => cli.from("expedicao_avisos").select("*").order("id").range(from, to)),
      fetchAllRows<RoteiroDiaFotoRow>((from, to) => cli.from("roteiro_dia_fotos").select("*").order("id").range(from, to)),
    ]);
    pax = paxAll;
    exps = (er.data ?? []) as ExpedicaoRow[];
    links = linkAll;
    quartos = qAll;
    alocacoes = alocAll;
    roteiro = rtAll;
    voosGrupo = voAll;
    passeios = psAll;
    infos = inAll;
    avisosAll = avAll;
    rtFotos = ftAll;
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

  // Resolve as URLs dos arquivos (fotos do roteiro + vouchers de voo/passeio) das
  // expedições futuras da pessoa: signed URL (prod) ou rota de download do mock (dev).
  const fotoUrl = new Map<string, string>(); // arquivo_id -> url
  {
    const expIdsFuturas = new Set<string>();
    for (const row of minhasRows) {
      if (!row.expedicao_id || row.status_reserva === "Cancelado") continue;
      const e = expById.get(row.expedicao_id);
      if (!e || (e.data_embarque ?? "").slice(0, 10) < hoje) continue;
      expIdsFuturas.add(row.expedicao_id);
    }
    const idsRelevantes = new Set<string>();
    for (const f of rtFotos) if (expIdsFuturas.has(f.expedicao_id)) idsRelevantes.add(f.arquivo_id);
    for (const v of voosGrupo) if (v.arquivo_id && expIdsFuturas.has(v.expedicao_id)) idsRelevantes.add(v.arquivo_id);
    for (const p of passeios) if (p.arquivo_id && expIdsFuturas.has(p.expedicao_id)) idsRelevantes.add(p.arquivo_id);

    if (DEV_USE_MOCK_DATA) {
      for (const id of idsRelevantes) fotoUrl.set(id, `/api/arquivos/${id}/download?inline=1`);
    } else if (sb && idsRelevantes.size > 0) {
      const ids = [...idsRelevantes];
      const { data: arqs } = await sb.from("arquivos").select("id,storage_path").in("id", ids);
      const pathById = new Map(
        ((arqs ?? []) as { id: string; storage_path: string }[]).map((a) => [a.id, a.storage_path]),
      );
      for (const id of ids) {
        const sp = pathById.get(id);
        if (!sp) continue;
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(sp, 3600);
        if (data?.signedUrl) fotoUrl.set(id, data.signedUrl);
      }
    }
  }

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
      roteiro: roteiro
        .filter((r) => r.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((r) => ({
          id: r.id, dia: r.dia, data: r.data, titulo: r.titulo, descricao: r.descricao,
          cidade: r.cidade, refeicoes: r.refeicoes, hospedagem: r.hospedagem,
          fotos: rtFotos
            .filter((f) => f.roteiro_dia_id === r.id)
            .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
            .map((f) => ({ url: fotoUrl.get(f.arquivo_id) ?? "", legenda: f.legenda }))
            .filter((x) => x.url),
        })),
      voos_grupo: voosGrupo
        .filter((v) => v.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((v) => ({
          trecho: v.trecho, companhia: v.companhia, numero_voo: v.numero_voo,
          origem: v.origem, destino: v.destino, partida: v.partida, chegada: v.chegada,
          localizador: v.localizador, observacoes: v.observacoes,
          voucher_url: v.arquivo_id ? fotoUrl.get(v.arquivo_id) ?? null : null,
        })),
      passeios: passeios
        .filter((p) => p.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((p) => ({
          nome: p.nome, data: p.data, horario: p.horario, local: p.local,
          incluso: p.incluso, observacoes: p.observacoes,
          voucher_url: p.arquivo_id ? fotoUrl.get(p.arquivo_id) ?? null : null,
        })),
      info: infos
        .filter((i) => i.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((i) => ({ titulo: i.titulo, conteudo: i.conteudo })),
      avisos: avisosAll
        .filter((a) => a.expedicao_id === e.id)
        .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
        .map((a) => ({ tipo: a.tipo, titulo: a.titulo, conteudo: a.conteudo })),
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
