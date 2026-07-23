"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockPassageiros, mockExpedicoes, mockInscricoesPendentes } from "@/lib/mock-data";
import { fetchAllRows } from "@/lib/data/expedicoes";
import { materializarInscricao, type Dados } from "@/lib/inscricao/core";
import { enviarPassageiroParaBitrix, type PassageiroOutbound } from "@/lib/bitrix/outbound";
import type { PassageiroRow, ExpedicaoRow, SaudePassageiro, InscricaoPendenteRow } from "@/types/database";

const BUCKET_ARQUIVOS = "arquivos-expedicoes";

/**
 * Conta quantas expedições NÃO canceladas a pessoa (pelo CPF) já fez, ANTES da
 * expedição atual. Sinal de fidelidade que vai no card do Bitrix.
 */
async function expedicoesAnterioresDaPessoa(cpf: string | null, expedicaoIdAtual: string | null): Promise<number> {
  const digitos = (cpf ?? "").replace(/\D/g, "");
  if (digitos.length !== 11) return 0;
  let linhas: { cpf: string | null; expedicao_id: string | null; status_reserva: string }[];
  if (DEV_USE_MOCK_DATA) {
    linhas = mockPassageiros.map((p) => ({ cpf: p.cpf, expedicao_id: p.expedicao_id, status_reserva: p.status_reserva }));
  } else {
    const sb = createServiceRoleClient();
    linhas = await fetchAllRows((from, to) =>
      sb.from("passageiros").select("cpf,expedicao_id,status_reserva").not("cpf", "is", null).order("id").range(from, to));
  }
  const exps = new Set<string>();
  for (const l of linhas) {
    if ((l.cpf ?? "").replace(/\D/g, "") !== digitos) continue;
    if (l.status_reserva === "Cancelado" || !l.expedicao_id) continue;
    if (l.expedicao_id === expedicaoIdAtual) continue;
    exps.add(l.expedicao_id);
  }
  return exps.size;
}

/** Monta a "cartinha" (payload) que o sistema manda ao n8n ao aprovar. */
function montarOutbound(
  p: PassageiroRow,
  expedicaoCodigo: string | null,
  expedicaoNome: string | null,
  expedicoesAnteriores: number,
): PassageiroOutbound {
  return {
    evento: "inscricao_aprovada",
    bitrix_deal_id: p.bitrix_deal_id,
    bitrix_contact_id: p.bitrix_contact_id,
    expedicao_codigo: expedicaoCodigo,
    expedicao_nome: expedicaoNome,
    expedicoes_anteriores: expedicoesAnteriores,
    nome_completo: p.nome_completo,
    cpf: p.cpf,
    email: p.email,
    telefone: p.telefone,
    data_nascimento: p.data_nascimento,
    passaporte: p.passaporte,
    validade_passaporte: p.validade_passaporte,
    status_reserva: p.status_reserva,
    observacoes: p.observacoes,
    endereco: {
      cep: p.endereco_cep, rua: p.endereco_rua, numero: p.endereco_numero, complemento: p.endereco_complemento,
      bairro: p.endereco_bairro, cidade: p.endereco_cidade, estado: p.endereco_estado,
    },
    contato_emergencia_nome: p.contato_emergencia_nome,
    contato_emergencia_vinculo: p.contato_emergencia_vinculo,
    contato_emergencia_fone: p.contato_emergencia_fone,
    pref_marcar_assento: p.pref_marcar_assento,
    pref_upgrade_classe: p.pref_upgrade_classe,
    ja_viajou_internacional: p.ja_viajou_internacional,
    paises_visitados: p.paises_visitados,
    acompanhante_nome: p.acompanhante_nome,
    acompanhante_divide_quarto: p.acompanhante_divide_quarto,
    saude: (p.saude as Record<string, string> | null) ?? null,
    passaporte_arquivo_url: null,
    passaporte_arquivo_nome: null,
  };
}

