"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import {
  mockRoteiroDias, mockExpedicaoVoos, mockExpedicaoPasseios, mockExpedicaoInfo,
  mockExpedicaoAvisos, mockRoteiroDiaFotos,
} from "@/lib/mock-data";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { removeArquivoMock } from "@/lib/data/arquivos-mock";

/**
 * CRUD genérico das tabelas de conteúdo do Portal do ExpedAmigo (migrations 0021/0022).
 * O cliente passa o nome da tabela; validamos contra uma allowlist.
 */
const TABELAS = ["roteiro_dias", "expedicao_voos", "expedicao_passeios", "expedicao_info", "expedicao_avisos"] as const;
export type TabelaPortal = (typeof TABELAS)[number];

type Valores = Record<string, string | number | boolean | null>;
type MockRow = Valores & { id: string; expedicao_id: string; ordem: number; created_at: string; updated_at: string };

const MOCKS: Record<TabelaPortal, MockRow[]> = {
  roteiro_dias: mockRoteiroDias as unknown as MockRow[],
  expedicao_voos: mockExpedicaoVoos as unknown as MockRow[],
  expedicao_passeios: mockExpedicaoPasseios as unknown as MockRow[],
  expedicao_info: mockExpedicaoInfo as unknown as MockRow[],
  expedicao_avisos: mockExpedicaoAvisos as unknown as MockRow[],
};

const BUCKET = "arquivos-expedicoes";

// Cliente "frouxo" só para estas 4 tabelas (evita atrito de tipos com union de tabelas).
type Row = Record<string, unknown>;
interface LooseClient {
  from(table: string): {
    select(cols: string, opts?: { count: "exact"; head: true }): { eq(c: string, v: string): Promise<{ count: number | null }> };
    insert(v: Row): { select(c: string): { single(): Promise<{ data: { id: string } | null; error: { message: string } | null }> } };
    update(v: Row): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
    delete(): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
  };
}

function valida(tabela: string): tabela is TabelaPortal {
  return (TABELAS as readonly string[]).includes(tabela);
}
function mockId() {
  return `m${Math.random().toString(36).slice(2, 10)}`;
}
async function loose() {
  return (await getServerClient()) as unknown as LooseClient;
}

export async function criarItemPortal(
  tabela: string,
  expedicaoId: string,
  valores: Valores,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!valida(tabela)) return { ok: false, error: "Tabela inválida" };
  if (DEV_USE_MOCK_DATA) {
    const arr = MOCKS[tabela];
    const id = mockId();
    const agora = new Date().toISOString();
    const ordem = arr.filter((r) => r.expedicao_id === expedicaoId).length;
    arr.push({ id, expedicao_id: expedicaoId, ordem, created_at: agora, updated_at: agora, ...valores });
    revalidatePath(`/expedicoes/${expedicaoId}/portal`);
    return { ok: true, id };
  }
  const sb = await loose();
  const { count } = await sb.from(tabela).select("id", { count: "exact", head: true }).eq("expedicao_id", expedicaoId);
  const { data, error } = await sb
    .from(tabela)
    .insert({ expedicao_id: expedicaoId, ordem: count ?? 0, ...valores })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar" };
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true, id: data.id };
}

export async function atualizarItemPortal(
  tabela: string,
  id: string,
  expedicaoId: string,
  valores: Valores,
): Promise<{ ok: boolean; error?: string }> {
  if (!valida(tabela)) return { ok: false, error: "Tabela inválida" };
  if (DEV_USE_MOCK_DATA) {
    const arr = MOCKS[tabela];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: false, error: "Item não encontrado" };
    Object.assign(arr[idx], valores, { updated_at: new Date().toISOString() });
    revalidatePath(`/expedicoes/${expedicaoId}/portal`);
    return { ok: true };
  }
  const sb = await loose();
  const { error } = await sb.from(tabela).update(valores).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true };
}

export async function excluirItemPortal(
  tabela: string,
  id: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!valida(tabela)) return { ok: false, error: "Tabela inválida" };
  if (DEV_USE_MOCK_DATA) {
    const arr = MOCKS[tabela];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx !== -1) arr.splice(idx, 1);
    revalidatePath(`/expedicoes/${expedicaoId}/portal`);
    return { ok: true };
  }
  const sb = await loose();
  const { error } = await sb.from(tabela).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true };
}

// ===== Fotos do roteiro (o blob já foi enviado via /api/arquivos/upload) =====

export async function adicionarFotoRoteiro(
  expedicaoId: string,
  roteiroDiaId: string,
  arquivoId: string,
  legenda: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const agora = new Date().toISOString();
    const ordem = mockRoteiroDiaFotos.filter((f) => f.roteiro_dia_id === roteiroDiaId).length;
    mockRoteiroDiaFotos.push({
      id: mockId(), expedicao_id: expedicaoId, roteiro_dia_id: roteiroDiaId,
      arquivo_id: arquivoId, legenda: legenda || null, ordem, created_at: agora, updated_at: agora,
    });
    revalidatePath(`/expedicoes/${expedicaoId}/portal`);
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { count } = await sb
    .from("roteiro_dia_fotos")
    .select("id", { count: "exact", head: true })
    .eq("roteiro_dia_id", roteiroDiaId);
  const { error } = await sb.from("roteiro_dia_fotos").insert({
    expedicao_id: expedicaoId, roteiro_dia_id: roteiroDiaId, arquivo_id: arquivoId,
    legenda: legenda || null, ordem: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true };
}

export async function excluirFotoRoteiro(
  fotoId: string,
  arquivoId: string,
  expedicaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const idx = mockRoteiroDiaFotos.findIndex((f) => f.id === fotoId);
    if (idx !== -1) mockRoteiroDiaFotos.splice(idx, 1);
    await removeArquivoMock(arquivoId);
    revalidatePath(`/expedicoes/${expedicaoId}/portal`);
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  await sb.from("roteiro_dia_fotos").delete().eq("id", fotoId);
  // Remove o blob do Storage e a linha de arquivos (best-effort).
  const { data: arq } = await sb.from("arquivos").select("storage_path").eq("id", arquivoId).maybeSingle();
  const sp = (arq as { storage_path: string } | null)?.storage_path;
  if (sp) await sb.storage.from(BUCKET).remove([sp]);
  await sb.from("arquivos").delete().eq("id", arquivoId);
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true };
}
