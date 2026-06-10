import { NextRequest, NextResponse } from "next/server";
import { expedicaoSyncSchema } from "@/lib/bitrix/validators";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockExpedicoes } from "@/lib/mock-data";
import { isValidWebhookSecret } from "@/lib/security/secrets";

export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = expedicaoSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const existente = mockExpedicoes.find((e) => e.bitrix_pipeline_id === data.bitrix_pipeline_id || e.codigo === data.codigo);
    if (existente) {
      Object.assign(existente, {
        nome: data.nome,
        destino: data.destino,
        data_embarque: data.data_embarque,
        data_retorno: data.data_retorno,
        pax_planejados: data.pax_planejados ?? existente.pax_planejados,
        preco_venda_brl: data.preco_venda_brl ?? existente.preco_venda_brl,
        bitrix_pipeline_id: data.bitrix_pipeline_id,
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, expedicao_id: existente.id, action: "updated" });
    }
    const novo = {
      id: `e${Math.random().toString(36).slice(2, 14)}`,
      codigo: data.codigo,
      nome: data.nome,
      destino: data.destino,
      data_embarque: data.data_embarque,
      data_retorno: data.data_retorno,
      responsavel_operacional_id: null,
      responsavel_comercial_id: null,
      dmc_principal_id: null,
      status: "Planejamento" as const,
      pax_planejados: data.pax_planejados ?? 0,
      pax_cortesia: 0,
      preco_venda_brl: data.preco_venda_brl ?? 0,
      bitrix_pipeline_id: data.bitrix_pipeline_id,
      ordem: null,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockExpedicoes.push(novo);
    return NextResponse.json({ ok: true, expedicao_id: novo.id, action: "created" });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: existing } = await supabase
      .from("expedicoes")
      .select("id")
      .or(`bitrix_pipeline_id.eq.${data.bitrix_pipeline_id},codigo.eq.${data.codigo}`)
      .maybeSingle();
    const action: "created" | "updated" = existing ? "updated" : "created";

    const upsertPayload = {
      codigo: data.codigo,
      nome: data.nome,
      destino: data.destino,
      data_embarque: data.data_embarque,
      data_retorno: data.data_retorno,
      pax_planejados: data.pax_planejados ?? 0,
      preco_venda_brl: data.preco_venda_brl ?? 0,
      bitrix_pipeline_id: data.bitrix_pipeline_id,
    };

    const { data: result, error } = await supabase
      .from("expedicoes")
      .upsert(upsertPayload, { onConflict: "codigo" })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const r = result as { id: string };

    return NextResponse.json({ ok: true, expedicao_id: r.id, action });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
