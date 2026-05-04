/**
 * Helper pra detectar se estamos em dev sem Supabase configurado.
 * Quando true, todas as funções de fetch devolvem mock data.
 */
export const DEV_BYPASS =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL;

export const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "smartmiles4.0@gmail.com",
  nome: "Bruno Oliveira",
  papel: "admin" as const,
  avatar_url: null,
};
