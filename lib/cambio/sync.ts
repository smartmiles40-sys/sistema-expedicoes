import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient, type AnyClient } from "@/lib/supabase/typed";
import { mockCambios } from "@/lib/mock-data";
import { buscarTaxasBrl } from "@/lib/cambio/fetch";

export type SyncCambiosResult =
  | { ok: true; atualizados: number; fonte: string }
  | { ok: false; error: string };

/**
 * Núcleo da sincronização de câmbios: busca as taxas em BRL e persiste.
 * Compartilhado pelo server action (botão "Atualizar agora") e pelo route
 * handler do cron, pra não divergirem.
 *
 * Em modo mock muta `mockCambios` em memória; em prod faz upsert no Supabase.
 * NÃO chama revalidatePath — isso é responsabilidade do server action, que
 * roda no contexto certo pra invalidar o cache das páginas.
 *
 * @param supabaseOverride client a usar no upsert. O cron passa o service role
 *   (não tem sessão de usuário pra autorizar a RLS); a action deixa em branco
 *   e usa o client padrão da sessão. Ignorado em modo mock.
 */
export async function sincronizarTaxas(supabaseOverride?: AnyClient): Promise<SyncCambiosResult> {
  let taxas: Record<string, number>;
  try {
    taxas = await buscarTaxasBrl();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch falhou" };
  }

  const agora = new Date().toISOString();
  const linhas = Object.entries(taxas).map(([moeda, taxa_brl]) => ({
    moeda,
    taxa_brl,
    atualizado_em: agora,
  }));

  if (DEV_USE_MOCK_DATA) {
    for (const l of linhas) {
      const existente = mockCambios.find((c) => c.moeda === l.moeda);
      if (existente) {
        existente.taxa_brl = l.taxa_brl;
        existente.atualizado_em = l.atualizado_em;
      } else {
        mockCambios.push(l);
      }
    }
    return { ok: true, atualizados: linhas.length, fonte: "open.er-api.com (mock)" };
  }

  const supabase = supabaseOverride ?? (await getServerClient());
  const { error } = await supabase.from("cambios").upsert(linhas, { onConflict: "moeda" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, atualizados: linhas.length, fonte: "open.er-api.com" };
}
