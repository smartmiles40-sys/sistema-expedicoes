import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { mockExpedicoes } from "@/lib/mock-data";
import { isValidCronBearer } from "@/lib/security/secrets";
import { sincronizarTodasExpedicoesBitrix } from "@/lib/bitrix/sync-expedicao";

export const dynamic = "force-dynamic";

/**
 * Avança status de expedições baseado em data:
 *   - Planejamento / Vendas Abertas → Em andamento, quando data_embarque <= hoje
 *   - Em andamento → Concluída, quando data_retorno < hoje
 *
 * NÃO toca em status terminais (Concluída, Cancelada). Override manual sempre vence.
 */
async function handler(req: NextRequest) {
  if (!DEV_AUTH_BYPASS) {
    if (req.method === "GET") {
      if (!isValidCronBearer(req.headers.get("authorization"))) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  const hojeISO = new Date().toISOString().slice(0, 10);

  if (DEV_USE_MOCK_DATA) {
    let avancouEmAndamento = 0;
    let avancouConcluida = 0;
    for (const e of mockExpedicoes) {
      if (e.status === "Concluída" || e.status === "Cancelada") continue;
      if (e.data_retorno && e.data_retorno < hojeISO) {
        e.status = "Concluída";
        e.updated_at = new Date().toISOString();
        avancouConcluida++;
      } else if (
        (e.status === "Planejamento" || e.status === "Vendas Abertas") &&
        e.data_embarque &&
        e.data_embarque <= hojeISO
      ) {
        e.status = "Em andamento";
        e.updated_at = new Date().toISOString();
        avancouEmAndamento++;
      }
    }
    return NextResponse.json({ ok: true, hoje: hojeISO, em_andamento: avancouEmAndamento, concluidas: avancouConcluida });
  }

  try {
    const supabase = createServiceRoleClient();

    const r1 = await supabase
      .from("expedicoes")
      .update({ status: "Em andamento" })
      .in("status", ["Planejamento", "Vendas Abertas"])
      .lte("data_embarque", hojeISO)
      .gte("data_retorno", hojeISO)
      .select("id");

    const r2 = await supabase
      .from("expedicoes")
      .update({ status: "Concluída" })
      .neq("status", "Cancelada")
      .neq("status", "Concluída")
      .lt("data_retorno", hojeISO)
      .select("id");

    // Fan-out diário (09:00 BRT): sincroniza os passageiros de TODAS as expedições
    // ativas a partir do Bitrix (webhook único do n8n). Roda SEMPRE (best-effort),
    // mesmo se a atualização de status acima falhar — é o "cron de sync de todas".
    let bitrix: { total: number; enviados: number; pulados: number } | { erro: string };
    try {
      const r = await sincronizarTodasExpedicoesBitrix(supabase);
      bitrix = r.ok ? { total: r.total, enviados: r.enviados, pulados: r.pulados } : { erro: r.error ?? "falha" };
    } catch (e) {
      bitrix = { erro: e instanceof Error ? e.message : "falha" };
    }

    if (r1.error || r2.error) {
      return NextResponse.json(
        { ok: false, error: r1.error?.message ?? r2.error?.message, bitrix },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      hoje: hojeISO,
      em_andamento: (r1.data ?? []).length,
      concluidas: (r2.data ?? []).length,
      bitrix,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export const GET = handler;
export const POST = handler;
