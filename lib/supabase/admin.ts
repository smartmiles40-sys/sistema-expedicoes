import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente service-role: somente para webhooks e jobs (server-side).
 * NUNCA usar em componente cliente — bypassa RLS.
 *
 * Tipo retornado é loose (any) — quando `supabase gen types typescript` rodar
 * contra o projeto real, trocar por SupabaseClient<Database>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceRoleClient(): SupabaseClient<any, "public", any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role nao configurado");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
