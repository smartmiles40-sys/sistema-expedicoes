"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeDecidirInscricao } from "@/lib/auth/permissoes";
import { mockPassageiros, mockExpedicoes } from "@/lib/mock-data";

/** Antecedência-alvo pra emitir/enviar a receita (dias antes do embarque). */
const DIAS_ANTECEDENCIA_RECEITA = 20;

export type ReceitaPendente = {
  passageiro_id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  expedicao_id: string;
  expedicao_nome: string;
  destino: string;
  data_embarque: string | null;
  /** dias de hoje até o embarque (negativo = já passou). */
  dias_ate_embarque: number | null;
  /** data-limite pra emitir = embarque − 20 dias (ISO yyyy-mm-dd). */
  data_limite: string | null;
};

function diasEntre(hoje: Date, alvoISO: string): number {
  const alvo = new Date(alvoISO + "T00:00:00");
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
}
function menosDias(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Passageiros marcados com "receita a emitir" e ainda não enviada, em expedições futuras não canceladas. */
export async function listReceitasPendentes(): Promise<ReceitaPendente[]> {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let pax: { id: string; nome_completo: string; cpf: string | null; telefone: string | null; expedicao_id: string | null; receita_pendente?: boolean; receita_enviada_em?: string | null }[];
  let exps: { id: string; nome: string; destino: string; data_embarque: string | null; status: string }[];
  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros as unknown as typeof pax;
    exps = mockExpedicoes as unknown as typeof exps;
  } else {
    const sb = createServiceRoleClient();
    const [{ data: p, error: pe }, { data: e }] = await Promise.all([
      sb.from("passageiros").select("id,nome_completo,cpf,telefone,expedicao_id,receita_pendente,receita_enviada_em").eq("receita_pendente", true).is("receita_enviada_em", null),
      sb.from("expedicoes").select("id,nome,destino,data_embarque,status"),
    ]);
    if (pe) return []; // degrada se a coluna ainda não existir
    pax = (p ?? []) as typeof pax;
    exps = (e ?? []) as typeof exps;
  }
  const expById = new Map(exps.map((e) => [e.id, e]));
  const out: ReceitaPendente[] = [];
  for (const p of pax) {
    if (!p.receita_pendente || p.receita_enviada_em || !p.expedicao_id) continue;
    const e = expById.get(p.expedicao_id);
    if (!e || e.status === "Cancelado") continue;
    const dias = e.data_embarque ? diasEntre(hoje, e.data_embarque) : null;
    // Só aparece quando entra na janela: faltam de 0 a 20 dias pro embarque.
    if (dias == null || dias < 0 || dias > DIAS_ANTECEDENCIA_RECEITA) continue;
    out.push({
      passageiro_id: p.id, nome: p.nome_completo, cpf: p.cpf, telefone: p.telefone,
      expedicao_id: p.expedicao_id, expedicao_nome: e.nome, destino: e.destino,
      data_embarque: e.data_embarque, dias_ate_embarque: dias,
      data_limite: e.data_embarque ? menosDias(e.data_embarque, DIAS_ANTECEDENCIA_RECEITA) : null,
    });
  }
  return out.sort((a, b) => (a.data_embarque ?? "9999").localeCompare(b.data_embarque ?? "9999"));
}

/** Contador pro badge da sidebar: receitas na janela (≤20 dias do embarque). */
export async function contarReceitasNaHora(): Promise<number> {
  return (await listReceitasPendentes()).length;
}

/** Marca a receita como enviada (sai da lista; mantém histórico em receita_enviada_em). */
export async function marcarReceitaEnviada(passageiroId: string): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeDecidirInscricao(eu?.papel)) return { ok: false, error: "Sem permissão." };
  if (DEV_USE_MOCK_DATA) {
    const p = mockPassageiros.find((p) => p.id === passageiroId);
    if (p) p.receita_enviada_em = new Date().toISOString();
    revalidatePath("/receitas");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb.from("passageiros").update({ receita_enviada_em: new Date().toISOString() }).eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/receitas");
  return { ok: true };
}

/** Desfaz: volta a receita pra pendente (limpa a data de envio). */
export async function desfazerReceitaEnviada(passageiroId: string): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeDecidirInscricao(eu?.papel)) return { ok: false, error: "Sem permissão." };
  if (DEV_USE_MOCK_DATA) {
    const p = mockPassageiros.find((p) => p.id === passageiroId);
    if (p) p.receita_enviada_em = null;
    revalidatePath("/receitas");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb.from("passageiros").update({ receita_enviada_em: null }).eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/receitas");
  return { ok: true };
}
