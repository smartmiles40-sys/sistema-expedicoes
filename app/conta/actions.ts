"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServerClient } from "@/lib/supabase/typed";

const senhaSchema = z
  .string()
  .min(8, "A senha precisa ter ao menos 8 caracteres")
  .max(72, "Senha muito longa");

/**
 * Define a senha do usuário LOGADO (sessão nos cookies) e limpa a flag de senha
 * provisória. Serve tanto para o 1º acesso (troca forçada) quanto para a
 * redefinição via link de recuperação (que também cria uma sessão).
 */
export async function atualizarSenhaConta(
  novaSenha: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = senhaSchema.safeParse(novaSenha);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    // A mais comum: nova senha igual à atual (Supabase bloqueia).
    return { ok: false, error: "Não foi possível salvar a senha. Escolha uma senha diferente da atual." };
  }

  // Concluiu a troca → não é mais provisória. Ignora erro (a flag pode já estar false).
  // Usa o client não-tipado (typed.ts) porque a Database custom não satisfaz o Update tipado.
  const db = await getServerClient();
  await db.from("usuarios").update({ senha_provisoria: false }).eq("id", user.id);

  return { ok: true };
}
