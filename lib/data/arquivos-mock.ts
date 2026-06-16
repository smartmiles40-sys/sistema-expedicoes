/**
 * Store local de arquivos para o modo mock (sem Supabase).
 *
 * Espelha o Storage + tabela `arquivos` em disco, sob `.dev-uploads/` na raiz do
 * projeto: os bytes viram um `.blob` por id e os metadados ficam num `index.json`.
 * Assim o upload de documentos funciona localmente para testes; quando o Supabase
 * conectar, as rotas usam o caminho real e este store fica inerte.
 *
 * Server-only (usa node:fs).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ArquivoRow } from "@/types/database";
import type { CategoriaArquivo } from "@/lib/constants";

const DIR = path.join(process.cwd(), ".dev-uploads");
const INDEX = path.join(DIR, "index.json");
const blobPath = (id: string) => path.join(DIR, `${id}.blob`);

async function readIndex(): Promise<ArquivoRow[]> {
  try {
    return JSON.parse(await fs.readFile(INDEX, "utf8")) as ArquivoRow[];
  } catch {
    return [];
  }
}

async function writeIndex(rows: ArquivoRow[]): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(INDEX, JSON.stringify(rows, null, 2), "utf8");
}

export async function listArquivosMock(): Promise<ArquivoRow[]> {
  const rows = await readIndex();
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addArquivoMock(
  meta: {
    expedicao_id: string;
    passageiro_id: string | null;
    categoria: CategoriaArquivo;
    nome: string;
    descricao: string | null;
    mime: string | null;
    tamanho_bytes: number | null;
  },
  bytes: Buffer,
): Promise<ArquivoRow> {
  await fs.mkdir(DIR, { recursive: true });
  const id = randomUUID();
  const now = new Date().toISOString();
  await fs.writeFile(blobPath(id), bytes);
  const row: ArquivoRow = {
    id,
    expedicao_id: meta.expedicao_id,
    passageiro_id: meta.passageiro_id,
    categoria: meta.categoria,
    nome: meta.nome,
    descricao: meta.descricao,
    mime: meta.mime,
    tamanho_bytes: meta.tamanho_bytes,
    storage_path: blobPath(id),
    uploaded_by: null,
    created_at: now,
    updated_at: now,
  };
  const rows = await readIndex();
  rows.push(row);
  await writeIndex(rows);
  return row;
}

export async function getArquivoMock(
  id: string,
): Promise<{ row: ArquivoRow; bytes: Buffer } | null> {
  const rows = await readIndex();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  try {
    const bytes = await fs.readFile(blobPath(id));
    return { row, bytes };
  } catch {
    return null;
  }
}

export async function removeArquivoMock(id: string): Promise<boolean> {
  const rows = await readIndex();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  rows.splice(idx, 1);
  await writeIndex(rows);
  try {
    await fs.rm(blobPath(id));
  } catch {
    // blob já ausente — tudo bem
  }
  return true;
}
