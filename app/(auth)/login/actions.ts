"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

/**
 * Login por e-mail + senha (Supabase Auth). As contas são criadas pelo admin no
 * painel do Supabase — não há cadastro aberto aqui. A sessão é gravada nos
 * cookies pelo client de servidor; o `(app)/layout` exige sessão (getCurrentUser).
 */
export async function entrarComSenha(
  email: string,
  senha: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse({ email, senha });
  if (!parsed.success) return { ok: false, error: "Informe um e-mail e uma senha válidos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });
  if (error) return { ok: false, error: "E-mail ou senha inválidos." };
  return { ok: true };
}
