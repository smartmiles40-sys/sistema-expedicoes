import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import type { GrupoExpedicaoRow } from "@/types/database";

const mockGrupos: GrupoExpedicaoRow[] = [];

export async function listGruposExpedicao(expedicaoId: string): Promise<GrupoExpedicaoRow[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockGrupos.filter((g) => g.expedicao_id === expedicaoId).sort((a, b) => a.ordem - b.ordem);
  }
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("grupos_expedicao")
    .select("*")
    .eq("expedicao_id", expedicaoId)
    .order("ordem", { ascending: true });
  return (data ?? []) as GrupoExpedicaoRow[];
}
