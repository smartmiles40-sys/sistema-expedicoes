import { DEV_AUTH_BYPASS, MOCK_USER } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import type { PapelUsuario, UsuarioRow } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string;
  nome: string;
  papel: PapelUsuario;
  avatar_url: string | null;
}

/**
 * Devolve o usuario logado + papel. Em dev (sem Supabase), retorna mock user.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (DEV_AUTH_BYPASS) return MOCK_USER;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: row } = await supabase
    .from("usuarios")
    .select("id, email, nome, papel, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (row) {
    const r = row as Pick<UsuarioRow, "id" | "email" | "nome" | "papel" | "avatar_url">;
    return r;
  }

  // Primeiro login: cria registro com papel "leitura" (admin promove depois)
  const novo: CurrentUser = {
    id: user.id,
    email: user.email ?? "",
    nome: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Usuário",
    papel: "leitura",
    avatar_url: null,
  };
  await supabase.from("usuarios").insert(novo);
  return novo;
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Não autenticado");
  return u;
}
