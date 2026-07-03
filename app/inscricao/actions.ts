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
type Pax = Tables<"passageiros">;

function safeName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
const temValor = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
const str = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

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

// Campos que checamos pra dizer "já temos" (rótulos, nunca os valores).
const CAMPOS_CHECAR = [
  "nome_completo", "data_nascimento", "email", "telefone",
  "endereco_cep", "endereco_rua", "endereco_numero", "endereco_cidade", "endereco_estado",
  "passaporte", "validade_passaporte",
  "contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo",
] as const;

export type Identificacao =
  | { ok: false; error: string }
  | { ok: true; existe: false }
  | { ok: true; existe: true; conflito: true }
  | { ok: true; existe: true; conflito: false; temos: string[]; temPassaporteAnexo: boolean };

async function acharExistente(expedicaoId: string, cpf: string): Promise<Pax | null> {
  if (DEV_USE_MOCK_DATA) {
    return mockPassageiros.find((p) => p.expedicao_id === expedicaoId && soDigitosCpf(p.cpf ?? "") === cpf) ?? null;
  }
  const sb = createServiceRoleClient();
  const { data } = await sb.from("passageiros").select("*").eq("expedicao_id", expedicaoId);
  return ((data ?? []) as Pax[]).find((p) => soDigitosCpf(p.cpf ?? "") === cpf) ?? null;
}

/** Passo 1: identifica o passageiro na expedição pelo CPF + nascimento. */
export async function identificarInscricao(
  expedicaoId: string,
  cpfRaw: string,
  nascimento: string,
): Promise<Identificacao> {
  const cpf = soDigitosCpf(cpfRaw);
  if (!expedicaoId) return { ok: false, error: "Selecione a expedição desejada." };
  if (!cpfValido(cpf)) return { ok: false, error: "CPF inválido." };
  if (!nascimento || nascimento.length < 8) return { ok: false, error: "Informe sua data de nascimento." };

  const existente = await acharExistente(expedicaoId, cpf);
  if (!existente) return { ok: true, existe: false };

  // Trava de segurança: se já temos a data de nascimento e não bate, não revela nada.
  if (existente.data_nascimento && existente.data_nascimento.slice(0, 10) !== nascimento.slice(0, 10)) {
    return { ok: true, existe: true, conflito: true };
  }

  const temos = CAMPOS_CHECAR.filter((c) => temValor((existente as Record<string, unknown>)[c]));
  return { ok: true, existe: true, conflito: false, temos, temPassaporteAnexo: temValor(existente.passaporte_arquivo_id) };
}

const dadosSchema = z.object({
  expedicao_id: z.string().min(1, "Selecione a expedição desejada."),
  cpf: z.string().trim().min(11, "CPF inválido."),
  data_nascimento: z.string().min(8, "Informe sua data de nascimento."),
  nome_completo: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  telefone: z.string().trim().optional().default(""),
  passaporte: z.string().trim().optional().default(""),
  validade_passaporte: z.string().trim().optional().default(""),
  endereco_cep: z.string().trim().optional().default(""),
  endereco_rua: z.string().trim().optional().default(""),
  endereco_numero: z.string().trim().optional().default(""),
  endereco_complemento: z.string().trim().optional().default(""),
  endereco_bairro: z.string().trim().optional().default(""),
  endereco_cidade: z.string().trim().optional().default(""),
  endereco_estado: z.string().trim().optional().default(""),
  contato_emergencia_nome: z.string().trim().optional().default(""),
  contato_emergencia_fone: z.string().trim().optional().default(""),
  contato_emergencia_vinculo: z.string().trim().optional().default(""),
  pref_marcar_assento: z.boolean().nullable().default(null),
  pref_upgrade_classe: z.string().nullable().default(null),
  ja_viajou_internacional: z.boolean().nullable().default(null),
  paises_visitados: z.string().trim().optional().default(""),
  acompanhante_nome: z.string().trim().optional().default(""),
  acompanhante_divide_quarto: z.string().nullable().default(null),
  saude: z.record(z.string(), z.string()).optional().default({}),
});
type Dados = z.infer<typeof dadosSchema>;

