import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import type { ArquivoRow } from "@/types/database";

const mockArquivos: ArquivoRow[] = [];

export async function listArquivosExpedicao(expedicaoId: string): Promise<ArquivoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockArquivos
      .filter((a) => a.expedicao_id === expedicaoId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("arquivos")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ArquivoRow[];
}

export async function listArquivosPassageiro(passageiroId: string): Promise<ArquivoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockArquivos
      .filter((a) => a.passageiro_id === passageiroId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("arquivos")
    .select("*")
    .eq("passageiro_id", passageiroId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ArquivoRow[];
}
