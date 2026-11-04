"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { soDigitosCpf, formatarCpf } from "@/lib/cpf";
import { baseUrlPortal, criarLinkAcesso } from "@/lib/expedamigo/link-acesso";
import { montarMensagemOnboarding } from "@/lib/expedamigo/onboarding";

async function exigirAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return u?.papel === "admin";
}

type Sb = ReturnType<typeof createServiceRoleClient>;
const LINK_DEV = "https://exemplo.local/a/dev-link";

/**
 * Gera o link mágico de acesso de uma LINHA de passageiro + a mensagem de
 * onboarding pronta (com nome/expedição). Não invalida senha nenhuma.
 */
async function linkEMensagem(sb: Sb, passageiroId: string): Promise<{ link: string; mensagem: string }> {
  const base = await baseUrlPortal();
  const link = await criarLinkAcesso(sb, passageiroId, base);
  const { data: p } = await sb.from("passageiros").select("nome_completo, expedicao_id").eq("id", passageiroId).maybeSingle();
  const pax = p as { nome_completo: string | null; expedicao_id: string | null } | null;
  let mensagem = link;
  if (pax?.expedicao_id) {
    const { data: e } = await sb.from("expedicoes").select("nome, tipo").eq("id", pax.expedicao_id).maybeSingle();
    const exp = e as { nome: string; tipo?: "expedicao" | "pacote" } | null;
    if (exp) mensagem = montarMensagemOnboarding({ nome: pax.nome_completo ?? "", expedicao: exp.nome, link, tipo: exp.tipo ?? "expedicao" });
  }
  return { link, mensagem };
}

/** Acha uma linha de passageiro representativa do CPF (prefere liberada e não cancelada). */
async function acharPassageiroPorCpf(sb: Sb, cpf: string): Promise<string | null> {
  const { data } = await sb
    .from("passageiros")
    .select("id, liberado_expedamigo, status_reserva")
    .in("cpf", [cpf, formatarCpf(cpf)]);
  const rows = (data ?? []) as { id: string; liberado_expedamigo: boolean | null; status_reserva: string }[];
  const ativas = rows.filter((r) => r.status_reserva !== "Cancelado");
  const escolhida = ativas.find((r) => r.liberado_expedamigo) ?? ativas[0] ?? rows[0];
  return escolhida?.id ?? null;
}

/** Zera a senha da pessoa (hash + provisória) — a senha atual deixa de valer na hora. */
async function invalidarSenha(sb: Sb, cpf: string): Promise<void> {
  await sb.from("acesso_senhas").upsert({ cpf, senha_hash: null, senha_provisoria: null }, { onConflict: "cpf" });
}

export type LiberarResult =
  | { ok: true; link: string; mensagem: string; jaTemSenha: boolean }
  | { ok: false; error: string };

/**
 * Libera o ExpedAmigo desta expedição pro passageiro (admin) e gera um LINK MÁGICO
 * de acesso pra o admin repassar. O viajante abre o link e cria a própria senha
 * (não há mais senha provisória aleatória). Se a pessoa já criou a senha, `jaTemSenha`
 * avisa — mas o link continua válido (leva a redefinir).
 */
export async function liberarExpedamigo(passageiroId: string, expedicaoId: string): Promise<LiberarResult> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin pode liberar o ExpedAmigo." };
  if (DEV_USE_MOCK_DATA) return { ok: true, link: LINK_DEV, mensagem: LINK_DEV, jaTemSenha: false };

  const sb = createServiceRoleClient();
  const { data: pax } = await sb.from("passageiros").select("cpf").eq("id", passageiroId).maybeSingle();
  const cpf = soDigitosCpf((pax as { cpf: string | null } | null)?.cpf ?? "");

  const up = await sb.from("passageiros").update({ liberado_expedamigo: true }).eq("id", passageiroId);
  if (up.error) return { ok: false, error: up.error.message };

  let jaTemSenha = false;
  if (cpf.length === 11) {
    const { data: cred } = await sb.from("acesso_senhas").select("senha_hash").eq("cpf", cpf).maybeSingle();
    jaTemSenha = !!(cred as { senha_hash: string | null } | null)?.senha_hash;
  }

  const { link, mensagem } = await linkEMensagem(sb, passageiroId);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  return { ok: true, link, mensagem, jaTemSenha };
}

