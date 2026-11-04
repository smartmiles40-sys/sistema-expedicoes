"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/auth";
import { podeDecidirInscricao } from "@/lib/auth/permissoes";
import { mockPassageiros, mockExpedicoes } from "@/lib/mock-data";

export type NovaVenda = {
  passageiro_id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  status_reserva: string;
  expedicao_id: string;
  expedicao_nome: string;
  destino: string;
  data_embarque: string | null;
  /** created_at da linha (quando a sync trouxe). */
  entrou_em: string | null;
};

/** Passageiros que vieram NOVOS da sync do Bitrix e ainda não foram triados. */
export async function listNovasVendas(): Promise<NovaVenda[]> {
  let pax: { id: string; nome_completo: string; cpf: string | null; telefone: string | null; email: string | null; status_reserva: string; expedicao_id: string | null; nova_venda?: boolean; created_at?: string }[];
  let exps: { id: string; nome: string; destino: string; data_embarque: string | null; status: string }[];
  if (DEV_USE_MOCK_DATA) {
    pax = (mockPassageiros as unknown as typeof pax).filter((p) => p.nova_venda);
    exps = mockExpedicoes as unknown as typeof exps;
  } else {
    const sb = createServiceRoleClient();
    const [{ data: p, error: pe }, { data: e }] = await Promise.all([
      sb.from("passageiros").select("id,nome_completo,cpf,telefone,email,status_reserva,expedicao_id,nova_venda,created_at").eq("nova_venda", true),
      sb.from("expedicoes").select("id,nome,destino,data_embarque,status"),
    ]);
    if (pe) return []; // degrada se a coluna ainda não existir
    pax = (p ?? []) as typeof pax;
    exps = (e ?? []) as typeof exps;
  }
  const expById = new Map(exps.map((e) => [e.id, e]));
  const out: NovaVenda[] = [];
  for (const p of pax) {
    if (!p.nova_venda || !p.expedicao_id) continue;
    const e = expById.get(p.expedicao_id);
    if (!e || e.status === "Cancelada") continue;
    out.push({
      passageiro_id: p.id, nome: p.nome_completo, cpf: p.cpf, telefone: p.telefone, email: p.email,
      status_reserva: p.status_reserva, expedicao_id: p.expedicao_id, expedicao_nome: e.nome,
      destino: e.destino, data_embarque: e.data_embarque, entrou_em: p.created_at ?? null,
    });
  }
  // Mais recentes primeiro.
  return out.sort((a, b) => (b.entrou_em ?? "").localeCompare(a.entrou_em ?? ""));
}

/** Contador pro badge da sidebar. */
export async function contarNovasVendas(): Promise<number> {
  return (await listNovasVendas()).length;
}

/** Marca uma venda como vista (sai da fila; não some do sistema). */
export async function marcarVendaVista(passageiroId: string): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeDecidirInscricao(eu?.papel)) return { ok: false, error: "Sem permissão." };
  if (DEV_USE_MOCK_DATA) {
    const p = mockPassageiros.find((p) => p.id === passageiroId) as { nova_venda?: boolean } | undefined;
    if (p) p.nova_venda = false;
    revalidatePath("/novas-vendas");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb.from("passageiros").update({ nova_venda: false }).eq("id", passageiroId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/novas-vendas");
  return { ok: true };
}

/** Marca TODAS as vendas novas como vistas (limpa a fila). */
export async function marcarTodasVendasVistas(): Promise<{ ok: boolean; error?: string }> {
  const eu = await getCurrentUser();
  if (!podeDecidirInscricao(eu?.papel)) return { ok: false, error: "Sem permissão." };
  if (DEV_USE_MOCK_DATA) {
    for (const p of mockPassageiros as unknown as { nova_venda?: boolean }[]) if (p.nova_venda) p.nova_venda = false;
    revalidatePath("/novas-vendas");
    return { ok: true };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb.from("passageiros").update({ nova_venda: false }).eq("nova_venda", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/novas-vendas");
  return { ok: true };
}
