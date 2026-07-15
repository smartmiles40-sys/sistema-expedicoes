"use server";
import { revalidatePath } from "next/cache";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mockPassageiros, mockExpedicoes } from "@/lib/mock-data";
import { enviarPassageiroParaBitrix, type PassageiroOutbound } from "@/lib/bitrix/outbound";
import type { PassageiroRow, ExpedicaoRow, SaudePassageiro } from "@/types/database";

/** Monta a "cartinha" (payload) que o sistema manda ao n8n ao aprovar. */
function montarOutbound(p: PassageiroRow, expedicaoCodigo: string | null): PassageiroOutbound {
  return {
    evento: "inscricao_aprovada",
    bitrix_deal_id: p.bitrix_deal_id,
    bitrix_contact_id: p.bitrix_contact_id,
    expedicao_codigo: expedicaoCodigo,
    nome_completo: p.nome_completo,
    cpf: p.cpf,
    email: p.email,
    telefone: p.telefone,
    data_nascimento: p.data_nascimento,
    passaporte: p.passaporte,
    validade_passaporte: p.validade_passaporte,
    status_reserva: p.status_reserva,
    observacoes: p.observacoes,
    endereco: {
      cep: p.endereco_cep,
      rua: p.endereco_rua,
      numero: p.endereco_numero,
      complemento: p.endereco_complemento,
      bairro: p.endereco_bairro,
      cidade: p.endereco_cidade,
      estado: p.endereco_estado,
    },
    contato_emergencia_nome: p.contato_emergencia_nome,
    contato_emergencia_vinculo: p.contato_emergencia_vinculo,
    contato_emergencia_fone: p.contato_emergencia_fone,
    pref_marcar_assento: p.pref_marcar_assento,
    pref_upgrade_classe: p.pref_upgrade_classe,
    ja_viajou_internacional: p.ja_viajou_internacional,
    paises_visitados: p.paises_visitados,
    saude: (p.saude as Record<string, string> | null) ?? null,
    // O link do arquivo é gerado à parte (async) no aprovarInscricao.
    passaporte_arquivo_url: null,
    passaporte_arquivo_nome: null,
  };
}

/** Bucket do Supabase Storage onde ficam os anexos das expedições. */
const BUCKET_ARQUIVOS = "arquivos-expedicoes";

export type InscricaoPendente = {
  id: string;
  expedicao_id: string | null;
  expedicao_nome: string;
  destino: string;
  data_embarque: string | null;
  created_at: string;
  origem: string | null;
  status_reserva: string;
  // Pessoais
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  // Endereço
  endereco: { cep: string | null; rua: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null };
  // Passaporte
  passaporte: string | null;
  validade_passaporte: string | null;
  tem_passaporte: boolean;
  passaporte_arquivo_id: string | null;
  // Emergência
  contato_emergencia_nome: string | null;
  contato_emergencia_fone: string | null;
  contato_emergencia_vinculo: string | null;
  // Preferências / histórico / acompanhante
  pref_marcar_assento: boolean | null;
  pref_upgrade_classe: string | null;
  ja_viajou_internacional: boolean | null;
  paises_visitados: string | null;
  acompanhante_nome: string | null;
  acompanhante_divide_quarto: string | null;
  saude: SaudePassageiro | null;
  restricoes_alimentares: string | null;
  condicoes_medicas: string | null;
};

function montar(p: PassageiroRow, e: ExpedicaoRow | undefined): InscricaoPendente {
  return {
    id: p.id,
    expedicao_id: p.expedicao_id,
    expedicao_nome: e?.nome ?? "—",
    destino: e?.destino ?? "—",
    data_embarque: e?.data_embarque ?? null,
    created_at: p.created_at,
    origem: p.inscricao_origem,
    status_reserva: p.status_reserva,
    nome_completo: p.nome_completo,
    cpf: p.cpf,
    data_nascimento: p.data_nascimento,
    email: p.email,
    telefone: p.telefone,
    endereco: {
      cep: p.endereco_cep, rua: p.endereco_rua, numero: p.endereco_numero, complemento: p.endereco_complemento,
      bairro: p.endereco_bairro, cidade: p.endereco_cidade, estado: p.endereco_estado,
    },
    passaporte: p.passaporte,
    validade_passaporte: p.validade_passaporte,
    tem_passaporte: Boolean(p.passaporte_arquivo_id),
    passaporte_arquivo_id: p.passaporte_arquivo_id,
    contato_emergencia_nome: p.contato_emergencia_nome,
    contato_emergencia_fone: p.contato_emergencia_fone,
    contato_emergencia_vinculo: p.contato_emergencia_vinculo,
    pref_marcar_assento: p.pref_marcar_assento,
    pref_upgrade_classe: p.pref_upgrade_classe,
    ja_viajou_internacional: p.ja_viajou_internacional,
    paises_visitados: p.paises_visitados,
    acompanhante_nome: p.acompanhante_nome,
    acompanhante_divide_quarto: p.acompanhante_divide_quarto,
    saude: p.saude ?? null,
    restricoes_alimentares: p.restricoes_alimentares,
    condicoes_medicas: p.condicoes_medicas,
  };
}

