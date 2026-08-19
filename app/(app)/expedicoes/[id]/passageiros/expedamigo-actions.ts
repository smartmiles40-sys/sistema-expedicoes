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

export type LiberarTodosResult =
  | { ok: true; total: number; jaTinhamSenha: number; senhas: { nome: string; cpf: string; senha: string }[] }
  | { ok: false; error: string };

/**
 * Libera o ExpedAmigo desta expedição pra TODOS os passageiros ativos (admin).
 * Marca todas as linhas como liberadas e garante a senha por pessoa: quem não tem,
 * recebe uma provisória aleatória (devolvida na lista `senhas` pra o admin repassar);
 * quem já criou a própria senha (hash) entra em `jaTinhamSenha` e não é regerado.
 */
export async function liberarExpedamigoTodos(expedicaoId: string): Promise<LiberarTodosResult> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin pode liberar o ExpedAmigo." };
  if (DEV_USE_MOCK_DATA) return { ok: true, total: 0, jaTinhamSenha: 0, senhas: [] };

  const sb = createServiceRoleClient();
  const { data: pax } = await sb
    .from("passageiros")
    .select("id, nome_completo, cpf, status_reserva")
    .eq("expedicao_id", expedicaoId);
  const ativos = ((pax ?? []) as { id: string; nome_completo: string; cpf: string | null; status_reserva: string }[])
    .filter((p) => p.status_reserva !== "Cancelado");
  if (ativos.length === 0) return { ok: true, total: 0, jaTinhamSenha: 0, senhas: [] };

  // 1) Marca todos como liberados.
  const up = await sb.from("passageiros")
    .update({ liberado_expedamigo: true })
    .eq("expedicao_id", expedicaoId)
    .neq("status_reserva", "Cancelado");
  if (up.error) return { ok: false, error: up.error.message };

  // 2) Garante a senha por pessoa (CPF), sem regerar quem já tem.
  const cpfs = [...new Set(ativos.map((p) => soDigitosCpf(p.cpf ?? "")).filter((c) => c.length === 11))];
  const { data: creds } = cpfs.length
    ? await sb.from("acesso_senhas").select("cpf, senha_hash, senha_provisoria").in("cpf", cpfs)
    : { data: [] as { cpf: string; senha_hash: string | null; senha_provisoria: string | null }[] };
  const credByCpf = new Map(((creds ?? []) as { cpf: string; senha_hash: string | null; senha_provisoria: string | null }[])
    .map((c) => [soDigitosCpf(c.cpf), c]));

  const senhas: { nome: string; cpf: string; senha: string }[] = [];
  const novos: { cpf: string; senha_provisoria: string; senha_hash: null }[] = [];
  let jaTinhamSenha = 0;
  const vistos = new Set<string>();
  for (const p of ativos) {
    const cpf = soDigitosCpf(p.cpf ?? "");
    if (cpf.length !== 11 || vistos.has(cpf)) continue;
    vistos.add(cpf);
    const cred = credByCpf.get(cpf);
    if (cred?.senha_hash) { jaTinhamSenha++; continue; }
    if (cred?.senha_provisoria) { senhas.push({ nome: p.nome_completo, cpf, senha: cred.senha_provisoria }); continue; }
    const senha = gerarSenhaAleatoria();
    novos.push({ cpf, senha_provisoria: senha, senha_hash: null });
    senhas.push({ nome: p.nome_completo, cpf, senha });
  }
  if (novos.length) await sb.from("acesso_senhas").upsert(novos, { onConflict: "cpf" });

  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true, total: ativos.length, jaTinhamSenha, senhas };
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
export async function gerarNovaSenhaCpf(cpfRaw: string): Promise<{ ok: boolean; error?: string; senhaProvisoria?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "Passageiro sem CPF válido." };
  const senha = gerarSenhaAleatoria();
  if (DEV_USE_MOCK_DATA) return { ok: true, senhaProvisoria: senha };
  const sb = createServiceRoleClient();
  const up = await sb.from("acesso_senhas").upsert({ cpf, senha_provisoria: senha, senha_hash: null }, { onConflict: "cpf" });
  if (up.error) return { ok: false, error: up.error.message };
  revalidatePath("/passageiros");
  return { ok: true, senhaProvisoria: senha };
}

/** Estado do ExpedAmigo desta linha (admin): liberação da expedição + senha da pessoa. */
export async function estadoExpedamigoPax(passageiroId: string): Promise<{ admin: boolean; cpf: string | null; liberado: boolean; temHash: boolean; senhaProvisoria: string | null }> {
  const vazio = { admin: false, cpf: null, liberado: false, temHash: false, senhaProvisoria: null };
  if (!(await exigirAdmin())) return vazio;
  if (DEV_USE_MOCK_DATA) return { admin: true, cpf: null, liberado: false, temHash: false, senhaProvisoria: null };
  const sb = createServiceRoleClient();
  const { data: pax } = await sb.from("passageiros").select("cpf,liberado_expedamigo").eq("id", passageiroId).maybeSingle();
  const cpfRaw = (pax as { cpf: string | null } | null)?.cpf ?? null;
  const liberado = !!(pax as { liberado_expedamigo: boolean } | null)?.liberado_expedamigo;
  const cpf = soDigitosCpf(cpfRaw ?? "");
  let temHash = false;
  let senhaProvisoria: string | null = null;
  if (cpf.length === 11) {
    const { data: cred } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", cpf).maybeSingle();
    temHash = !!(cred as { senha_hash: string | null } | null)?.senha_hash;
    senhaProvisoria = (cred as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null;
  }
  return { admin: true, cpf: cpfRaw, liberado, temHash, senhaProvisoria };
}

/** Só a senha da pessoa (por CPF) — usado no perfil global (admin). */
export async function estadoSenhaCpf(cpfRaw: string): Promise<{ admin: boolean; temHash: boolean; senhaProvisoria: string | null }> {
  if (!(await exigirAdmin())) return { admin: false, temHash: false, senhaProvisoria: null };
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11 || DEV_USE_MOCK_DATA) return { admin: true, temHash: false, senhaProvisoria: null };
  const sb = createServiceRoleClient();
  const { data: cred } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", cpf).maybeSingle();
  return {
    admin: true,
    temHash: !!(cred as { senha_hash: string | null } | null)?.senha_hash,
    senhaProvisoria: (cred as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null,
  };
}