export type InscricaoResult = { ok: true; completou: boolean } | { ok: false; error: string };

function validarArquivo(file: File): string | null {
  if (file.size === 0) return "Arquivo do passaporte vazio.";
  if (file.size > MAX_UPLOAD_BYTES) return `O passaporte excede ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`;
  if (!MIME_ARQUIVO_PERMITIDOS.includes(file.type as (typeof MIME_ARQUIVO_PERMITIDOS)[number])) {
    return "Envie o passaporte como imagem (JPG/PNG) ou PDF.";
  }
  return null;
}

/** Campos da RESERVA/pessoais montados a partir do form (para insert novo). */
function novosCampos(d: Dados, cpf: string) {
  return {
    nome_completo: d.nome_completo,
    cpf,
    data_nascimento: d.data_nascimento,
    email: str(d.email),
    telefone: str(d.telefone),
    passaporte: str(d.passaporte),
    validade_passaporte: str(d.validade_passaporte),
    contato_emergencia_nome: str(d.contato_emergencia_nome),
    contato_emergencia_fone: str(d.contato_emergencia_fone),
    contato_emergencia_vinculo: str(d.contato_emergencia_vinculo),
    endereco_cep: str(d.endereco_cep),
    endereco_rua: str(d.endereco_rua),
    endereco_numero: str(d.endereco_numero),
    endereco_complemento: str(d.endereco_complemento),
    endereco_bairro: str(d.endereco_bairro),
    endereco_cidade: str(d.endereco_cidade),
    endereco_estado: str(d.endereco_estado),
    pref_marcar_assento: d.pref_marcar_assento,
    pref_upgrade_classe: str(d.pref_upgrade_classe ?? ""),
    ja_viajou_internacional: d.ja_viajou_internacional,
    paises_visitados: str(d.paises_visitados),
    acompanhante_nome: str(d.acompanhante_nome),
    acompanhante_divide_quarto: str(d.acompanhante_divide_quarto ?? ""),
    saude: (d.saude ?? {}) as SaudePassageiro,
    tipo: "Pagante" as const,
    status_reserva: "Lead" as const,
    pendente_aprovacao: true,
    inscricao_origem: "Formulário público",
  };
}

/** Patch de MERGE: só preenche o que está vazio no existente (não sobrescreve). */
function patchMerge(existente: Pax, d: Dados): Record<string, unknown> {
  const novo = novosCampos(d, soDigitosCpf(d.cpf));
  const patch: Record<string, unknown> = { pendente_aprovacao: true };
  for (const [campo, valor] of Object.entries(novo)) {
    if (campo === "tipo" || campo === "status_reserva" || campo === "pendente_aprovacao" || campo === "inscricao_origem" || campo === "cpf") continue;
    if (campo === "saude") {
      const merged = { ...((existente.saude ?? {}) as SaudePassageiro), ...(valor as SaudePassageiro) };
      if (Object.keys(merged).length) patch.saude = merged;
      continue;
    }
    const atual = (existente as Record<string, unknown>)[campo];
    if (!temValor(atual) && temValor(valor)) patch[campo] = valor;
  }
  return patch;
}