export type InscricaoPendente = {
  id: string;
  expedicao_id: string | null;
  expedicao_nome: string;
  destino: string;
  data_embarque: string | null;
  created_at: string;
  origem: string | null;
  status_reserva: string;
  /** 'pendente' (fila) | 'recusada' (aguardando à parte). */
  situacao: "pendente" | "recusada";
  recusada_em: string | null;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: { cep: string | null; rua: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null };
  passaporte: string | null;
  validade_passaporte: string | null;
  tem_passaporte: boolean;
  passaporte_arquivo_id: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_fone: string | null;
  contato_emergencia_vinculo: string | null;
  pref_marcar_assento: boolean | null;
  pref_upgrade_classe: string | null;
  ja_viajou_internacional: boolean | null;
  paises_visitados: string | null;
  acompanhante_nome: string | null;
  acompanhante_divide_quarto: string | null;
  acompanhante_vinculo: string | null;
  acompanhante_dividir_com: string | null;
  saude: SaudePassageiro | null;
  restricoes_alimentares: string | null;
  condicoes_medicas: string | null;
  // Perfil & conexões (migration 0038)
  profissao: string | null;
  instagram: string | null;
  camiseta: string | null;
  musica: string | null;
  descricao_grupo: string | null;
  anima_expedicao: string | null;
  significado: string | null;
  foto_arquivo_id: string | null;
  tem_foto: boolean;
};

/** Converte uma linha do staging (com o jsonb `dados`) para o formato da fila. */
function montar(row: InscricaoPendenteRow, e: ExpedicaoRow | undefined): InscricaoPendente {
  const dd = (row.dados ?? {}) as Record<string, unknown>;
  const gs = (k: string) => (dd[k] == null || dd[k] === "" ? null : String(dd[k]));
  const gb = (k: string) => (typeof dd[k] === "boolean" ? (dd[k] as boolean) : null);
  return {
    id: row.id,
    expedicao_id: row.expedicao_id,
    expedicao_nome: e?.nome ?? "—",
    destino: e?.destino ?? "—",
    data_embarque: e?.data_embarque ?? null,
    created_at: row.created_at,
    origem: row.origem,
    status_reserva: row.status === "recusada" ? "Recusada" : "Aguardando aprovação",
    situacao: row.status === "recusada" ? "recusada" : "pendente",
    recusada_em: row.recusada_em ?? null,
    nome_completo: row.nome_completo ?? gs("nome_completo") ?? "—",
    cpf: row.cpf,
    data_nascimento: row.data_nascimento ?? gs("data_nascimento"),
    email: gs("email"),
    telefone: gs("telefone"),
    endereco: {
      cep: gs("endereco_cep"), rua: gs("endereco_rua"), numero: gs("endereco_numero"), complemento: gs("endereco_complemento"),
      bairro: gs("endereco_bairro"), cidade: gs("endereco_cidade"), estado: gs("endereco_estado"),
    },
    passaporte: gs("passaporte"),
    validade_passaporte: gs("validade_passaporte"),
    tem_passaporte: Boolean(row.passaporte_arquivo_id),
    passaporte_arquivo_id: row.passaporte_arquivo_id,
    contato_emergencia_nome: gs("contato_emergencia_nome"),
    contato_emergencia_fone: gs("contato_emergencia_fone"),
    contato_emergencia_vinculo: gs("contato_emergencia_vinculo"),
    pref_marcar_assento: gb("pref_marcar_assento"),
    pref_upgrade_classe: gs("pref_upgrade_classe"),
    ja_viajou_internacional: gb("ja_viajou_internacional"),
    paises_visitados: gs("paises_visitados"),
    acompanhante_nome: gs("acompanhante_nome"),
    acompanhante_divide_quarto: gs("acompanhante_divide_quarto"),
    acompanhante_vinculo: gs("acompanhante_vinculo"),
    acompanhante_dividir_com: gs("acompanhante_dividir_com"),
    saude: (dd.saude && typeof dd.saude === "object" ? (dd.saude as SaudePassageiro) : null),
    restricoes_alimentares: null,
    condicoes_medicas: null,
    profissao: gs("profissao"),
    instagram: gs("instagram"),
    camiseta: gs("camiseta"),
    musica: gs("musica"),
    descricao_grupo: gs("descricao_grupo"),
    anima_expedicao: gs("anima_expedicao"),
    significado: gs("significado"),
    foto_arquivo_id: row.foto_arquivo_id,
    tem_foto: Boolean(row.foto_arquivo_id),
  };
}

