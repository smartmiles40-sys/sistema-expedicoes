"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockPassageiros, mockExpedicoes } from "@/lib/mock-data";
import type { PassageiroRow, ExpedicaoRow } from "@/types/database";

export type InscricaoPendente = {
  id: string;
  expedicao_id: string | null;
  expedicao_nome: string;
  destino: string;
  data_embarque: string | null;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  acompanhante_nome: string | null;
  tem_passaporte: boolean;
  created_at: string;
};

function montar(p: PassageiroRow, e: ExpedicaoRow | undefined): InscricaoPendente {
  return {
    id: p.id,
    expedicao_id: p.expedicao_id,
    expedicao_nome: e?.nome ?? "—",
    destino: e?.destino ?? "—",
    data_embarque: e?.data_embarque ?? null,
    nome_completo: p.nome_completo,
    cpf: p.cpf,
    email: p.email,
    telefone: p.telefone,
    cidade: p.endereco_cidade,
    estado: p.endereco_estado,
    acompanhante_nome: p.acompanhante_nome,
    tem_passaporte: Boolean(p.passaporte_arquivo_id),
    created_at: p.created_at,
  };
}

export async function listInscricoesPendentes(): Promise<InscricaoPendente[]> {
  let pax: PassageiroRow[];
  let exps: ExpedicaoRow[];
  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros.filter((p) => p.pendente_aprovacao);
    exps = mockExpedicoes;
  } else {
    const sb = await getServerClient();
    const [{ data: p }, { data: e }] = await Promise.all([
      sb.from("passageiros").select("*").eq("pendente_aprovacao", true),
      sb.from("expedicoes").select("*"),
    ]);
    pax = (p ?? []) as PassageiroRow[];
    exps = (e ?? []) as ExpedicaoRow[];
  }
  const expById = new Map(exps.map((e) => [e.id, e]));
  return pax
    .map((p) => montar(p, p.expedicao_id ? expById.get(p.expedicao_id) : undefined))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function contarInscricoesPendentes(): Promise<number> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros.filter((p) => p.pendente_aprovacao).length;
  const sb = await getServerClient();
  const { count } = await sb.from("passageiros").select("id", { count: "exact", head: true }).eq("pendente_aprovacao", true);
  return count ?? 0;
}

export async function aprovarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const p = mockPassageiros.find((x) => x.id === id);
    if (!p) return { ok: false, error: "Inscrição não encontrada." };
    p.pendente_aprovacao = false;
    p.status_reserva = "Pré-reserva";
    p.updated_at = new Date().toISOString();
  } else {
    const sb = await getServerClient();
    const { error } = await sb
      .from("passageiros")
      .update({ pendente_aprovacao: false, status_reserva: "Pré-reserva" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/inscricoes");
  revalidatePath("/passageiros");
  return { ok: true };
}

export async function recusarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const i = mockPassageiros.findIndex((x) => x.id === id);
    if (i >= 0) mockPassageiros.splice(i, 1);
  } else {
    const sb = await getServerClient();
    // Só recusa quem ainda está pendente (trava contra apagar pax já aprovado).
    const { error } = await sb.from("passageiros").delete().eq("id", id).eq("pendente_aprovacao", true);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/inscricoes");
  return { ok: true };
}
