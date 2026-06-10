import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { mockCambios } from "@/lib/mock-data";
import { buscarTaxasBrl } from "@/lib/cambio/fetch";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isValidCronBearer } from "@/lib/security/secrets";

export const dynamic = "force-dynamic";

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

  let taxas: Record<string, number>;
  try {
    taxas = await buscarTaxasBrl();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "fetch falhou" },
      { status: 502 },
    );
  }

  const agora = new Date().toISOString();
  const linhas = Object.entries(taxas).map(([moeda, taxa_brl]) => ({
    moeda,
    taxa_brl,
    atualizado_em: agora,
  }));

  if (DEV_USE_MOCK_DATA) {
    for (const l of linhas) {
      const existente = mockCambios.find((c) => c.moeda === l.moeda);
      if (existente) {
        existente.taxa_brl = l.taxa_brl;
        existente.atualizado_em = l.atualizado_em;
      } else {
        mockCambios.push(l);
      }
    }
    return NextResponse.json({ ok: true, atualizados: linhas.length, fonte: "open.er-api.com (mock)" });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("cambios").upsert(linhas, { onConflict: "moeda" });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, atualizados: linhas.length, fonte: "open.er-api.com" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "upsert falhou" },
      { status: 500 },
    );
  }
}

export const GET = handler;
export const POST = handler;
