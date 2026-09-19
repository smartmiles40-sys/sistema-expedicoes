import { NextRequest, NextResponse } from "next/server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assinarTokenAcesso } from "@/lib/expedamigo/first-access-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Link CURTO de 1º acesso: /a/<codigo> → resolve o passageiro (tabela `acesso_links`),
 * gera o token de 1º acesso e redireciona pra /amigo/acesso?t=... . Assim a mensagem do
 * WhatsApp leva uma URL curta, e o token longo só aparece depois do redirect.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  if (DEV_USE_MOCK_DATA) {
    return NextResponse.redirect(`${base}/amigo/acesso?t=${assinarTokenAcesso("mock")}`);
  }

  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("acesso_links")
    .select("passageiro_id, expira_em")
    .eq("codigo", codigo)
    .maybeSingle();

  const row = data as { passageiro_id: string; expira_em: string } | null;
  if (!row || new Date(row.expira_em).getTime() < Date.now()) {
    // Link inválido/expirado → cai no portal com um aviso.
    return NextResponse.redirect(`${base}/amigo?e=link`);
  }

  const token = assinarTokenAcesso(row.passageiro_id);
  return NextResponse.redirect(`${base}/amigo/acesso?t=${token}`);
}
