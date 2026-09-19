import type { z } from "zod";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockExpedicoes, mockPassageiros, mockPassageiroRequisitos, PASSAGEIRO_INSCRICAO_DEFAULTS } from "@/lib/mock-data";
import { construirRequisitosPadrao } from "@/lib/prontidao/template";
import { gerarRequisitosPadrao } from "@/app/(app)/expedicoes/actions";
import { mapBitrixStage } from "./stage-mapping";
import { passageiroSyncSchema } from "./validators";

type SyncData = z.infer<typeof passageiroSyncSchema>;
/** Campos extras que o Bitrix pode trazer além do schema base (ex.: endereço do deal). */
export type ExtraSync = { endereco_cep?: string | null; endereco_rua?: string | null };

export type UpsertPassageiroResult =
  | { ok: true; passageiro_id: string; action: "created" | "updated" }
  | { ok: false; status: number; error: string };

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const soDig = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** Normaliza nome pra casamento (sem acento, minúsculo, espaços colapsados). */
const normNome = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const nascDia = (v: unknown) => String(v ?? "").slice(0, 10);

/**
 * Cria/atualiza um passageiro a partir do payload do Bitrix.
 *
 * Casa o passageiro existente com CASAMENTO REFORÇADO (pra não duplicar quem já entrou
 * por inscrição/manual): 1) por `bitrix_deal_id` (global); senão, DENTRO da expedição,
 * por 2) CPF (dígitos), 3) `bitrix_contact_id`, 4) nome + data de nascimento. Só cria
 * novo se nenhum casar. Vincula o deal na linha existente.
 *
 * ⚠️ Política "SÓ PREENCHE O QUE ESTÁ VAZIO": passageiro NOVO é criado com tudo; num que
 * JÁ EXISTE, só grava os campos vazios no sistema — NUNCA sobrescreve dado já preenchido
 * (protege edições manuais). `status_reserva` só é setado na criação.
 *
 * Compartilhado por `/api/bitrix/passageiro-sync` e `/api/bitrix/sync-contato`.
 */