/** Lista inscrições por situação ('pendente' = fila; 'recusada' = aguardando à parte). */
async function listPorStatus(status: "pendente" | "recusada"): Promise<InscricaoPendente[]> {
  let rows: InscricaoPendenteRow[];
  let exps: ExpedicaoRow[];
  if (DEV_USE_MOCK_DATA) {
    rows = mockInscricoesPendentes.filter((r) => (r.status ?? "pendente") === status);
    exps = mockExpedicoes;
  } else {
    const sb = await getServerClient();
    const [{ data: r }, { data: e }] = await Promise.all([
      sb.from("inscricoes_pendentes").select("*").eq("status", status),
      sb.from("expedicoes").select("*"),
    ]);
    rows = (r ?? []) as InscricaoPendenteRow[];
    exps = (e ?? []) as ExpedicaoRow[];
  }
  const expById = new Map(exps.map((e) => [e.id, e]));
  return rows
    .map((row) => montar(row, expById.get(row.expedicao_id)))
    .sort((a, b) => (b.recusada_em ?? b.created_at).localeCompare(a.recusada_em ?? a.created_at));
}

export async function listInscricoesPendentes(): Promise<InscricaoPendente[]> {
  return listPorStatus("pendente");
}

/** Inscrições recusadas — ficam guardadas aqui (com anexos) até restaurar/excluir. */
export async function listInscricoesRecusadas(): Promise<InscricaoPendente[]> {
  return listPorStatus("recusada");
}

export async function contarInscricoesPendentes(): Promise<number> {
  if (DEV_USE_MOCK_DATA) return mockInscricoesPendentes.filter((r) => (r.status ?? "pendente") === "pendente").length;
  const sb = await getServerClient();
  const { count } = await sb
    .from("inscricoes_pendentes").select("id", { count: "exact", head: true }).eq("status", "pendente");
  return count ?? 0;
}

export async function aprovarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  // 1) Lê a inscrição pendente.
  let pend: InscricaoPendenteRow | null = null;
  if (DEV_USE_MOCK_DATA) {
    pend = mockInscricoesPendentes.find((p) => p.id === id) ?? null;
  } else {
    const sb = createServiceRoleClient();
    const { data } = await sb.from("inscricoes_pendentes").select("*").eq("id", id).maybeSingle();
    pend = (data as InscricaoPendenteRow | null) ?? null;
  }
  if (!pend) return { ok: false, error: "Inscrição não encontrada." };

  // 2) Materializa no passageiro (cria/atualiza + propaga).
  let pax: PassageiroRow | null;
  try {
    pax = (await materializarInscricao({
      expedicao_id: pend.expedicao_id,
      cpf: pend.cpf,
      dados: pend.dados as unknown as Dados,
      passaporte_arquivo_id: pend.passaporte_arquivo_id,
      foto_arquivo_id: pend.foto_arquivo_id,
    })) as PassageiroRow | null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao gravar o passageiro." };
  }

  // 3) Remove a pendência (já virou passageiro).
  if (DEV_USE_MOCK_DATA) {
    const i = mockInscricoesPendentes.findIndex((p) => p.id === id);
    if (i >= 0) mockInscricoesPendentes.splice(i, 1);
  } else {
    const sb = createServiceRoleClient();
    await sb.from("inscricoes_pendentes").delete().eq("id", id);
  }

  // 4) Melhor esforço: avisa o Bitrix (via n8n). Falha aqui NÃO desfaz a aprovação.
  if (pax) {
    let codigo: string | null = null;
    let nome: string | null = null;
    if (DEV_USE_MOCK_DATA) {
      const exp = mockExpedicoes.find((e) => e.id === pax!.expedicao_id);
      codigo = exp?.codigo ?? null; nome = exp?.nome ?? null;
    } else if (pax.expedicao_id) {
      const sb = createServiceRoleClient();
      const { data: exp } = await sb.from("expedicoes").select("codigo,nome").eq("id", pax.expedicao_id).maybeSingle();
      codigo = (exp as { codigo: string; nome: string } | null)?.codigo ?? null;
      nome = (exp as { codigo: string; nome: string } | null)?.nome ?? null;
    }
    const anteriores = await expedicoesAnterioresDaPessoa(pax.cpf, pax.expedicao_id);
    const outbound = montarOutbound(pax, codigo, nome, anteriores);

    // Link temporário do passaporte pro n8n baixar e anexar no Bitrix (service role).
    if (!DEV_USE_MOCK_DATA && pax.passaporte_arquivo_id) {
      const admin = createServiceRoleClient();
      const { data: arq } = await admin.from("arquivos").select("storage_path, nome").eq("id", pax.passaporte_arquivo_id).maybeSingle();
      const a = arq as { storage_path: string; nome: string } | null;
      if (a?.storage_path) {
        const { data: signed } = await admin.storage.from(BUCKET_ARQUIVOS).createSignedUrl(a.storage_path, 3600);
        if (signed?.signedUrl) { outbound.passaporte_arquivo_url = signed.signedUrl; outbound.passaporte_arquivo_nome = a.nome; }
      }
    }
    await enviarPassageiroParaBitrix(outbound);
  }

  revalidatePath("/inscricoes");
  revalidatePath("/passageiros");
  if (pax?.expedicao_id) {
    revalidatePath(`/expedicoes/${pax.expedicao_id}`);
    revalidatePath(`/expedicoes/${pax.expedicao_id}/passageiros`);
  }
  revalidatePath("/avisos");
  return { ok: true };
}

