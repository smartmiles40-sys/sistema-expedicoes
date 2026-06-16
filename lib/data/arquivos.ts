import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { listArquivosMock } from "@/lib/data/arquivos-mock";
import type { ArquivoRow } from "@/types/database";

export async function listArquivosExpedicao(expedicaoId: string): Promise<ArquivoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return (await listArquivosMock()).filter((a) => a.expedicao_id === expedicaoId);
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("arquivos")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ArquivoRow[];
}

/** Todos os arquivos vinculados a passageiros (alimenta o perfil global). */
export async function listArquivosDePassageiros(): Promise<ArquivoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return (await listArquivosMock()).filter((a) => a.passageiro_id != null);
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("arquivos")
    .select("*")
    .not("passageiro_id", "is", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as ArquivoRow[];
}

export async function listArquivosPassageiro(passageiroId: string): Promise<ArquivoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return (await listArquivosMock()).filter((a) => a.passageiro_id === passageiroId);
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("arquivos")
    .select("*")
    .eq("passageiro_id", passageiroId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ArquivoRow[];
}
