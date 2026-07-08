import { cache } from "react";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { daysUntil } from "@/lib/utils";
import { faseAtualChecklist } from "@/lib/constants";
import {
  mockExpedicoes,
  mockPassageiros,
  mockCustos,
  mockPagamentos,
  mockChecklistItens,
  mockDocumentos,
  mockQuartos,
  mockAlocacoes,
  mockUsuarios,
  mockLinksExpedicao,
  mockRoteiroDias,
  mockExpedicaoVoos,
  mockExpedicaoPasseios,
  mockExpedicaoInfo,
  mockRoteiroDiaFotos,
  mockExpedicaoAvisos,
  mockPassageiroRequisitos,
  getExpedicoesComAgregados,
} from "@/lib/mock-data";
import { avaliarProntidao, type ResultadoProntidao } from "@/lib/prontidao/regras";
import { avaliarAlerta, regraDoTipo, type SeveridadeAlerta } from "@/lib/alertas/regras";
import type { TipoRequisito } from "@/types/database";
import type {
  Tables,
  ExpedicaoComAgregados,
  ExpedicaoRow,
  PassageiroRow,
  PassageiroRequisitoRow,
  CustoRow,
  PagamentoRow,
  ChecklistItemRow,
  DocumentoRow,
  QuartoRow,
  AlocacaoQuartoRow,
  UsuarioRow,
  LinkExpedicaoRow,
  RoteiroDiaRow,
  ExpedicaoVooRow,
  ExpedicaoPasseioRow,
  ExpedicaoInfoRow,
  RoteiroDiaFotoRow,
  ExpedicaoAvisoRow,
  RoteiroLiderDiaRow,
  EtapaChecklist,
  Prontidao,
} from "@/types/database";

export async function listExpedicoesComAgregados(): Promise<ExpedicaoComAgregados[]> {
  if (DEV_USE_MOCK_DATA) return getExpedicoesComAgregados();

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("expedicoes")
    .select("*")
    .order("ordem", { ascending: true, nullsFirst: false })
    .order("data_embarque", { ascending: true });
  if (error) throw error;
  return agregarExpedicoes(supabase, (data ?? []) as ExpedicaoRow[]);
}

/**
 * Busca TODAS as linhas paginando de 1000 em 1000. O PostgREST (Supabase) corta
 * em 1000 linhas por padrão, o que truncava SILENCIOSAMENTE os fetches globais
 * (ex.: `passageiro_requisitos`) e bagunçava os agregados de prontidão quando a
 * base passou de 1000 requisitos. Ordena por `id` pra paginação ser consistente.
 */
export async function fetchAllRows<T>(
  pagina: (from: number, to: number) => PromiseLike<{ data: unknown }>,
): Promise<T[]> {
  const TAM = 1000;
  const todas: T[] = [];
  for (let from = 0; ; from += TAM) {
    const { data } = await pagina(from, from + TAM - 1);
    const linhas = (data ?? []) as T[];
    todas.push(...linhas);
    if (linhas.length < TAM) break;
  }
  return todas;
}

/**
 * Calcula os agregados (pax confirmados, custo, margem, pagamentos vencidos,
 * docs pendentes, responsáveis) de um conjunto de expedições com poucas queries
 * em lote. Usado no modo Supabase por listExpedicoesComAgregados e
 * getExpedicaoComAgregados (no mock isso vem de lib/mock-data.ts).
 */
