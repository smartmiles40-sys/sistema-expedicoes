import { DEV_BYPASS } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockFornecedores } from "@/lib/mock-data";
import type { FornecedorRow } from "@/types/database";

export async function listFornecedores(): Promise<FornecedorRow[]> {
  if (DEV_BYPASS) return mockFornecedores;
  const supabase = await getServerClient();
  const { data } = await supabase.from("fornecedores").select("*").order("nome");
  return (data ?? []) as FornecedorRow[];
}
