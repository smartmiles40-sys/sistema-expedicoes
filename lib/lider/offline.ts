"use client";
/**
 * Armazenamento OFFLINE da Área do Líder (opção B — dados + documentos no aparelho).
 *
 * Guarda no IndexedDB do dispositivo:
 *  - um SNAPSHOT congelado: { cpf, senha, dados, savedAt } (a senha fica pra poder
 *    atualizar/gerar URL assinada quando online — trade-off aceito na opção B);
 *  - os DOCUMENTOS como blob (por arquivo_id) → abertos offline via URL.createObjectURL.
 *
 * O snapshot é ÚNICO (chave "current"): salvar de novo substitui. Uma vez salvo, a
 * tela abre nele e NÃO atualiza sozinha (nem online) — só no botão manual.
 */
import type { LiderDados, LiderArquivo } from "@/app/lider/actions";

const DB_NAME = "lider-offline";
const DB_VER = 1;
const STORE_SNAP = "snapshot";
const STORE_DOCS = "docs";
const SNAP_KEY = "current";

export type SnapshotLider = { cpf: string; senha: string; dados: LiderDados; savedAt: string };
export type DocOffline = { blob: Blob; mime: string | null; nome: string };

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SNAP)) db.createObjectStore(STORE_SNAP);
      if (!db.objectStoreNames.contains(STORE_DOCS)) db.createObjectStore(STORE_DOCS);
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

export async function salvarSnapshot(snap: SnapshotLider): Promise<void> {
  await tx(STORE_SNAP, "readwrite", (s) => s.put(snap, SNAP_KEY));
}

export async function carregarSnapshot(): Promise<SnapshotLider | null> {
  try {
    const v = await tx<SnapshotLider | undefined>(STORE_SNAP, "readonly", (s) => s.get(SNAP_KEY));
    return v ?? null;
  } catch {
    return null;
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

/** Apaga TUDO (snapshot + documentos) — usado no "Sair e limpar dados offline". */
export async function limparOffline(): Promise<void> {
  try {
    await tx(STORE_SNAP, "readwrite", (s) => s.clear());
    await tx(STORE_DOCS, "readwrite", (s) => s.clear());
  } catch {
    /* ignora */
  }
}

/** Todos os documentos (dedup por id) de um LiderDados — pra baixar em lote. */
export function coletarArquivos(dados: LiderDados): LiderArquivo[] {
  const porId = new Map<string, LiderArquivo>();
  for (const e of dados.expedicoes) {
    for (const p of e.passageiros) {
      for (const a of p.arquivos) if (!porId.has(a.id)) porId.set(a.id, a);
      for (const c of p.checagens) for (const a of c.arquivos) if (!porId.has(a.id)) porId.set(a.id, a);
    }
  }
  return [...porId.values()];
}