async function agregarExpedicoes(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  rows: ExpedicaoRow[],
): Promise<ExpedicaoComAgregados[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((e) => e.id);

  const [pax, requisitos, checklist, usuariosRes] = await Promise.all([
    fetchAllRows<PassageiroRow>((from, to) =>
      supabase.from("passageiros").select("*").in("expedicao_id", ids).order("id").range(from, to)),
    fetchAllRows<PassageiroRequisitoRow>((from, to) =>
      supabase.from("passageiro_requisitos").select("*").order("id").range(from, to)),
    fetchAllRows<{ expedicao_id: string; parent_id: string | null; status: string }>((from, to) =>
      supabase.from("checklist_itens").select("expedicao_id, parent_id, status").in("expedicao_id", ids).order("id").range(from, to)),
    supabase.from("usuarios").select("id, nome"),
  ]);
  const usuariosById = new Map(
    ((usuariosRes.data ?? []) as { id: string; nome: string }[]).map((u) => [u.id, u.nome]),
  );

  const reqPorPax = new Map<string, PassageiroRequisitoRow[]>();
  for (const r of requisitos) {
    const arr = reqPorPax.get(r.passageiro_id) ?? [];
    arr.push(r);
    reqPorPax.set(r.passageiro_id, arr);
  }

  return rows.map((e) => {
    const paxDaExp = pax.filter((p) => p.expedicao_id === e.id && p.status_reserva !== "Cancelado");
    // Ocupação conta só passageiros pagantes/cortesia — líderes (equipe) ficam fora.
    const pax_confirmados = paxDaExp.filter((p) => p.status_reserva === "Confirmado" && p.tipo !== "Líder").length;
    const docs_pendentes = paxDaExp.filter((p) => !p.passaporte).length;

    const prontidao_total = paxDaExp.length;
    const prontidao_aptos = paxDaExp.filter(
      (p) =>
        avaliarProntidao({
          passageiro: p,
          expedicao: e,
          destino: e.destino,
          requisitos: reqPorPax.get(p.id) ?? [],
        }).prontidao === "Apto",
    ).length;

    // % do checklist = processos-pai concluídos / total de processos-pai
    const processos = checklist.filter((c) => c.expedicao_id === e.id && !c.parent_id);
    const checklist_pct = processos.length
      ? processos.filter((c) => c.status === "Concluído").length / processos.length
      : 0;

    return {
      ...e,
      pax_confirmados,
      docs_pendentes,
      checklist_pct,
      prontidao_aptos,
      prontidao_total,
      responsavel_op_nome: e.responsavel_operacional_id
        ? usuariosById.get(e.responsavel_operacional_id) ?? null : null,
      responsavel_com_nome: e.responsavel_comercial_id
        ? usuariosById.get(e.responsavel_comercial_id) ?? null : null,
    };
  });
}

export async function getExpedicao(id: string): Promise<ExpedicaoRow | null> {
  if (DEV_USE_MOCK_DATA) {
    return mockExpedicoes.find((e) => e.id === id) ?? null;
  }
  const supabase = await getServerClient();
  const { data } = await supabase.from("expedicoes").select("*").eq("id", id).maybeSingle();
  return (data as ExpedicaoRow | null) ?? null;
}

export async function getExpedicaoComAgregados(id: string): Promise<ExpedicaoComAgregados | null> {
  if (DEV_USE_MOCK_DATA) {
    return getExpedicoesComAgregados().find((e) => e.id === id) ?? null;
  }
  const e = await getExpedicao(id);
  if (!e) return null;
  const supabase = await getServerClient();
  return (await agregarExpedicoes(supabase, [e]))[0] ?? null;
}

export async function listPassageiros(expedicaoId: string): Promise<PassageiroRow[]> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros.filter((p) => p.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as PassageiroRow[];
}

export async function getPassageiro(passageiroId: string): Promise<PassageiroRow | null> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros.find((p) => p.id === passageiroId) ?? null;
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").eq("id", passageiroId).maybeSingle();
  return (data as PassageiroRow | null) ?? null;
}

export async function listCustos(expedicaoId: string): Promise<CustoRow[]> {
  if (DEV_USE_MOCK_DATA) return mockCustos.filter((c) => c.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("custos").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as CustoRow[];
}

export async function listPagamentos(expedicaoId: string): Promise<PagamentoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    const custosIds = new Set(mockCustos.filter((c) => c.expedicao_id === expedicaoId).map((c) => c.id));
    return mockPagamentos.filter((p) => custosIds.has(p.custo_id));
  }
  const supabase = await getServerClient();
  const { data: custos } = await supabase.from("custos").select("id").eq("expedicao_id", expedicaoId);
  const custosArr = (custos ?? []) as { id: string }[];
  if (!custosArr.length) return [];
  const ids = custosArr.map((c) => c.id);
  const { data } = await supabase.from("pagamentos").select("*").in("custo_id", ids);
  return (data ?? []) as PagamentoRow[];
}