async function subirPassaporteReal(
  sb: ReturnType<typeof createServiceRoleClient>,
  expedicaoId: string,
  passageiroId: string,
  file: File,
): Promise<void> {
  const storage_path = `${expedicaoId}/passageiros/${passageiroId}/${safeName("Documentos pessoais")}/${randomUUID()}-${safeName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from(BUCKET).upload(storage_path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) return;
  const arqIns = await sb
    .from("arquivos")
    .insert({
      expedicao_id: expedicaoId, passageiro_id: passageiroId, categoria: "Documentos pessoais",
      nome: file.name, descricao: "Passaporte — prontidão", mime: file.type || null,
      tamanho_bytes: file.size, storage_path,
    })
    .select("id").single();
  if (!arqIns.error) {
    await sb.from("passageiros").update({ passaporte_arquivo_id: (arqIns.data as { id: string }).id }).eq("id", passageiroId);
  }
}

export async function enviarInscricao(formData: FormData): Promise<InscricaoResult> {
  let dadosRaw: unknown;
  try {
    dadosRaw = JSON.parse(String(formData.get("dados") ?? "{}"));
  } catch {
    return { ok: false, error: "Dados do formulário inválidos." };
  }
  const parsed = dadosSchema.safeParse(dadosRaw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;

  const cpf = soDigitosCpf(d.cpf);
  if (!cpfValido(cpf)) return { ok: false, error: "CPF inválido." };

  const existente = await acharExistente(d.expedicao_id, cpf);

  // Conflito de nascimento (segurança): não deixa completar registro de outra pessoa.
  if (existente?.data_nascimento && existente.data_nascimento.slice(0, 10) !== d.data_nascimento.slice(0, 10)) {
    return { ok: false, error: "Os dados não conferem com a nossa base. Confira ou fale com a agência." };
  }

  // Passaporte: obrigatório só quando ainda não temos o anexo.
  const precisaAnexo = !existente?.passaporte_arquivo_id;
  const fileRaw = formData.get("passaporte");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  if (precisaAnexo && !file) return { ok: false, error: "Anexe a foto ou PDF do seu passaporte." };
  if (file) {
    const err = validarArquivo(file);
    if (err) return { ok: false, error: err };
  }

  // ─── MOCK ───────────────────────────────────────────────────────────────
  if (DEV_USE_MOCK_DATA) {
    if (existente) {
      Object.assign(existente, patchMerge(existente, d), { updated_at: new Date().toISOString() });
      if (file) {
        const arq = await addArquivoMock(
          { expedicao_id: d.expedicao_id, passageiro_id: existente.id, categoria: "Documentos pessoais", nome: file.name, descricao: "Passaporte — prontidão", mime: file.type || null, tamanho_bytes: file.size },
          Buffer.from(await file.arrayBuffer()),
        );
        existente.passaporte_arquivo_id = arq.id;
      }
      return { ok: true, completou: true };
    }
    const id = `p${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;
    const now = new Date().toISOString();
    let passaporteArqId: string | null = null;
    if (file) {
      const arq = await addArquivoMock(
        { expedicao_id: d.expedicao_id, passageiro_id: id, categoria: "Documentos pessoais", nome: file.name, descricao: "Passaporte — prontidão", mime: file.type || null, tamanho_bytes: file.size },
        Buffer.from(await file.arrayBuffer()),
      );
      passaporteArqId = arq.id;
    }
    const novo: Pax = {
      ...PASSAGEIRO_INSCRICAO_DEFAULTS,
      ...novosCampos(d, cpf),
      expedicao_id: d.expedicao_id,
      id, grupo_id: null, conexao_viagem_id: null, bitrix_contact_id: null, bitrix_deal_id: null,
      passaporte_arquivo_id: passaporteArqId,
      voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null,
      valor_contratado_brl: 0, valor_pago_brl: 0, saldo_brl: 0, status_financeiro: "Em aberto",
      restricoes_alimentares: null, condicoes_medicas: null, contrato_assinado: false,
      checkin_online_feito: false, observacoes: null, created_at: now, updated_at: now,
    };
    mockPassageiros.push(novo);
    await gerarRequisitosPadrao(d.expedicao_id);
    return { ok: true, completou: false };
  }

  // ─── PROD (Supabase, service role) ──────────────────────────────────────
  const sb = createServiceRoleClient();

  if (existente) {
    const patch = patchMerge(existente, d);
    const upd = await sb.from("passageiros").update(patch).eq("id", existente.id);
    if (upd.error) return { ok: false, error: upd.error.message };
    if (file) await subirPassaporteReal(sb, d.expedicao_id, existente.id, file);
    await gerarRequisitosPadrao(d.expedicao_id);
    return { ok: true, completou: true };
  }

  const ins = await sb
    .from("passageiros")
    .insert({ ...novosCampos(d, cpf), expedicao_id: d.expedicao_id })
    .select("id").single();
  if (ins.error) return { ok: false, error: ins.error.message };
  const passageiroId = (ins.data as { id: string }).id;
  if (file) await subirPassaporteReal(sb, d.expedicao_id, passageiroId, file);
  await gerarRequisitosPadrao(d.expedicao_id);
  return { ok: true, completou: false };
}
