"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { gerarRequisitosPadrao } from "@/app/(app)/expedicoes/actions";
import { cpfValido, soDigitosCpf } from "@/lib/cpf";
import { MAX_UPLOAD_BYTES, MIME_ARQUIVO_PERMITIDOS } from "@/lib/constants";
import {
  mockExpedicoes,
  mockPassageiros,
  PASSAGEIRO_INSCRICAO_DEFAULTS,
} from "@/lib/mock-data";
import { addArquivoMock } from "@/lib/data/arquivos-mock";
import type { ExpedicaoRow, SaudePassageiro, Tables } from "@/types/database";

const BUCKET = "arquivos-expedicoes";

function safeName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export type ExpedicaoOpcao = { id: string; nome: string; destino: string; data_embarque: string };

/** Expedições futuras (não canceladas) — opções do dropdown do formulário. */
export async function listExpedicoesInscricao(): Promise<ExpedicaoOpcao[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  let exps: ExpedicaoRow[];
  if (DEV_USE_MOCK_DATA) {
    exps = mockExpedicoes;
  } else {
    const sb = createServiceRoleClient();
    const { data } = await sb.from("expedicoes").select("id,nome,destino,data_embarque,status");
    exps = (data ?? []) as ExpedicaoRow[];
  }
  return exps
    .filter((e) => e.status !== "Cancelada" && (e.data_embarque ?? "").slice(0, 10) >= hoje)
    .sort((a, b) => (a.data_embarque ?? "").localeCompare(b.data_embarque ?? ""))
    .map((e) => ({ id: e.id, nome: e.nome, destino: e.destino, data_embarque: e.data_embarque }));
}

const inscricaoSchema = z.object({
  expedicao_id: z.string().min(1, "Selecione a expedição desejada."),
  nome_completo: z.string().trim().min(3, "Informe seu nome completo."),
  cpf: z.string().trim().min(11, "CPF inválido."),
  data_nascimento: z.string().min(8, "Informe sua data de nascimento."),
  email: z.string().trim().email("E-mail inválido."),
  telefone: z.string().trim().min(8, "Informe um telefone/WhatsApp."),
  passaporte: z.string().trim().min(3, "Informe o número do passaporte."),
  validade_passaporte: z.string().min(8, "Informe a validade do passaporte."),
  endereco_cep: z.string().trim().min(1, "Informe o CEP."),
  endereco_rua: z.string().trim().min(1, "Informe a rua."),
  endereco_numero: z.string().trim().min(1, "Informe o número."),
  endereco_complemento: z.string().trim().optional().default(""),
  endereco_bairro: z.string().trim().optional().default(""),
  endereco_cidade: z.string().trim().min(1, "Informe a cidade."),
  endereco_estado: z.string().trim().min(1, "Informe o estado."),
  contato_emergencia_nome: z.string().trim().min(2, "Informe o contato de emergência."),
  contato_emergencia_fone: z.string().trim().min(8, "Informe o telefone do contato de emergência."),
  contato_emergencia_vinculo: z.string().trim().optional().default(""),
  pref_marcar_assento: z.boolean().nullable().default(null),
  pref_upgrade_classe: z.string().nullable().default(null),
  ja_viajou_internacional: z.boolean().nullable().default(null),
  paises_visitados: z.string().trim().optional().default(""),
  acompanhante_nome: z.string().trim().optional().default(""),
  acompanhante_divide_quarto: z.string().nullable().default(null),
  saude: z.record(z.string(), z.string()).optional().default({}),
});

export type InscricaoResult = { ok: true } | { ok: false; error: string };