/** Só gera um novo link de acesso da LINHA (não invalida senha) — pra re-copiar/reenviar. */
export async function gerarLinkAcessoExpedamigo(passageiroId: string): Promise<{ ok: boolean; error?: string; link?: string; mensagem?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  if (DEV_USE_MOCK_DATA) return { ok: true, link: LINK_DEV, mensagem: LINK_DEV };
  const sb = createServiceRoleClient();
  const { link, mensagem } = await linkEMensagem(sb, passageiroId);
  return { ok: true, link, mensagem };
}

/**
 * RESET de acesso (admin): invalida a senha atual da pessoa (por CPF) na hora e
 * gera um novo link mágico. A pessoa só volta a entrar criando outra senha pelo link.
 */
export async function resetarAcessoExpedamigo(passageiroId: string, expedicaoId?: string): Promise<{ ok: boolean; error?: string; link?: string; mensagem?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  if (DEV_USE_MOCK_DATA) return { ok: true, link: LINK_DEV, mensagem: LINK_DEV };
  const sb = createServiceRoleClient();
  const { data: pax } = await sb.from("passageiros").select("cpf").eq("id", passageiroId).maybeSingle();
  const cpf = soDigitosCpf((pax as { cpf: string | null } | null)?.cpf ?? "");
  if (cpf.length === 11) await invalidarSenha(sb, cpf);
  const { link, mensagem } = await linkEMensagem(sb, passageiroId);
  if (expedicaoId) {
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros/${passageiroId}`);
    revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  }
  return { ok: true, link, mensagem };
}

/** Gera link de acesso a partir do CPF (perfil global) — não invalida senha. */
export async function gerarLinkAcessoCpf(cpfRaw: string): Promise<{ ok: boolean; error?: string; link?: string; mensagem?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "Passageiro sem CPF válido." };
  if (DEV_USE_MOCK_DATA) return { ok: true, link: LINK_DEV, mensagem: LINK_DEV };
  const sb = createServiceRoleClient();
  const pid = await acharPassageiroPorCpf(sb, cpf);
  if (!pid) return { ok: false, error: "Nenhuma linha de passageiro para este CPF." };
  const { link, mensagem } = await linkEMensagem(sb, pid);
  revalidatePath("/passageiros");
  return { ok: true, link, mensagem };
}

/** RESET de acesso a partir do CPF (perfil global): invalida a senha atual + novo link. */
export async function resetarAcessoCpf(cpfRaw: string): Promise<{ ok: boolean; error?: string; link?: string; mensagem?: string }> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin." };
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11) return { ok: false, error: "Passageiro sem CPF válido." };
  if (DEV_USE_MOCK_DATA) return { ok: true, link: LINK_DEV, mensagem: LINK_DEV };
  const sb = createServiceRoleClient();
  const pid = await acharPassageiroPorCpf(sb, cpf);
  if (!pid) return { ok: false, error: "Nenhuma linha de passageiro para este CPF." };
  await invalidarSenha(sb, cpf);
  const { link, mensagem } = await linkEMensagem(sb, pid);
  revalidatePath("/passageiros");
  return { ok: true, link, mensagem };
}

export type LiberarTodosResult =
  | { ok: true; total: number; jaTinhamSenha: number; links: { nome: string; cpf: string; link: string }[] }
  | { ok: false; error: string };

/**
 * Libera o ExpedAmigo desta expedição pra TODOS os passageiros ativos (admin).
 * Marca todas as linhas como liberadas e gera um LINK MÁGICO por pessoa que ainda
 * não criou a própria senha (devolvido na lista `links` pra o admin repassar).
 * Quem já criou a própria senha (hash) entra em `jaTinhamSenha` e não recebe link.
 */
export async function liberarExpedamigoTodos(expedicaoId: string): Promise<LiberarTodosResult> {
  if (!(await exigirAdmin())) return { ok: false, error: "Apenas admin pode liberar o ExpedAmigo." };
  if (DEV_USE_MOCK_DATA) return { ok: true, total: 0, jaTinhamSenha: 0, links: [] };

  const sb = createServiceRoleClient();
  const { data: pax } = await sb
    .from("passageiros")
    .select("id, nome_completo, cpf, status_reserva")
    .eq("expedicao_id", expedicaoId);
  const ativos = ((pax ?? []) as { id: string; nome_completo: string; cpf: string | null; status_reserva: string }[])
    .filter((p) => p.status_reserva !== "Cancelado");
  if (ativos.length === 0) return { ok: true, total: 0, jaTinhamSenha: 0, links: [] };

  // 1) Marca todos como liberados.
  const up = await sb.from("passageiros")
    .update({ liberado_expedamigo: true })
    .eq("expedicao_id", expedicaoId)
    .neq("status_reserva", "Cancelado");
  if (up.error) return { ok: false, error: up.error.message };

  // 2) Gera link por pessoa que ainda não criou senha (hash). Quem já tem, pula.
  const cpfs = [...new Set(ativos.map((p) => soDigitosCpf(p.cpf ?? "")).filter((c) => c.length === 11))];
  const { data: creds } = cpfs.length
    ? await sb.from("acesso_senhas").select("cpf, senha_hash").in("cpf", cpfs)
    : { data: [] as { cpf: string; senha_hash: string | null }[] };
  const hashByCpf = new Map(((creds ?? []) as { cpf: string; senha_hash: string | null }[])
    .map((c) => [soDigitosCpf(c.cpf), c.senha_hash]));

  const base = await baseUrlPortal();
  const links: { nome: string; cpf: string; link: string }[] = [];
  let jaTinhamSenha = 0;
  const vistos = new Set<string>();
  for (const p of ativos) {
    const cpf = soDigitosCpf(p.cpf ?? "");
    if (cpf.length !== 11 || vistos.has(cpf)) continue;
    vistos.add(cpf);
    if (hashByCpf.get(cpf)) { jaTinhamSenha++; continue; }
    const link = await criarLinkAcesso(sb, p.id, base);
    links.push({ nome: p.nome_completo, cpf, link });
  }

  revalidatePath(`/expedicoes/${expedicaoId}/passageiros`);
  revalidatePath(`/expedicoes/${expedicaoId}/portal`);
  return { ok: true, total: ativos.length, jaTinhamSenha, links };
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

/** Estado do ExpedAmigo desta linha (admin): liberação da expedição + se já tem senha própria. */
export async function estadoExpedamigoPax(passageiroId: string): Promise<{ admin: boolean; cpf: string | null; liberado: boolean; temHash: boolean }> {
  const vazio = { admin: false, cpf: null, liberado: false, temHash: false };
  if (!(await exigirAdmin())) return vazio;
  if (DEV_USE_MOCK_DATA) return { admin: true, cpf: null, liberado: false, temHash: false };
  const sb = createServiceRoleClient();
  const { data: pax } = await sb.from("passageiros").select("cpf,liberado_expedamigo").eq("id", passageiroId).maybeSingle();
  const cpfRaw = (pax as { cpf: string | null } | null)?.cpf ?? null;
  const liberado = !!(pax as { liberado_expedamigo: boolean } | null)?.liberado_expedamigo;
  const cpf = soDigitosCpf(cpfRaw ?? "");
  let temHash = false;
  if (cpf.length === 11) {
    const { data: cred } = await sb.from("acesso_senhas").select("senha_hash").eq("cpf", cpf).maybeSingle();
    temHash = !!(cred as { senha_hash: string | null } | null)?.senha_hash;
  }
  return { admin: true, cpf: cpfRaw, liberado, temHash };
}

/** Só o estado da senha da pessoa (por CPF) — usado no perfil global (admin). */
export async function estadoSenhaCpf(cpfRaw: string): Promise<{ admin: boolean; temHash: boolean }> {
  if (!(await exigirAdmin())) return { admin: false, temHash: false };
  const cpf = soDigitosCpf(cpfRaw ?? "");
  if (cpf.length !== 11 || DEV_USE_MOCK_DATA) return { admin: true, temHash: false };
  const sb = createServiceRoleClient();
  const { data: cred } = await sb.from("acesso_senhas").select("senha_hash").eq("cpf", cpf).maybeSingle();
  return { admin: true, temHash: !!(cred as { senha_hash: string | null } | null)?.senha_hash };
}
