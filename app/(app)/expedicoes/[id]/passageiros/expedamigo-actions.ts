"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { soDigitosCpf } from "@/lib/cpf";
import { gerarSenhaAleatoria } from "@/lib/acesso-senha";

async function exigirAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return u?.papel === "admin";
}

export type LiberarResult =
  | { ok: true; senhaProvisoria: string | null; jaTemSenha: boolean }
  | { ok: false; error: string };

/**
 * Libera o ExpedAmigo desta expedição pro passageiro (admin). Marca a linha como
 * liberada e GARANTE a senha da PESSOA (por CPF): se ainda não tem, gera uma
 * provisória aleatória e devolve pra o admin repassar. Se já tem, não gera outra.
 */
export async function liberarExpedamigo(passageiroId: string, expedicaoId: string): Promise<LiberarResult> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin pode liberar o ExpedAmigo." };
  if (DEV_USE_MOCK_DATA) return { ok: true, senhaProvisoria: gerarSenhaAleatoria(), jaTemSenha: false };

  const sb = createServiceRoleClient();
  const { data: pax } = await sb.from("passageiros").select("cpf").eq("id", passageiroId).maybeSingle();
  const cpf = soDigitosCpf((pax as { cpf: string | null } | null)?.cpf ?? "");

  const up = await sb.from("passageiros").update({ liberado_expedamigo: true }).eq("id", passageiroId);
  if (up.error) return { ok: false, error: up.error.message };

  let senhaProvisoria: string | null = null;
  let jaTemSenha = false;
  if (cpf.length === 11) {
    const { data: cred } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", cpf).maybeSingle();
    const hash = (cred as { senha_hash: string | null } | null)?.senha_hash ?? null;
    const prov = (cred as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null;
    if (hash) jaTemSenha = true;
    else if (prov) senhaProvisoria = prov;
    else {
      senhaProvisoria = gerarSenhaAleatoria();
      await sb.from("acesso_senhas").upsert({ cpf, senha_provisoria: senhaProvisoria, senha_hash: null }, { onConflict: "cpf" });
    }
  }

  revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  return { ok: true, senhaProvisoria, jaTemSenha };
}

/** Bloqueia o ExpedAmigo desta expedição pro passageiro (admin). */
export async function bloquearExpedamigo(passageiroId: string, expedicaoId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  if (DEV_USE_MOCK_DATA) return { ok: true };
  const sb = createServiceRoleClient();
  const up = await sb.from("passageiros").update({ liberado_expedamigo: false }).eq("id", passageiroId);
  if (up.error) return { ok: false, error: up.error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  return { ok: true };
}

/** Gera uma NOVA senha provisória (admin) — o viajante volta ao 1º acesso. */
export async function gerarNovaSenhaProvisoria(cpfRaw: string, passageiroId: string, expedicaoId: string): Promise<{ ok: boolean; error?: string; senhaProvisoria?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "Passageiro sem CPF válido." };
  const senha = gerarSenhaAleatoria();
  if (DEV_USE_MOCK_DATA) return { ok: true, senhaProvisoria: senha };
  const sb = createServiceRoleClient();
  const up = await sb.from("acesso_senhas").upsert({ cpf, senha_provisoria: senha, senha_hash: null }, { onConflict: "cpf" });
  if (up.error) return { ok: false, error: up.error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
  return { ok: true, senhaProvisoria: senha };
}
