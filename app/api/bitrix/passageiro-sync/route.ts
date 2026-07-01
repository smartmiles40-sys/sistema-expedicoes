import { NextRequest, NextResponse } from "next/server";
import { passageiroSyncSchema } from "@/lib/bitrix/validators";
import { mapBitrixStage } from "@/lib/bitrix/stage-mapping";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockExpedicoes, mockPassageiros, mockPassageiroRequisitos } from "@/lib/mock-data";
import { construirRequisitosPadrao } from "@/lib/prontidao/template";
import { gerarRequisitosPadrao } from "@/app/(app)/expedicoes/actions";
import { isValidWebhookSecret } from "@/lib/security/secrets";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req.headers.get("x-webhook-secret"))) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = passageiroSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const status_reserva = mapBitrixStage(data.estagio_deal);

  // ========== DEV MODE: usa mocks ==========
  if (DEV_USE_MOCK_DATA) {
    const expedicao = mockExpedicoes.find((e) => e.codigo === data.expedicao_codigo);
    if (!expedicao) {
      return NextResponse.json(
        { ok: false, error: `Expedição ${data.expedicao_codigo} não encontrada` },
        { status: 404 },
      );
    }
    const existente = mockPassageiros.find((p) => p.bitrix_deal_id === data.bitrix_deal_id);
    if (existente) {
      Object.assign(existente, {
        nome_completo: data.nome_completo,
        email: data.email ?? existente.email,
        telefone: data.telefone ?? existente.telefone,
        cpf: data.cpf ?? existente.cpf,
        passaporte: data.passaporte ?? existente.passaporte,
        validade_passaporte: data.validade_passaporte ?? existente.validade_passaporte,
        data_nascimento: data.data_nascimento ?? existente.data_nascimento,
        voo_nacional_necessario: data.voo_nacional_necessario ?? existente.voo_nacional_necessario,
        observacoes: data.observacoes ?? existente.observacoes,
        status_reserva,
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({
        ok: true,
        passageiro_id: existente.id,
        action: "updated",
      });
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockPassageiros.push(novo);
    // Instancia os requisitos de embarque do destino para o novo pax.
    mockPassageiroRequisitos.push(
      ...construirRequisitosPadrao({ passageiro: novo, destino: expedicao.destino }),
    );
    return NextResponse.json({ ok: true, passageiro_id: novo.id, action: "created" });
  }

  // ========== PROD: Supabase ==========
  try {
    const supabase = createServiceRoleClient();
    // Resolve expedicao_id pelo codigo
    const expRes = await supabase
      .from("expedicoes")
      .select("id")
      .eq("codigo", data.expedicao_codigo)
      .maybeSingle();
    if (expRes.error || !expRes.data) {
      return NextResponse.json(
        { ok: false, error: `Expedição ${data.expedicao_codigo} não encontrada` },
        { status: 404 },
      );
    }
    const exp = expRes.data as { id: string };

    const upsertPayload = {
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
    };

    const { data: existing } = await supabase
      .from("passageiros")
      .select("id")
      .eq("bitrix_deal_id", data.bitrix_deal_id)
      .maybeSingle();
    const action: "created" | "updated" = existing ? "updated" : "created";

    const { data: result, error } = await supabase
      .from("passageiros")
      .upsert(upsertPayload, { onConflict: "bitrix_deal_id" })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const r = result as { id: string };

    // Audit log
    await supabase.from("audit_log").insert({
      tabela: "passageiros",
      registro_id: r.id,
      acao: action === "created" ? "insert" : "update",
      dados_depois: upsertPayload,
      origem: "bitrix-webhook",
    });

    // Garante os requisitos de embarque do destino (idempotente por pax).
    await gerarRequisitosPadrao(exp.id);

    return NextResponse.json({
      ok: true,
      passageiro_id: r.id,
      action,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