/**
 * Recusa uma inscrição SEM apagar: marca como 'recusada' e guarda (com anexos)
 * numa aba à parte, de onde dá pra restaurar ou excluir de vez. Assim nada se perde.
 */
export async function recusarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  const agora = new Date().toISOString();
  if (DEV_USE_MOCK_DATA) {
    const p = mockInscricoesPendentes.find((p) => p.id === id);
    if (p) { p.status = "recusada"; p.recusada_em = agora; p.updated_at = agora; }
    revalidatePath("/inscricoes");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("inscricoes_pendentes").update({ status: "recusada", recusada_em: agora }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inscricoes");
  return { ok: true };
}

/** Restaura uma inscrição recusada de volta pra fila de pendentes. */
export async function restaurarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const p = mockInscricoesPendentes.find((p) => p.id === id);
    if (p) { p.status = "pendente"; p.recusada_em = null; p.updated_at = new Date().toISOString(); }
    revalidatePath("/inscricoes");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("inscricoes_pendentes").update({ status: "pendente", recusada_em: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inscricoes");
  return { ok: true };
}

/**
 * Exclui uma inscrição DE VEZ (só do estado recusada) — aí sim apaga a linha e os
 * anexos de staging (passaporte, foto, certificado de febre amarela) pra não deixar
 * órfão no Storage. Ação irreversível.
 */
export async function excluirInscricaoDefinitivo(id: string): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const i = mockInscricoesPendentes.findIndex((p) => p.id === id);
    if (i >= 0) mockInscricoesPendentes.splice(i, 1);
    revalidatePath("/inscricoes");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("inscricoes_pendentes").select("passaporte_arquivo_id, foto_arquivo_id, dados").eq("id", id).maybeSingle();
  const row = data as { passaporte_arquivo_id: string | null; foto_arquivo_id: string | null; dados: Record<string, unknown> | null } | null;
  const saude = (row?.dados?.saude ?? null) as Record<string, unknown> | null;
  const certId = saude && typeof saude.vacina_febre_amarela_arquivo_id === "string" ? saude.vacina_febre_amarela_arquivo_id : null;
  const arqIds = [row?.passaporte_arquivo_id, row?.foto_arquivo_id, certId].filter((x): x is string => Boolean(x));
  for (const arqId of arqIds) {
    const { data: arq } = await sb.from("arquivos").select("storage_path").eq("id", arqId).maybeSingle();
    const sp = (arq as { storage_path: string } | null)?.storage_path;
    if (sp) await sb.storage.from(BUCKET_ARQUIVOS).remove([sp]);
    await sb.from("arquivos").delete().eq("id", arqId);
  }
  const { error } = await sb.from("inscricoes_pendentes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inscricoes");
  return { ok: true };
}
