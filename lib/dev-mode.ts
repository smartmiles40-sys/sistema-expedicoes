/**
 * Flags de dev — separadas em duas dimensões independentes:
 *   - DEV_AUTH_BYPASS: pula login, getCurrentUser() devolve MOCK_USER
 *   - DEV_USE_MOCK_DATA: funcoes de fetch/mutate usam lib/mock-data.ts
 *
 * Combinações suportadas:
 *   bypass=true,  mock=true   → modo offline (sem Supabase). Padrão sem URL.
 *   bypass=true,  mock=false  → Supabase real, sem precisar de magic link em dev.
 *                               getServerClient cai em service_role pra contornar RLS.
 *   bypass=false, mock=false  → produção / staging. Login obrigatório, RLS ativa.
 *   bypass=false, mock=true   → não faz sentido, mas é tolerado (auth real lendo mock).
 *
 * ⚠️ Em produção (NODE_ENV === "production") AMBAS as flags são forçadas a false,
 *    ignorando qualquer env. As combinações acima só valem fora de produção.
 */
const isTrue = (v: string | undefined) => v === "true";
const isFalse = (v: string | undefined) => v === "false";

// Em produção o bypass de auth é TRAVADO: qualquer atalho de dev fica desligado,
// aconteça o que acontecer. Sem isso, uma env que sumisse do build (ex.:
// NEXT_PUBLIC_SUPABASE_URL) ligava o bypass sozinho e abria o sistema inteiro —
// fail-OPEN por env ausente. Aqui é o contrário: prod SEMPRE falha fechado.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const DEV_AUTH_BYPASS =
  !IS_PRODUCTION &&
  (isTrue(process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS) ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL);

export const DEV_USE_MOCK_DATA = (() => {
  // Nunca servir mock em produção — dado fictício numa tela real é bug grave.
  if (IS_PRODUCTION) return false;
  const explicit = process.env.NEXT_PUBLIC_DEV_USE_MOCK_DATA;
  if (isTrue(explicit)) return true;
  if (isFalse(explicit)) return false;
  return DEV_AUTH_BYPASS;
})();

/** @deprecated use DEV_AUTH_BYPASS ou DEV_USE_MOCK_DATA */
export const DEV_BYPASS = DEV_USE_MOCK_DATA;

export const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "smartmiles4.0@gmail.com",
  nome: "Bruno Oliveira",
  papel: "admin" as const,
  avatar_url: null,
  senha_provisoria: false,
};