export async function listChecklist(expedicaoId: string): Promise<ChecklistItemRow[]> {
  if (DEV_USE_MOCK_DATA) return mockChecklistItens.filter((c) => c.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("checklist_itens").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as ChecklistItemRow[];
}

export async function listDocumentos(expedicaoId: string): Promise<DocumentoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    const paxIds = new Set(mockPassageiros.filter((p) => p.expedicao_id === expedicaoId).map((p) => p.id));
    return mockDocumentos.filter((d) => paxIds.has(d.passageiro_id));
  }
  const supabase = await getServerClient();
  const { data: pax } = await supabase.from("passageiros").select("id").eq("expedicao_id", expedicaoId);
  const paxArr = (pax ?? []) as { id: string }[];
  if (!paxArr.length) return [];
  const ids = paxArr.map((p) => p.id);
  const { data } = await supabase.from("documentos").select("*").in("passageiro_id", ids);
  return (data ?? []) as DocumentoRow[];
}

export async function listQuartos(expedicaoId: string): Promise<QuartoRow[]> {
  if (DEV_USE_MOCK_DATA) return mockQuartos.filter((q) => q.expedicao_id === expedicaoId);
  const supabase = await getServerClient();
  const { data } = await supabase.from("quartos").select("*").eq("expedicao_id", expedicaoId);
  return (data ?? []) as QuartoRow[];
}

/** Alocações (passageiro↔quarto) de uma expedição — base do rooming por hotel. */
export async function listAlocacoes(expedicaoId: string): Promise<AlocacaoQuartoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    const ids = new Set(mockQuartos.filter((q) => q.expedicao_id === expedicaoId).map((q) => q.id));
    return mockAlocacoes.filter((a) => ids.has(a.quarto_id));
  }
  const supabase = await getServerClient();
  const { data: qs } = await supabase.from("quartos").select("id").eq("expedicao_id", expedicaoId);
  const ids = ((qs ?? []) as { id: string }[]).map((q) => q.id);
  if (!ids.length) return [];
  const { data } = await supabase.from("passageiro_quarto").select("*").in("quarto_id", ids);
  return (data ?? []) as AlocacaoQuartoRow[];
}

export async function listUsuarios(): Promise<UsuarioRow[]> {
  if (DEV_USE_MOCK_DATA) return mockUsuarios;
  const supabase = await getServerClient();
  const { data } = await supabase.from("usuarios").select("*");
  return (data ?? []) as UsuarioRow[];
}

export async function listLinks(expedicaoId: string): Promise<LinkExpedicaoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockLinksExpedicao
      .filter((l) => l.expedicao_id === expedicaoId)
      .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
  }
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("links_expedicao")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  // Se a migration 0008 ainda não foi aplicada, a tabela não existe.
  // Retorna [] em vez de quebrar a página inteira.
  if (error) {
    if (error.code === "42P01" /* undefined_table */) return [];
    console.error("[listLinks] erro:", error);
    return [];
  }
  return (data ?? []) as LinkExpedicaoRow[];
}

// =============================================================================
// Portal do ExpedAmigo (conteúdo da viagem, migration 0021)
// =============================================================================

/** Helper genérico: lista linhas de uma tabela do portal por expedição, por ordem. */
async function listPortal<T>(
  tabela: string,
  expedicaoId: string,
  mock: { expedicao_id: string; ordem: number; created_at: string }[],
): Promise<T[]> {
  if (DEV_USE_MOCK_DATA) {
    return mock
      .filter((r) => r.expedicao_id === expedicaoId)
      .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at)) as T[];
  }
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from(tabela)
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  // Se a migration 0021 ainda não rodou, a tabela não existe → não quebra a página.
  if (error) {
    if (error.code === "42P01") return [];
    console.error(`[list ${tabela}] erro:`, error);
    return [];
  }
  return (data ?? []) as T[];
}

export const listRoteiro = (expedicaoId: string) =>
  listPortal<RoteiroDiaRow>("roteiro_dias", expedicaoId, mockRoteiroDias);
export const listVoosExpedicao = (expedicaoId: string) =>
  listPortal<ExpedicaoVooRow>("expedicao_voos", expedicaoId, mockExpedicaoVoos);
export const listPasseios = (expedicaoId: string) =>
  listPortal<ExpedicaoPasseioRow>("expedicao_passeios", expedicaoId, mockExpedicaoPasseios);
