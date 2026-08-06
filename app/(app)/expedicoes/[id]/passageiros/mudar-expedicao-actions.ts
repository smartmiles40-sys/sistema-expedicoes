"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockExpedicoes } from "@/lib/mock-data";

/** Lista enxuta de expedições para o seletor de "Mudar de expedição". */
export type ExpedicaoResumo = { id: string; nome: string; destino: string; data_embarque: string | null; status: string };

export async function listExpedicoesResumo(): Promise<ExpedicaoResumo[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockExpedicoes.map((e) => ({ id: e.id, nome: e.nome, destino: e.destino, data_embarque: e.data_embarque, status: e.status }));
  }
  const sb = await getServerClient();
  const { data } = await sb.from("expedicoes").select("id,nome,destino,data_embarque,status").order("data_embarque", { ascending: true });
  return (data ?? []) as ExpedicaoResumo[];
}
