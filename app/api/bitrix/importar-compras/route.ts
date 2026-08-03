import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isValidWebhookSecret } from "@/lib/security/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Recebe do n8n os NEGÓCIOS GANHOS (deals WON) do Bitrix e grava em `compras_bitrix`
 * (upsert idempotente por bitrix_deal_id). Aceita um lote: `{ compras: [ ... ] }`
 * (ou uma compra só). O n8n só precisa de nós HTTP Request (lista os deals ganhos,
 * pega o contato de cada um, e manda pra cá).
 */

const soDig = (v: unknown) => String(v ?? "").replace(/\D/g, "") || null;

/** Normaliza data do Bitrix (ISO ou DD/MM/AAAA) para "AAAA-MM-DD". */
function toISO(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})[/.](\d{2})[/.](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const compraSchema = z.object({
  bitrix_deal_id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  bitrix_contact_id: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v))),
  cpf: z.string().nullish(),
  nome_contato: z.string().nullish(),
  titulo: z.string().nullish(),
  data_compra: z.string().nullish(),
  valor: z.union([z.string(), z.number()]).nullish(),
  moeda: z.string().nullish(),
  funil: z.string().nullish(),
  etapa: z.string().nullish(),
});

const bodySchema = z.object({ compras: z.array(compraSchema).max(1000) });

export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Aceita { compras: [...] }, um array direto, ou uma compra única.
  const normalizado = Array.isArray(raw)
    ? { compras: raw }
    : raw && typeof raw === "object" && "compras" in raw
      ? raw
      : { compras: [raw] };

  const parsed = bodySchema.safeParse(normalizado);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validação falhou", issues: parsed.error.issues }, { status: 400 });
  }

  const linhas = parsed.data.compras.map((c) => {
    const valorNum = c.valor == null ? null : Number(String(c.valor).replace(",", "."));
    return {
      bitrix_deal_id: c.bitrix_deal_id,
      bitrix_contact_id: c.bitrix_contact_id ?? null,
      cpf: soDig(c.cpf),
      nome_contato: c.nome_contato?.trim() || null,
      titulo: c.titulo?.trim() || null,
      data_compra: toISO(c.data_compra),
      valor: valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
      moeda: c.moeda?.trim() || "BRL",
      funil: c.funil?.trim() || null,
      etapa: c.etapa?.trim() || null,
    };
  });

  try {
    const sb = createServiceRoleClient();
    const { error } = await sb.from("compras_bitrix").upsert(linhas, { onConflict: "bitrix_deal_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, gravadas: linhas.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