export const listInfoDestino = (expedicaoId: string) =>
  listPortal<ExpedicaoInfoRow>("expedicao_info", expedicaoId, mockExpedicaoInfo);
export const listAvisos = (expedicaoId: string) =>
  listPortal<ExpedicaoAvisoRow>("expedicao_avisos", expedicaoId, mockExpedicaoAvisos);
/** Roteiro operacional do líder (migration 0029). Sem mock — lê direto do banco. */
export const listRoteiroLider = (expedicaoId: string) =>
  listPortal<RoteiroLiderDiaRow>("roteiro_lider_dias", expedicaoId, []);

/** Fotos do roteiro de uma expedição (todas as fotos, de todos os dias). */
export async function listRoteiroFotos(expedicaoId: string): Promise<RoteiroDiaFotoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockRoteiroDiaFotos
      .filter((f) => f.expedicao_id === expedicaoId)
      .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
  }
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("roteiro_dia_fotos")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    console.error("[listRoteiroFotos] erro:", error);
    return [];
  }
  return (data ?? []) as RoteiroDiaFotoRow[];
}

// =============================================================================
// Prontidão para Embarque (P9)
// =============================================================================

export async function listRequisitosPassageiro(
  passageiroId: string,
): Promise<PassageiroRequisitoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockPassageiroRequisitos.filter((r) => r.passageiro_id === passageiroId);
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("passageiro_requisitos")
    .select("*")
    .eq("passageiro_id", passageiroId);
  return (data ?? []) as PassageiroRequisitoRow[];
}

export type ProntidaoPassageiro = {
  passageiro: PassageiroRow;
  resultado: ResultadoProntidao;
  requisitos: PassageiroRequisitoRow[];
};

/** Prontidão de todos os passageiros de uma expedição (alimenta o painel). */
export async function getProntidaoExpedicao(
  expedicaoId: string,
): Promise<ProntidaoPassageiro[]> {
  const exp = await getExpedicao(expedicaoId);
  if (!exp) return [];

  let passageiros: PassageiroRow[];
  let requisitos: PassageiroRequisitoRow[];
  if (DEV_USE_MOCK_DATA) {
    passageiros = mockPassageiros.filter((p) => p.expedicao_id === expedicaoId);
    const paxIds = new Set(passageiros.map((p) => p.id));
    requisitos = mockPassageiroRequisitos.filter((r) => paxIds.has(r.passageiro_id));
  } else {
    passageiros = await listPassageiros(expedicaoId);
    const supabase = await getServerClient();
    const ids = passageiros.map((p) => p.id);
    if (!ids.length) return [];
    const { data } = await supabase
      .from("passageiro_requisitos")
      .select("*")
      .in("passageiro_id", ids);
    requisitos = (data ?? []) as PassageiroRequisitoRow[];
  }

  const porPax = new Map<string, PassageiroRequisitoRow[]>();
  for (const r of requisitos) {
    const arr = porPax.get(r.passageiro_id) ?? [];
    arr.push(r);
    porPax.set(r.passageiro_id, arr);
  }

  // Cortesias/líderes ainda contam na prontidão? Sim — o líder também embarca.
  return passageiros
    .filter((p) => p.status_reserva !== "Cancelado")
    .map((passageiro) => {
      const reqs = porPax.get(passageiro.id) ?? [];
      return {
        passageiro,
        requisitos: reqs,
        resultado: avaliarProntidao({
          passageiro,
          expedicao: exp,
          destino: exp.destino,
          requisitos: reqs,
        }),
      };
    });
}

export type ResumoProntidaoExpedicao = {
  id: string;
  nome: string;
  data_embarque: string;
  status: string;
  diasAteEmbarque: number | null;
  total: number;
  aptos: number;
  atencao: number;
  bloqueados: number;
  /** Tipo de requisito que mais bloqueia neste grupo (top bloqueador). */
  topBloqueador: string | null;
};