export async function listInscricoesPendentes(): Promise<InscricaoPendente[]> {
  let pax: PassageiroRow[];
  let exps: ExpedicaoRow[];
  if (DEV_USE_MOCK_DATA) {
    pax = mockPassageiros.filter((p) => p.pendente_aprovacao);
    exps = mockExpedicoes;
  } else {
    const sb = await getServerClient();
    const [{ data: p }, { data: e }] = await Promise.all([
      sb.from("passageiros").select("*").eq("pendente_aprovacao", true),
      sb.from("expedicoes").select("*"),
    ]);
    pax = (p ?? []) as PassageiroRow[];
    exps = (e ?? []) as ExpedicaoRow[];
  }
  const expById = new Map(exps.map((e) => [e.id, e]));
  return pax
    .map((p) => montar(p, p.expedicao_id ? expById.get(p.expedicao_id) : undefined))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function contarInscricoesPendentes(): Promise<number> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros.filter((p) => p.pendente_aprovacao).length;
  const sb = await getServerClient();
  const { count } = await sb.from("passageiros").select("id", { count: "exact", head: true }).eq("pendente_aprovacao", true);
  return count ?? 0;
}

export async function aprovarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  // Guarda os dados já atualizados pra montar a cartinha do Bitrix depois de aprovar.
  let outbound: PassageiroOutbound | null = null;

  if (DEV_USE_MOCK_DATA) {
    const p = mockPassageiros.find((x) => x.id === id);
    if (!p) return { ok: false, error: "Inscrição não encontrada." };
    p.pendente_aprovacao = false;
    if (p.status_reserva === "Lead") p.status_reserva = "Pré-reserva"; // não rebaixa quem já é Confirmado
    p.updated_at = new Date().toISOString();
    const codigo = mockExpedicoes.find((e) => e.id === p.expedicao_id)?.codigo ?? null;
    outbound = montarOutbound(p, codigo);
  } else {
    const sb = await getServerClient();
    // Só promove Lead → Pré-reserva; para outros status, apenas tira a flag.
    const { data } = await sb.from("passageiros").select("status_reserva").eq("id", id).maybeSingle();
    const status = (data as { status_reserva: string } | null)?.status_reserva;
    const patch: Record<string, unknown> = { pendente_aprovacao: false };
    if (status === "Lead") patch.status_reserva = "Pré-reserva";
    const { error } = await sb.from("passageiros").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };

    // Relê a linha já atualizada + o código da expedição pra montar a cartinha.
    const { data: pos } = await sb.from("passageiros").select("*").eq("id", id).maybeSingle();
    const p = pos as PassageiroRow | null;
    if (p) {
      let codigo: string | null = null;
      if (p.expedicao_id) {
        const { data: exp } = await sb.from("expedicoes").select("codigo").eq("id", p.expedicao_id).maybeSingle();
        codigo = (exp as { codigo: string } | null)?.codigo ?? null;
      }
      outbound = montarOutbound(p, codigo);

      // Arquivo do passaporte: gera um link temporário pro n8n baixar e anexar no Bitrix.
      // Usa a SERVICE ROLE (igual /amigo e /lider): gerar signed URL no Storage exige
      // essa chave — com o client normal (sessão do operador) o createSignedUrl falha
      // silenciosamente e o arquivo não ia pro Bitrix.
      if (p.passaporte_arquivo_id) {
        const admin = createServiceRoleClient();
        const { data: arq } = await admin
          .from("arquivos")
          .select("storage_path, nome")
          .eq("id", p.passaporte_arquivo_id)
          .maybeSingle();
        const a = arq as { storage_path: string; nome: string } | null;
        if (a?.storage_path) {
          const { data: signed } = await admin.storage
            .from(BUCKET_ARQUIVOS)
            .createSignedUrl(a.storage_path, 3600); // 1h — o n8n baixa na hora
          if (signed?.signedUrl) {
            outbound.passaporte_arquivo_url = signed.signedUrl;
            outbound.passaporte_arquivo_nome = a.nome;
          }
        }
      }
    }
  }

  revalidatePath("/inscricoes");
  revalidatePath("/passageiros");

  // Melhor esforço: avisa o Bitrix (via n8n). Falha aqui NÃO desfaz a aprovação.
  if (outbound) await enviarPassageiroParaBitrix(outbound);

  return { ok: true };
}

export async function recusarInscricao(id: string): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    const i = mockPassageiros.findIndex((x) => x.id === id);
    if (i >= 0) mockPassageiros.splice(i, 1);
  } else {
    const sb = await getServerClient();
    const { error } = await sb.from("passageiros").delete().eq("id", id).eq("pendente_aprovacao", true);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/inscricoes");
  return { ok: true };
}
