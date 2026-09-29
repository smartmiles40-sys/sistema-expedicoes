"use server";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockExpedicoes } from "@/lib/mock-data";

/** Lista enxuta de expedições para o seletor de "Mudar de expedição". */
export type ExpedicaoResumo = { id: string; nome: string; destino: string; data_embarque: string | null; status: string };

export async function listExpedicoesResumo(): Promise<ExpedicaoResumo[]> {
  // Só expedições em grupo como destino do "mover" — não misturar com pacotes personalizados.
  const soExpedicao = <T extends { tipo?: string }>(e: T) => (e.tipo ?? "expedicao") === "expedicao";
  if (DEV_USE_MOCK_DATA) {
    return mockExpedicoes
      .filter(soExpedicao)
      .map((e) => ({ id: e.id, nome: e.nome, destino: e.destino, data_embarque: e.data_embarque, status: e.status }));
  }
  const sb = await getServerClient();
  const { data } = await sb.from("expedicoes").select("*").order("data_embarque", { ascending: true });
  return ((data ?? []) as (ExpedicaoResumo & { tipo?: string })[]).filter(soExpedicao);
}