/** Resumo de prontidão por expedição — alimenta o card do dashboard. */
export async function getResumoProntidao(): Promise<ResumoProntidaoExpedicao[]> {
  const expedicoes = DEV_USE_MOCK_DATA
    ? mockExpedicoes
    : await (async () => {
        const supabase = await getServerClient();
        const { data } = await supabase
          .from("expedicoes")
          .select("*")
          .order("data_embarque", { ascending: true });
        return (data ?? []) as ExpedicaoRow[];
      })();

  const resumos = await Promise.all(
    expedicoes
      .filter((e) => e.status !== "Concluída" && e.status !== "Cancelada")
      .map(async (e) => {
        const linhas = await getProntidaoExpedicao(e.id);
        const contagem: Record<Prontidao, number> = { Apto: 0, "Atenção": 0, Bloqueado: 0 };
        const bloqueadorPorTipo = new Map<string, number>();
        for (const { resultado } of linhas) {
          contagem[resultado.prontidao]++;
          for (const c of resultado.checagens) {
            if (c.semaforo === "bloqueio") {
              bloqueadorPorTipo.set(c.tipo, (bloqueadorPorTipo.get(c.tipo) ?? 0) + 1);
            }
          }
        }
        const topBloqueador =
          [...bloqueadorPorTipo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        return {
          id: e.id,
          nome: e.nome,
          data_embarque: e.data_embarque,
          status: e.status,
          diasAteEmbarque: daysUntil(e.data_embarque),
          total: linhas.length,
          aptos: contagem.Apto,
          atencao: contagem["Atenção"],
          bloqueados: contagem.Bloqueado,
          topBloqueador,
        };
      }),
  );
  return resumos;
}

// =============================================================================
// Avisos operacionais (alertas por passageiro) — usado em /avisos e no menu
// =============================================================================

export type AlertaOperacional = {
  expedicao_id: string;
  expedicao_nome: string;
  data_embarque: string;
  dias_ate_embarque: number;
  passageiro_id: string;
  passageiro_nome: string;
  tipo: TipoRequisito;
  severidade: SeveridadeAlerta;
  rotulo: string;
  detalhe: string;
};

/**
 * Carrega a prontidão de TODOS os passageiros em apenas 3 queries em lote
 * (expedições + passageiros + requisitos) e agrupa por expedição. Substitui o
 * N+1 de chamar getProntidaoExpedicao por expedição — é o que deixava o badge
 * de avisos (no layout, em toda página) e a /avisos lentos.
 */
async function getProntidaoTodas(): Promise<{
  expedicoes: ExpedicaoRow[];
  porExpedicao: Map<string, ProntidaoPassageiro[]>;
}> {
  let expedicoes: ExpedicaoRow[];
  let passageiros: PassageiroRow[];
  let requisitos: PassageiroRequisitoRow[];

  if (DEV_USE_MOCK_DATA) {
    expedicoes = mockExpedicoes;
    passageiros = mockPassageiros;
    requisitos = mockPassageiroRequisitos;
  } else {
    const supabase = await getServerClient();
    const [expRes, paxAll, reqAll] = await Promise.all([
      supabase.from("expedicoes").select("*"),
      fetchAllRows<PassageiroRow>((from, to) =>
        supabase.from("passageiros").select("*").order("id").range(from, to)),
      fetchAllRows<PassageiroRequisitoRow>((from, to) =>
        supabase.from("passageiro_requisitos").select("*").order("id").range(from, to)),
    ]);
    expedicoes = (expRes.data ?? []) as ExpedicaoRow[];
    passageiros = paxAll;
    requisitos = reqAll;
  }

  const expById = new Map(expedicoes.map((e) => [e.id, e]));
  const reqPorPax = new Map<string, PassageiroRequisitoRow[]>();
  for (const r of requisitos) {
    const arr = reqPorPax.get(r.passageiro_id) ?? [];
    arr.push(r);
    reqPorPax.set(r.passageiro_id, arr);
  }

  const porExpedicao = new Map<string, ProntidaoPassageiro[]>();
  for (const passageiro of passageiros) {
    if (passageiro.status_reserva === "Cancelado") continue;
    const expId = passageiro.expedicao_id;
    if (!expId) continue; // passageiro avulso (sem expedição) não tem prontidão
    const exp = expById.get(expId);
    if (!exp) continue;
    const reqs = reqPorPax.get(passageiro.id) ?? [];
    const arr = porExpedicao.get(expId) ?? [];
    arr.push({
      passageiro,
      requisitos: reqs,
      resultado: avaliarProntidao({ passageiro, expedicao: exp, destino: exp.destino, requisitos: reqs }),
    });
    porExpedicao.set(expId, arr);
  }

  return { expedicoes, porExpedicao };
}

/**
 * Lista de avisos: exigências pendentes dentro da janela, por passageiro.
 * Envolvido em `cache()` pra rodar uma vez só por request (o layout e a /avisos
 * chamam na mesma renderização).
 */
export const getAlertasOperacionais = cache(async (): Promise<AlertaOperacional[]> => {
  const { expedicoes, porExpedicao } = await getProntidaoTodas();
  const ativas = expedicoes.filter(
    (e) => e.status !== "Concluída" && e.status !== "Cancelada",
  );

  const alertas: AlertaOperacional[] = [];
  for (const e of ativas) {
    const dias = daysUntil(e.data_embarque);
    if (dias == null || dias < 0) continue;
    const linhas = porExpedicao.get(e.id) ?? [];
    for (const { passageiro, resultado } of linhas) {
      for (const c of resultado.checagens) {
        const severidade = avaliarAlerta(c.tipo, c.semaforo, dias);
        if (!severidade) continue;
        alertas.push({
          expedicao_id: e.id,
          expedicao_nome: e.nome,
          data_embarque: e.data_embarque,
          dias_ate_embarque: dias,
          passageiro_id: passageiro.id,
          passageiro_nome: passageiro.nome_completo,
          tipo: c.tipo,
          severidade,
          rotulo: regraDoTipo(c.tipo)?.rotulo ?? c.tipo,
          detalhe: c.detalhe,
        });
      }
    }
  }

  // Mais urgente primeiro: menos dias até embarque, e críticos antes de atenção.
  alertas.sort(
    (a, b) =>
      a.dias_ate_embarque - b.dias_ate_embarque ||
      (a.severidade === b.severidade ? 0 : a.severidade === "critico" ? -1 : 1),
  );
  return alertas;
});

/** Contagem de avisos (para o badge no menu). */
export async function getContagemAlertas(): Promise<{ total: number; criticos: number }> {
  const alertas = await getAlertasOperacionais();
  return {
    total: alertas.length,
    criticos: alertas.filter((a) => a.severidade === "critico").length,
  };
}

// =============================================================================
// Resumo de processos (checklist) cross-expedição — usado no dashboard
// =============================================================================

export type ResumoProcessoExpedicao = {
  id: string;
  nome: string;
  data_embarque: string;
  status: string;
  faseAtual: EtapaChecklist | null;
  total: number;
  concluidos: number;
  atrasados: number;
  proximos7d: number;
};

type CkLite = { expedicao_id: string; status: string; prazo: string | null; parent_id: string | null };

function montarResumo(
  exp: { id: string; nome: string; data_embarque: string; status: string },
  itens: CkLite[],
): ResumoProcessoExpedicao {
  const topo = itens.filter((i) => !i.parent_id);
  let concluidos = 0, atrasados = 0, proximos7d = 0;
  for (const i of topo) {
    const concluido = i.status === "Concluído";
    if (concluido) concluidos++;
    const d = daysUntil(i.prazo);
    if (!concluido && d != null) {
      if (d < 0) atrasados++;
      else if (d <= 7) proximos7d++;
    }
  }
  return {
    id: exp.id,
    nome: exp.nome,
    data_embarque: exp.data_embarque,
    status: exp.status,
    faseAtual: faseAtualChecklist(daysUntil(exp.data_embarque)),
    total: topo.length,
    concluidos,
    atrasados,
    proximos7d,
  };
}

export async function getResumoProcessos(): Promise<ResumoProcessoExpedicao[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockExpedicoes.map((e) =>
      montarResumo(e, mockChecklistItens.filter((c) => c.expedicao_id === e.id)),
    );
  }
  const supabase = await getServerClient();
  const [{ data: exps }, { data: cks }] = await Promise.all([
    supabase.from("expedicoes").select("id, nome, data_embarque, status"),
    supabase.from("checklist_itens").select("expedicao_id, status, prazo, parent_id"),
  ]);
  const itens = (cks ?? []) as CkLite[];
  return ((exps ?? []) as { id: string; nome: string; data_embarque: string; status: string }[]).map(
    (e) => montarResumo(e, itens.filter((c) => c.expedicao_id === e.id)),
  );
}

// Re-export Tables type pra compatibilidade
export type { Tables };
