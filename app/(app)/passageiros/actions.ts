"use server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { soDigitosCpf } from "@/lib/cpf";

/**
 * Reseta a senha do PORTAL (ExpedAmigo / Área do Líder) de uma pessoa: apaga a
 * linha de `acesso_senhas` do CPF. Sem senha salva, a pessoa volta ao 1º acesso
 * — entra com a data de nascimento e cria uma nova senha. Ação de admin.
 *
 * `tinhaSenha` diz se havia senha definida (pra dar um retorno útil ao operador:
 * se não havia, a pessoa já estava no fluxo de 1º acesso).
 */
export async function resetarSenhaPortal(
  cpfRaw: string,
): Promise<{ ok: boolean; tinhaSenha?: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (eu?.papel !== "admin") {
    return { ok: false, error: "Apenas administradores podem resetar o acesso ao portal." };
  }

  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) {
    return { ok: false, error: "Esta pessoa não tem CPF válido — o acesso ao portal é por CPF." };
  }

  if (DEV_USE_MOCK_DATA) return { ok: true, tinhaSenha: false };

  const sb = createServiceRoleClient();
  const { data: cred } = await sb.from("acesso_senhas").select("cpf").eq("cpf", cpf).maybeSingle();
  const tinhaSenha = !!cred;

  const { error } = await sb.from("acesso_senhas").delete().eq("cpf", cpf);
  if (error) return { ok: false, error: "Não foi possível resetar o acesso ao portal." };

  return { ok: true, tinhaSenha };
}
