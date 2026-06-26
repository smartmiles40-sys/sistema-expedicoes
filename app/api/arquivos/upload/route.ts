import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { addArquivoMock } from "@/lib/data/arquivos-mock";
import {
  CATEGORIA_ARQUIVO,
  type CategoriaArquivo,
  MAX_UPLOAD_BYTES,
  MIME_ARQUIVO_PERMITIDOS,
} from "@/lib/constants";

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

  // Valida tamanho ANTES de ler o corpo na memória (barra DoS de storage).
  if (file.size > MAX_UPLOAD_BYTES) {
    const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return NextResponse.json(
      { ok: false, error: `arquivo excede o limite de ${maxMb} MB` },
      { status: 413 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "arquivo vazio" }, { status: 400 });
  }
  if (!MIME_ARQUIVO_PERMITIDOS.includes(file.type as (typeof MIME_ARQUIVO_PERMITIDOS)[number])) {
    return NextResponse.json(
      { ok: false, error: `tipo de arquivo não permitido: ${file.type || "desconhecido"}` },
      { status: 415 },
    );
  }

  // Modo mock (sem Supabase): persiste em disco sob .dev-uploads/.
  if (DEV_USE_MOCK_DATA) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const row = await addArquivoMock(
      {
        expedicao_id,
        passageiro_id,
        categoria,
        nome: file.name,
        descricao,
        mime: file.type || null,
        tamanho_bytes: file.size,
      },
      buffer,
    );
    return NextResponse.json({ ok: true, id: row.id });
  }

  const supabase = createServiceRoleClient();
  const filename = safeName(file.name);
  // A categoria vira pasta no Storage; o Supabase rejeita acento/não-ASCII na
  // chave (ex.: "Aéreos"). Sanitiza só o caminho — o banco guarda a label original.
  const catPasta = safeName(categoria);
  const storage_path = passageiro_id
    ? `${expedicao_id}/passageiros/${passageiro_id}/${catPasta}/${randomUUID()}-${filename}`
    : `${expedicao_id}/${catPasta}/${randomUUID()}-${filename}`;

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
