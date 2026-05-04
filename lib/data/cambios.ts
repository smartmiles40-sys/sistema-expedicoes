import { DEV_BYPASS } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockCambios } from "@/lib/mock-data";
import type { CambioRow } from "@/types/database";

export async function listCambios(): Promise<CambioRow[]> {
  if (DEV_BYPASS) return mockCambios;
  const supabase = await getServerClient();
  const { data } = await supabase.from("cambios").select("*").order("moeda");
  return (data ?? []) as CambioRow[];
}

export async function getTaxaBrl(moeda: string): Promise<number> {
  const cambios = await listCambios();
  const c = cambios.find((x) => x.moeda === moeda);
  return c?.taxa_brl ?? 1.0;
}
