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

/**
 * Cria/atualiza um passageiro a partir do payload do Bitrix.
 *
 * Casa o passageiro existente por `bitrix_deal_id` OU por `(expedicao_id, cpf)` — assim
 * não duplica quem já entrou por inscrição/manual (respeita a unique de CPF por expedição)
 * e ainda vincula o deal na linha existente.
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

    let existente = mockPassageiros.find((p) => p.bitrix_deal_id === data.bitrix_deal_id);
    if (!existente && data.cpf) {
      existente = mockPassageiros.find((p) => p.expedicao_id === expedicao.id && p.cpf === data.cpf);
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
  const cpfDig = data.cpf ? data.cpf.replace(/\D/g, "") : null;

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

  /** Acha na expedição a linha cujo CPF (só dígitos) bate com o recebido. */
  const acharPorCpf = async (): Promise<Record<string, unknown> | null> => {
    if (!cpfDig) return null;
    const { data: rows } = await supabase.from("passageiros").select(cols).eq("expedicao_id", exp.id);
    return (
      ((rows ?? []) as Record<string, unknown>[]).find(
        (r) => String(r.cpf ?? "").replace(/\D/g, "") === cpfDig,
      ) ?? null
    );
  };

  // 1) Casa por bitrix_deal_id.
  const { data: byDeal } = await supabase
    .from("passageiros").select(cols).eq("bitrix_deal_id", data.bitrix_deal_id).maybeSingle();
  if (byDeal) return atualizar(byDeal as Record<string, unknown>);

  // 2) Não achou pelo deal → tenta pelo CPF (comparando por dígitos, tolerante a formato).
  const porCpf = await acharPorCpf();
  if (porCpf) return atualizar(porCpf);

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
    // Corrida / conflito de CPF: alguém já existe nessa expedição com esse CPF.
    // Re-acha e faz o update "só-vazio" em vez de quebrar.
    const conflito = await acharPorCpf();
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
