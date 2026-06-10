/**
 * Workaround: nossa Database type custom escrita à mão não satisfaz exatamente
 * o constraint do @supabase/ssr (que espera o formato gerado pelo `supabase gen types`).
 * Uma vez que o Supabase real estiver conectado, regerar e remover este arquivo.
 *
 * Em modo "auth bypass + Supabase real" (DEV_AUTH_BYPASS=true e DEV_USE_MOCK_DATA=false),
 * cai em service_role pra contornar RLS — não há JWT de usuario logado pra autorizar.
 * NÃO usar essa combinação em prod.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "./server";
import { createServiceRoleClient } from "./admin";
import { DEV_AUTH_BYPASS, DEV_USE_MOCK_DATA } from "@/lib/dev-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyClient = SupabaseClient<any, "public", any>;

export async function getServerClient(): Promise<AnyClient> {
  if (DEV_AUTH_BYPASS && !DEV_USE_MOCK_DATA) {
    return createServiceRoleClient() as unknown as AnyClient;
  }
  const c = await createServerSupabase();
  return c as unknown as AnyClient;
}
