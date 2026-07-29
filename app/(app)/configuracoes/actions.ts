"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { mockUsuarios } from "@/lib/mock-data";
import { PAPEIS_ATRIBUIVEIS, type PapelUsuario } from "@/lib/constants";

/** Gera uma senha provisória curta e fácil de repassar (o usuário troca no 1º login). */
function gerarSenhaProvisoria(): string {
  const n = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
  return `Setur@${n}`;
}

/**
 * Reseta a senha de um usuário (ação de admin). Define uma senha PROVISÓRIA e
 * remarca a conta como `senha_provisoria=true`, forçando a pessoa a criar a
 * própria senha no próximo login (fluxo /primeiro-acesso). Devolve a senha
 * provisória para o admin repassar à pessoa.
 */
export async function resetarSenhaUsuario(
  usuarioId: string,
): Promise<{ ok: boolean; senha?: string; error?: string }> {
  const eu = await getCurrentUser();
  if (eu?.papel !== "admin") {
    return { ok: false, error: "Apenas administradores podem resetar senhas." };
  }

  const senha = gerarSenhaProvisoria();

  // Modo mock/dev: não há Supabase Auth real — só simula e marca a flag no mock.
  if (DEV_USE_MOCK_DATA) {
    const u = mockUsuarios.find((x) => x.id === usuarioId);
    if (u) u.senha_provisoria = true;
    return { ok: true, senha };
  }

  const admin = createServiceRoleClient();

  // 1) Troca a senha no Supabase Auth.
  const { error: authErr } = await admin.auth.admin.updateUserById(usuarioId, { password: senha });
  if (authErr) {
    return { ok: false, error: "Não foi possível redefinir a senha desse usuário." };
  }

  // 2) Remarca como provisória → força a troca no próximo login.
  await admin.from("usuarios").update({ senha_provisoria: true }).eq("id", usuarioId);

  return { ok: true, senha };
}

/**
 * Muda o papel de um usuário (ação de admin). Só oferece os 3 perfis em uso
 * (`PAPEIS_ATRIBUIVEIS`: admin / operacional / relacionamento). Não deixa o admin
 * alterar o PRÓPRIO papel (evita se trancar fora sem querer).
 */
export async function alterarPapelUsuario(
  usuarioId: string,
  papel: PapelUsuario,
): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (eu?.papel !== "admin") return { ok: false, error: "Apenas administradores podem mudar papéis." };
  if (!PAPEIS_ATRIBUIVEIS.includes(papel)) return { ok: false, error: "Papel inválido." };
  if (eu.id === usuarioId) return { ok: false, error: "Você não pode alterar o próprio papel." };

  if (DEV_USE_MOCK_DATA) {
    const u = mockUsuarios.find((x) => x.id === usuarioId);
    if (u) u.papel = papel;
    revalidatePath("/configuracoes");
    return { ok: true };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("usuarios").update({ papel }).eq("id", usuarioId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}
