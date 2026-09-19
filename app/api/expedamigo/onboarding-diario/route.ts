import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assinarTokenAcesso } from "@/lib/expedamigo/first-access-token";
import { montarMensagemOnboarding } from "@/lib/expedamigo/onboarding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Código curto (sem caracteres ambíguos) pro link /a/<codigo>. */
function gerarCodigo(n = 10): string {
  const alfa = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += alfa[b[i] % alfa.length];
  return s;
}

/** Cria o link CURTO (grava em acesso_links); cai no link longo se falhar. */
async function criarLinkCurto(sb: ReturnType<typeof createServiceRoleClient>, passageiroId: string, base: string): Promise<string> {
  const expira_em = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  for (let i = 0; i < 4; i++) {
    const codigo = gerarCodigo();
    const { error } = await sb.from("acesso_links").insert({ codigo, passageiro_id: passageiroId, expira_em });
    if (!error) return `${base}/a/${codigo}`;
    if (!/duplicate|unique/i.test(error.message)) break; // colisão → tenta outro; outro erro → fallback
  }
  return `${base}/amigo/acesso?t=${assinarTokenAcesso(passageiroId)}`;
}

/**
 * Onboarding diário do ExpedAmigo (chamado pelo cron do n8n, DEPOIS do sync do Bitrix).
 *
 * Seleciona quem COMPROU (status_reserva = "Confirmado") e ainda NÃO foi onboarded
 * (`liberado_expedamigo` ≠ true) nas expedições ativas (futuras, não canceladas),
 * gera um LINK de 1º acesso (token) por pessoa, marca como liberado (idempotência —
 * não reenvia) e devolve a lista pronta pro n8n enviar por WhatsApp.
 *
 * Auth: header `x-webhook-secret` == WEBHOOK_SECRET.
 * Body (opcional): { dryRun?: boolean, expedicao_codigo?: string }.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret") ?? "";
  if (!DEV_USE_MOCK_DATA && secret !== (process.env.WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { dryRun?: boolean; expedicao_codigo?: string } = {};
  try { body = await req.json(); } catch { /* body vazio = ok */ }
  const dryRun = body.dryRun === true;

  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  if (DEV_USE_MOCK_DATA) {
    return NextResponse.json({ ok: true, dryRun, total: 0, enviar: [], pendencias: [], nota: "mock" });
  }

  const sb = createServiceRoleClient();
  const hoje = new Date().toISOString().slice(0, 10);

  // 1) expedições ativas (futuras, não canceladas), opcionalmente filtrando por código.
  let q = sb.from("expedicoes").select("id, codigo, nome, status, data_embarque").neq("status", "Cancelada").gte("data_embarque", hoje);
  if (body.expedicao_codigo) q = q.eq("codigo", body.expedicao_codigo);
  const { data: expsRaw, error: expErr } = await q;
  if (expErr) return NextResponse.json({ ok: false, error: expErr.message }, { status: 500 });
  const exps = (expsRaw ?? []) as { id: string; codigo: string; nome: string }[];
  const expById = new Map(exps.map((e) => [e.id, e]));
  if (!exps.length) return NextResponse.json({ ok: true, dryRun, total: 0, enviar: [], pendencias: [] });

  // 2) passageiros que COMPRARAM e ainda não foram onboarded.
  const { data: paxRaw, error: paxErr } = await sb
    .from("passageiros")
    .select("id, nome_completo, cpf, telefone, expedicao_id, liberado_expedamigo, status_reserva")
    .in("expedicao_id", exps.map((e) => e.id))
    .eq("status_reserva", "Confirmado")
    .neq("liberado_expedamigo", true);
  if (paxErr) return NextResponse.json({ ok: false, error: paxErr.message }, { status: 500 });
  const pax = (paxRaw ?? []) as { id: string; nome_completo: string; cpf: string | null; telefone: string | null; expedicao_id: string }[];

  const enviar: any[] = [];
  const pendencias: any[] = [];
  for (const p of pax) {
    if (/ACESSO TESTE/i.test(p.nome_completo)) continue;
    const exp = expById.get(p.expedicao_id);
    if (!exp) continue;
    // dryRun não grava nada → usa o link longo (por token). Real → link curto /a/<codigo>.
    const link = dryRun ? `${base}/amigo/acesso?t=${assinarTokenAcesso(p.id)}` : await criarLinkCurto(sb, p.id, base);
    const mensagem = montarMensagemOnboarding({ nome: p.nome_completo, expedicao: exp.nome, link });
    const item = {
      passageiro_id: p.id,
      nome: p.nome_completo,
      telefone: p.telefone,
      cpf: p.cpf,
      expedicao_codigo: exp.codigo,
      expedicao_nome: exp.nome,
      link,
      mensagem,
    };
    if (p.telefone && p.telefone.replace(/\D/g, "").length >= 10) enviar.push(item);
    else pendencias.push({ ...item, motivo: "sem telefone" });
  }

  // 3) idempotência: marca como liberado quem VAI receber (a menos que dryRun).
  if (!dryRun && enviar.length) {
    const ids = enviar.map((i) => i.passageiro_id);
    const { error } = await sb.from("passageiros").update({ liberado_expedamigo: true }).in("id", ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dryRun, total: enviar.length + pendencias.length, enviar, pendencias });
}
