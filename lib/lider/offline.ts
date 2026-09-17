"use client";
/**
 * Armazenamento OFFLINE da Área do Líder (opção B — dados + documentos no aparelho),
 * POR EXPEDIÇÃO: o líder escolhe quais expedições preparar (não baixa tudo).
 *
 * IndexedDB guarda:
 *  - por expedição salva: { expId, cpf, senha, nome, master, expedicao, savedAt } — a
 *    senha fica pra poder atualizar/gerar URL assinada quando online (trade-off da opção B);
 *  - os DOCUMENTOS como blob (por arquivo_id) → abertos offline via URL.createObjectURL.
 *
 * Uma expedição salva fica CONGELADA (só muda quando o líder aperta "Atualizar" nela).
 */
import type { LiderExpedicao, LiderArquivo } from "@/app/lider/actions";

const DB_NAME = "lider-offline";
const DB_VER = 2; // v2: modelo por expedição (v1 era snapshot global)
const STORE_EXP = "expedicoes";
const STORE_DOCS = "docs";

export type ExpedicaoSalva = {
  expId: string;
  cpf: string;
  senha: string;
  nome: string;
  master: boolean;
  expedicao: LiderExpedicao;
  savedAt: string;
};
export type DocOffline = { blob: Blob; mime: string | null; nome: string };

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_EXP)) db.createObjectStore(STORE_EXP);
      if (!db.objectStoreNames.contains(STORE_DOCS)) db.createObjectStore(STORE_DOCS);
      if (db.objectStoreNames.contains("snapshot")) db.deleteObjectStore("snapshot"); // limpa o modelo v1
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** IndexedDB existe? (private mode/navegadores antigos podem não ter.) */
export function offlineSuportado(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function salvarExpedicao(s: ExpedicaoSalva): Promise<void> {
  await tx(STORE_EXP, "readwrite", (st) => st.put(s, s.expId));
}

/** Todas as expedições salvas (com dados completos — usado no render offline). */
export async function carregarExpedicoesSalvas(): Promise<ExpedicaoSalva[]> {
  try {
    const v = await tx<ExpedicaoSalva[]>(STORE_EXP, "readonly", (st) => st.getAll());
    return (v ?? []).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export async function salvarDoc(id: string, doc: DocOffline): Promise<void> {
  await tx(STORE_DOCS, "readwrite", (s) => s.put(doc, id));
}

export async function carregarDoc(id: string): Promise<DocOffline | null> {
  try {
    const v = await tx<DocOffline | undefined>(STORE_DOCS, "readonly", (s) => s.get(id));
    return v ?? null;
  } catch {
    return null;
  }
}

/** Remove UMA expedição salva + os documentos dela. */
export async function removerExpedicao(expId: string): Promise<void> {
  try {
    const s = await tx<ExpedicaoSalva | undefined>(STORE_EXP, "readonly", (st) => st.get(expId));
    if (s) for (const a of coletarArquivosExpedicao(s.expedicao)) await tx(STORE_DOCS, "readwrite", (st) => st.delete(a.id));
    await tx(STORE_EXP, "readwrite", (st) => st.delete(expId));
  } catch {
    /* ignora */
  }
}

/** Apaga TUDO (todas as expedições + documentos). */
export async function limparOffline(): Promise<void> {
  try {
    await tx(STORE_EXP, "readwrite", (s) => s.clear());
    await tx(STORE_DOCS, "readwrite", (s) => s.clear());
  } catch {
    /* ignora */
  }
}

/** Documentos (dedup por id) de UMA expedição — pra baixar/remover em lote. */
export function coletarArquivosExpedicao(exp: LiderExpedicao): LiderArquivo[] {
  const porId = new Map<string, LiderArquivo>();
  for (const a of exp.documentos) if (!porId.has(a.id)) porId.set(a.id, a);
  for (const p of exp.passageiros) {
    for (const a of p.arquivos) if (!porId.has(a.id)) porId.set(a.id, a);
    for (const c of p.checagens) for (const a of c.arquivos) if (!porId.has(a.id)) porId.set(a.id, a);
  }
  return [...porId.values()];
}

/** Bytes totais que o download offline vai baixar (soma dos documentos únicos). */
export function tamanhoOfflineExpedicao(exp: LiderExpedicao): { bytes: number; comTamanho: number; total: number } {
  const arqs = coletarArquivosExpedicao(exp);
  let bytes = 0;
  let comTamanho = 0;
  for (const a of arqs) {
    if (typeof a.tamanho === "number" && a.tamanho > 0) { bytes += a.tamanho; comTamanho++; }
  }
  return { bytes, comTamanho, total: arqs.length };
}

/** Formata bytes em KB/MB legível (pt-BR). */
export function formatarTamanho(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1).replace(".", ",")} MB`;
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
}
