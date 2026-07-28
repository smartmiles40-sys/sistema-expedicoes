import { NextRequest, NextResponse } from "next/server";
import { passageiroSyncSchema } from "@/lib/bitrix/validators";
import { upsertPassageiroBitrix } from "@/lib/bitrix/upsert-passageiro";
import { isValidWebhookSecret } from "@/lib/security/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Recebe do n8n o CONTATO CRU do Bitrix (objeto do crm.contact.get) + o código da
 * expedição + o id do deal + o endereço do deal, TRADUZ os campos custom aqui
 * (CPF, passaporte, datas, telefone/e-mail, endereço) e faz o upsert do passageiro
 * (política "só preenche vazio" — ver upsertPassageiroBitrix). Assim o n8n vira só
 * HTTP Request (sem Code node). Estágio é sempre "WON".
 */

// Campos custom do contato no Bitrix (ver docs/N8N_INTEGRATION.md).
const F_CPF = "UF_CRM_1752691408782", F_CPF_ALT = "UF_CRM_1749757426655";
const F_PASS = "UF_CRM_1752523114589", F_PASS_ALT = "UF_CRM_1783969513247";
const F_VENC = "UF_CRM_1752523126895";

const soDig = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const multi = (v: unknown): string | null =>
  Array.isArray(v) && v.length ? ((v[0] as { VALUE?: string })?.VALUE ?? null) : null;

/** Normaliza data do Bitrix (ISO "2029-07-04T..." ou "DD/MM/AAAA") para "AAAA-MM-DD". */
function toISO(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})[/.](\d{2})[/.](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Endereço vem do DEAL (campo "Endereço de entrega") no formato
 * "<endereço>|<lat>;<lng>|<locId>". Pega o texto antes do "|", extrai o CEP e
 * devolve o resto como "rua" (o operacional refina depois, se quiser).
 */
function parseEndereco(raw: unknown): { cep: string | null; rua: string | null } {
  const s0 = String(raw ?? "").split("|")[0].trim();
  if (!s0) return { cep: null, rua: null };
  const m = s0.match(/(\d{5}-?\d{3})/);
  const cep = m ? m[1] : null;
  const rua = s0.replace(/[-,\s]*cep[:\s]*\d{5}-?\d{3}\s*$/i, "").replace(/[-,\s]+$/, "").trim() || null;
  return { cep, rua };
}

export async function POST(req: NextRequest) {
  if (!isValidWebhookSecret(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    expedicao_codigo?: string;
    bitrix_deal_id?: string | number;
    contato?: Record<string, unknown>;
    endereco?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const c = body.contato ?? {};
  const nome = [c.NAME, c.SECOND_NAME, c.LAST_NAME].filter(Boolean).map(String).join(" ").trim();

  // CPF: usa "CPF 2" (string); se vazio, cai no "CPF" (double) preenchendo zeros à esquerda.
  let cpf = soDig(c[F_CPF]);
  if (cpf.length < 11) {
    const alt = soDig(c[F_CPF_ALT]);
    if (alt) cpf = alt.padStart(11, "0");
  }

  const emailRaw = multi(c.EMAIL);
  const email = emailRaw && emailValido(emailRaw) ? emailRaw : null;

  const payload = {
    expedicao_codigo: body.expedicao_codigo ?? "",
    bitrix_deal_id: body.bitrix_deal_id != null ? String(body.bitrix_deal_id) : "",
    bitrix_contact_id: c.ID != null ? String(c.ID) : null,
    estagio_deal: "WON",
    nome_completo: nome || "Sem nome",
    cpf: cpf || null,
    passaporte: (c[F_PASS] as string) || (c[F_PASS_ALT] as string) || null,
    validade_passaporte: toISO(c[F_VENC]),
    data_nascimento: toISO(c.BIRTHDATE),
    email,
    telefone: multi(c.PHONE),
  };

  const parsed = passageiroSyncSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validação falhou", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const end = parseEndereco(body.endereco);

  try {
    const r = await upsertPassageiroBitrix(parsed.data, { endereco_cep: end.cep, endereco_rua: end.rua });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, passageiro_id: r.passageiro_id, action: r.action, nome: payload.nome_completo });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