export async function enviarInscricao(formData: FormData): Promise<InscricaoResult> {
  // 1) Campos (JSON) + arquivo do passaporte.
  let dados: unknown;
  try {
    dados = JSON.parse(String(formData.get("dados") ?? "{}"));
  } catch {
    return { ok: false, error: "Dados do formulário inválidos." };
  }
  const parsed = inscricaoSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos do formulário." };
  }
  const d = parsed.data;

  const cpf = soDigitosCpf(d.cpf);
  if (!cpfValido(cpf)) return { ok: false, error: "CPF inválido." };

  const file = formData.get("passaporte");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Anexe a foto ou PDF do seu passaporte." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `O passaporte excede ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.` };
  }
  if (!MIME_ARQUIVO_PERMITIDOS.includes(file.type as (typeof MIME_ARQUIVO_PERMITIDOS)[number])) {
    return { ok: false, error: "Envie o passaporte como imagem (JPG/PNG) ou PDF." };
  }

  const saude = d.saude as SaudePassageiro;
  const comuns = {
    expedicao_id: d.expedicao_id,
    nome_completo: d.nome_completo,
    cpf,
    data_nascimento: d.data_nascimento,
    email: d.email || null,
    telefone: d.telefone || null,
    passaporte: d.passaporte || null,
    validade_passaporte: d.validade_passaporte || null,
    contato_emergencia_nome: d.contato_emergencia_nome || null,
    contato_emergencia_fone: d.contato_emergencia_fone || null,
    contato_emergencia_vinculo: d.contato_emergencia_vinculo || null,
    endereco_cep: d.endereco_cep || null,
    endereco_rua: d.endereco_rua || null,
    endereco_numero: d.endereco_numero || null,
    endereco_complemento: d.endereco_complemento || null,
    endereco_bairro: d.endereco_bairro || null,
    endereco_cidade: d.endereco_cidade || null,
    endereco_estado: d.endereco_estado || null,
    pref_marcar_assento: d.pref_marcar_assento,
    pref_upgrade_classe: d.pref_upgrade_classe,
    ja_viajou_internacional: d.ja_viajou_internacional,
    paises_visitados: d.paises_visitados || null,
    acompanhante_nome: d.acompanhante_nome || null,
    acompanhante_divide_quarto: d.acompanhante_divide_quarto,
    saude,
    tipo: "Pagante" as const,
    status_reserva: "Lead" as const,
    pendente_aprovacao: true,
    inscricao_origem: "Formulário público",
  };

  // ─── MOCK ───────────────────────────────────────────────────────────────
  if (DEV_USE_MOCK_DATA) {
    if (mockPassageiros.some((p) => p.expedicao_id === d.expedicao_id && soDigitosCpf(p.cpf ?? "") === cpf)) {
      return { ok: false, error: "Já existe uma inscrição com este CPF nesta expedição." };
    }
    const id = `p${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;
    const now = new Date().toISOString();
    const buffer = Buffer.from(await file.arrayBuffer());
    const arq = await addArquivoMock(
      { expedicao_id: d.expedicao_id, passageiro_id: id, categoria: "Documentos pessoais", nome: file.name, descricao: "Passaporte — prontidão", mime: file.type || null, tamanho_bytes: file.size },
      buffer,
    );
    const novo: Tables<"passageiros"> = {
      ...PASSAGEIRO_INSCRICAO_DEFAULTS,
      ...comuns,
      id,
      grupo_id: null,
      conexao_viagem_id: null,
      bitrix_contact_id: null,
      bitrix_deal_id: null,
      passaporte_arquivo_id: arq.id,
      voo_nacional_necessario: false,
      companhia_aerea: null,
      localizador: null,
      quarto_id: null,
      valor_contratado_brl: 0,
      valor_pago_brl: 0,
      saldo_brl: 0,
      status_financeiro: "Em aberto",
      restricoes_alimentares: null,
      condicoes_medicas: null,
      contrato_assinado: false,
      checkin_online_feito: false,
      observacoes: null,
      created_at: now,
      updated_at: now,
    };
    mockPassageiros.push(novo);
    await gerarRequisitosPadrao(d.expedicao_id);
    return { ok: true };
  }

  // ─── PROD (Supabase, service role) ──────────────────────────────────────
  const sb = createServiceRoleClient();

  const { data: existentes } = await sb
    .from("passageiros")
    .select("id,cpf")
    .eq("expedicao_id", d.expedicao_id);
  if ((existentes ?? []).some((r) => soDigitosCpf((r as { cpf: string | null }).cpf ?? "") === cpf)) {
    return { ok: false, error: "Já existe uma inscrição com este CPF nesta expedição." };
  }

  const ins = await sb.from("passageiros").insert(comuns).select("id").single();
  if (ins.error) return { ok: false, error: ins.error.message };
  const passageiroId = (ins.data as { id: string }).id;

  // Sobe o passaporte e vincula (passaporte_arquivo_id — 1 por pessoa).
  const storage_path = `${d.expedicao_id}/passageiros/${passageiroId}/${safeName("Documentos pessoais")}/${randomUUID()}-${safeName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from(BUCKET).upload(storage_path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (!up.error) {
    const arqIns = await sb
      .from("arquivos")
      .insert({
        expedicao_id: d.expedicao_id,
        passageiro_id: passageiroId,
        categoria: "Documentos pessoais",
        nome: file.name,
        descricao: "Passaporte — prontidão",
        mime: file.type || null,
        tamanho_bytes: file.size,
        storage_path,
      })
      .select("id")
      .single();
    if (!arqIns.error) {
      await sb.from("passageiros").update({ passaporte_arquivo_id: (arqIns.data as { id: string }).id }).eq("id", passageiroId);
    }
  }

  await gerarRequisitosPadrao(d.expedicao_id);
  return { ok: true };
}