export async function upsertPassageiroBitrix(data: SyncData, extra?: ExtraSync): Promise<UpsertPassageiroResult> {
  const status_reserva = mapBitrixStage(data.estagio_deal);
  const campos: [string, unknown][] = [
    ["nome_completo", data.nome_completo],
    ["cpf", data.cpf ?? null],
    ["passaporte", data.passaporte ?? null],
    ["validade_passaporte", data.validade_passaporte ?? null],
    ["data_nascimento", data.data_nascimento ?? null],
    ["email", data.email ?? null],
    ["telefone", data.telefone ?? null],
    ["observacoes", data.observacoes ?? null],
    ["bitrix_contact_id", data.bitrix_contact_id ?? null],
    ["bitrix_deal_id", data.bitrix_deal_id],
    ["endereco_cep", extra?.endereco_cep ?? null],
    ["endereco_rua", extra?.endereco_rua ?? null],
  ];
  /** Patch só com o que veio preenchido E está vazio no existente. */
  const patchVazios = (ex: Record<string, unknown>): Record<string, unknown> => {
    const patch: Record<string, unknown> = {};
    for (const [campo, valor] of campos) if (!vazio(valor) && vazio(ex[campo])) patch[campo] = valor;
    return patch;
  };

  // ===== MOCK =====
  if (DEV_USE_MOCK_DATA) {
    const expedicao = mockExpedicoes.find((e) => e.codigo === data.expedicao_codigo);
    if (!expedicao) return { ok: false, status: 404, error: `Expedição ${data.expedicao_codigo} não encontrada` };

    let existente = data.bitrix_deal_id
      ? mockPassageiros.find((p) => p.bitrix_deal_id === data.bitrix_deal_id)
      : undefined;
    if (!existente) {
      const naExp = mockPassageiros.filter((p) => p.expedicao_id === expedicao.id);
      const cpfDig = soDig(data.cpf);
      if (cpfDig) existente = naExp.find((p) => soDig(p.cpf) === cpfDig);
      if (!existente && data.bitrix_contact_id)
        existente = naExp.find((p) => String(p.bitrix_contact_id ?? "").trim() === String(data.bitrix_contact_id).trim());
      if (!existente && data.nome_completo && data.data_nascimento)
        existente = naExp.find(
          (p) => normNome(p.nome_completo) === normNome(data.nome_completo) && nascDia(p.data_nascimento) === nascDia(data.data_nascimento),
        );
    }
    if (existente) {
      const patch = patchVazios(existente as unknown as Record<string, unknown>);
      if (Object.keys(patch).length) Object.assign(existente, patch, { updated_at: new Date().toISOString() });
      return { ok: true, passageiro_id: existente.id, action: "updated" };
    }

    const novo = {
      id: `p${Math.random().toString(36).slice(2, 14)}`,
      expedicao_id: expedicao.id,
      grupo_id: null,
      conexao_viagem_id: null,
      bitrix_contact_id: data.bitrix_contact_id ?? null,
      bitrix_deal_id: data.bitrix_deal_id,
      nome_completo: data.nome_completo,
      tipo: "Pagante" as const,
      cpf: data.cpf ?? null,
      passaporte: data.passaporte ?? null,
      data_nascimento: data.data_nascimento ?? null,
      validade_passaporte: data.validade_passaporte ?? null,
      email: data.email ?? null,
      telefone: data.telefone ?? null,
      status_reserva,
      passaporte_arquivo_id: null,
      voo_nacional_necessario: data.voo_nacional_necessario ?? false,
      companhia_aerea: null,
      localizador: null,
      quarto_id: null,
      valor_contratado_brl: 0,
      valor_pago_brl: 0,
      saldo_brl: 0,
      status_financeiro: "Em aberto",
      contato_emergencia_nome: null,
      contato_emergencia_fone: null,
      restricoes_alimentares: null,
      condicoes_medicas: null,
      contrato_assinado: false,
      checkin_online_feito: false,
      observacoes: data.observacoes ?? null,
      ...PASSAGEIRO_INSCRICAO_DEFAULTS,
      endereco_cep: extra?.endereco_cep ?? null,
      endereco_rua: extra?.endereco_rua ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockPassageiros.push(novo);
    mockPassageiroRequisitos.push(
      ...construirRequisitosPadrao({ passageiro: novo, destino: expedicao.destino }),
    );
    return { ok: true, passageiro_id: novo.id, action: "created" };
  }

  // ===== PROD (Supabase) =====
  const supabase = createServiceRoleClient();
  const expRes = await supabase
    .from("expedicoes").select("id").eq("codigo", data.expedicao_codigo).maybeSingle();
  if (expRes.error || !expRes.data) {
    return { ok: false, status: 404, error: `Expedição ${data.expedicao_codigo} não encontrada` };
  }
  const exp = expRes.data as { id: string };

  const cols =
    "id, nome_completo, cpf, passaporte, validade_passaporte, data_nascimento, email, telefone, observacoes, bitrix_contact_id, bitrix_deal_id, endereco_cep, endereco_rua";
  const cpfDig = soDig(data.cpf) || null;
  const contatoId = data.bitrix_contact_id ? String(data.bitrix_contact_id).trim() : null;
  const nomeN = data.nome_completo ? normNome(data.nome_completo) : null;
  const nascN = data.data_nascimento ? nascDia(data.data_nascimento) : null;

  /** Aplica o patch "só-vazio" numa linha existente e devolve o resultado. */
  const atualizar = async (ex: Record<string, unknown>): Promise<UpsertPassageiroResult> => {
    const patch = patchVazios(ex);
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("passageiros").update(patch).eq("id", ex.id as string);
      if (error) return { ok: false, status: 500, error: error.message };
      await supabase.from("audit_log").insert({
        tabela: "passageiros", registro_id: ex.id as string, acao: "update",
        dados_depois: patch, origem: "bitrix-webhook",
      });
    }
    return { ok: true, passageiro_id: ex.id as string, action: "updated" };
  };

  /**
   * Casamento REFORÇADO dentro da expedição, por prioridade:
   * 1) CPF (dígitos) · 2) bitrix_contact_id · 3) nome + data de nascimento.
   * Busca as linhas da expedição UMA vez e tenta cada chave.
   */
  const acharNaExpedicao = async (): Promise<Record<string, unknown> | null> => {
    if (!cpfDig && !contatoId && !(nomeN && nascN)) return null;
    const { data: rows } = await supabase.from("passageiros").select(cols).eq("expedicao_id", exp.id);
    const lista = (rows ?? []) as Record<string, unknown>[];
    if (cpfDig) {
      const m = lista.find((r) => soDig(r.cpf) === cpfDig);
      if (m) return m;
    }
    if (contatoId) {
      const m = lista.find((r) => String(r.bitrix_contact_id ?? "").trim() === contatoId);
      if (m) return m;
    }
    if (nomeN && nascN) {
      const m = lista.find((r) => normNome(r.nome_completo) === nomeN && nascDia(r.data_nascimento) === nascN);
      if (m) return m;
    }
    return null;
  };

  // 1) Casa por bitrix_deal_id (global — a mesma negociação).
  if (data.bitrix_deal_id) {
    const { data: byDeal } = await supabase
      .from("passageiros").select(cols).eq("bitrix_deal_id", data.bitrix_deal_id).maybeSingle();
    if (byDeal) return atualizar(byDeal as Record<string, unknown>);
  }

  // 2) Não achou pelo deal → casamento reforçado na expedição (CPF → contato → nome+nasc).
  const naExp = await acharNaExpedicao();
  if (naExp) return atualizar(naExp);

  // 3) Novo → insere completo.
  const registro = {
    expedicao_id: exp.id,
    bitrix_contact_id: data.bitrix_contact_id ?? null,
    bitrix_deal_id: data.bitrix_deal_id,
    nome_completo: data.nome_completo,
    cpf: data.cpf ?? null,
    passaporte: data.passaporte ?? null,
    validade_passaporte: data.validade_passaporte ?? null,
    data_nascimento: data.data_nascimento ?? null,
    email: data.email ?? null,
    telefone: data.telefone ?? null,
    status_reserva,
    voo_nacional_necessario: data.voo_nacional_necessario ?? false,
    observacoes: data.observacoes ?? null,
    endereco_cep: extra?.endereco_cep ?? null,
    endereco_rua: extra?.endereco_rua ?? null,
  };
  const { data: result, error } = await supabase
    .from("passageiros").insert(registro).select("id").single();
  if (error) {
    // Corrida / conflito de CPF: alguém já existe nessa expedição com essa identidade.
    // Re-acha (reforçado) e faz o update "só-vazio" em vez de quebrar.
    const conflito = await acharNaExpedicao();
    if (conflito) return atualizar(conflito);
    return { ok: false, status: 500, error: error.message };
  }
  const r = result as { id: string };

  await supabase.from("audit_log").insert({
    tabela: "passageiros", registro_id: r.id, acao: "insert",
    dados_depois: registro, origem: "bitrix-webhook",
  });
  await gerarRequisitosPadrao(exp.id);
  return { ok: true, passageiro_id: r.id, action: "created" };
}
