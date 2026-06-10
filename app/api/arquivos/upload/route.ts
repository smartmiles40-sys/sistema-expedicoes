import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { DEV_AUTH_BYPASS } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { CATEGORIA_ARQUIVO, type CategoriaArquivo } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "arquivos-expedicoes";

function safeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export async function POST(req: NextRequest) {
  if (!DEV_AUTH_BYPASS) {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "multipart inválido" }, { status: 400 });
  }

  const file = form.get("file");
  const expedicao_id = String(form.get("expedicao_id") ?? "");
  const passageiro_id = form.get("passageiro_id") ? String(form.get("passageiro_id")) : null;
  const categoriaRaw = String(form.get("categoria") ?? "Outros");
  const descricao = form.get("descricao") ? String(form.get("descricao")) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "arquivo ausente" }, { status: 400 });
  }
  if (!expedicao_id) {
    return NextResponse.json({ ok: false, error: "expedicao_id obrigatório" }, { status: 400 });
  }
  if (!CATEGORIA_ARQUIVO.includes(categoriaRaw as CategoriaArquivo)) {
    return NextResponse.json({ ok: false, error: "categoria inválida" }, { status: 400 });
  }
  const categoria = categoriaRaw as CategoriaArquivo;

  const supabase = createServiceRoleClient();
  const filename = safeName(file.name);
  const storage_path = passageiro_id
    ? `${expedicao_id}/passageiros/${passageiro_id}/${categoria}/${randomUUID()}-${filename}`
    : `${expedicao_id}/${categoria}/${randomUUID()}-${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const up = await supabase.storage.from(BUCKET).upload(storage_path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) {
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }

  const ins = await supabase
    .from("arquivos")
    .insert({
      expedicao_id,
      passageiro_id,
      categoria,
      nome: file.name,
      descricao,
      mime: file.type || null,
      tamanho_bytes: file.size,
      storage_path,
    })
    .select("id")
    .single();

  if (ins.error) {
    await supabase.storage.from(BUCKET).remove([storage_path]);
    return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: (ins.data as { id: string }).id });
}
