import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeEditar } from "@/lib/auth/permissoes";
import { removeArquivoMock, updateArquivoDescricaoMock, getArquivoMock } from "@/lib/data/arquivos-mock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "arquivos-expedicoes";

/**
 * Edita o NOME de exibição (campo `descricao`) de um arquivo. Usado pelo painel de
 * documentos pra definir como o voucher aparece no portal do passageiro. Restrito à
 * categoria "Vouchers" — `descricao` em outras categorias é marcador funcional
 * (prontidão "<tipo> — prontidão", doc do líder) e NÃO pode ser sobrescrito aqui.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!DEV_AUTH_BYPASS) {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!podeEditar(u.papel)) return NextResponse.json({ ok: false, error: "Seu perfil é somente leitura." }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { descricao?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "corpo inválido" }, { status: 400 });
  }
  const raw = typeof body.descricao === "string" ? body.descricao.trim().slice(0, 200) : "";
  const descricao = raw || null; // vazio limpa → volta a usar o nome do arquivo

  if (DEV_USE_MOCK_DATA) {
    const arq = await getArquivoMock(id);
    if (!arq) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });
    if (arq.row.categoria !== "Vouchers") {
      return NextResponse.json({ ok: false, error: "só vouchers têm nome de exibição editável" }, { status: 400 });
    }
    const ok = await updateArquivoDescricaoMock(id, descricao);
    if (!ok) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("arquivos")
    .select("categoria")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });
  if ((row as { categoria: string }).categoria !== "Vouchers") {
    return NextResponse.json({ ok: false, error: "só vouchers têm nome de exibição editável" }, { status: 400 });
  }
  const { error } = await supabase.from("arquivos").update({ descricao }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!DEV_AUTH_BYPASS) {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!podeEditar(u.papel)) return NextResponse.json({ ok: false, error: "Seu perfil é somente leitura." }, { status: 403 });
  }
  const { id } = await ctx.params;

  // Modo mock: remove do store local.
  if (DEV_USE_MOCK_DATA) {
    const ok = await removeArquivoMock(id);
    if (!ok) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("arquivos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: false, error: "não encontrado" }, { status: 404 });
  const r = row as { storage_path: string };

  await supabase.storage.from(BUCKET).remove([r.storage_path]);
  const { error } = await supabase.from("arquivos").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
