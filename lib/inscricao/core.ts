// Núcleo compartilhado da inscrição pública (NÃO é "use server" — exporta helpers
// além de actions). Usado pelo formulário (staging) e pela fila (materialização
// na aprovação). Roda sempre no servidor.
import { z } from "zod";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { gerarRequisitosPadrao } from "@/app/(app)/expedicoes/actions";
import { soDigitosCpf } from "@/lib/cpf";
import { MAX_UPLOAD_BYTES, MIME_ARQUIVO_PERMITIDOS } from "@/lib/constants";
import { mockPassageiros, PASSAGEIRO_INSCRICAO_DEFAULTS } from "@/lib/mock-data";
import type { SaudePassageiro, Tables } from "@/types/database";

export type Pax = Tables<"passageiros">;

export const temValor = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
const str = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const temSaude = (v: unknown) => !!v && typeof v === "object" && Object.keys(v as object).length > 0;

export function safeName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

// Campos PESSOAIS que "seguem a pessoa" entre expedições (autocompletar).
export const CAMPOS_PESSOAIS_CARRY = [
  "nome_completo", "data_nascimento", "email", "telefone",
  "passaporte", "validade_passaporte", "passaporte_arquivo_id",
  "endereco_cep", "endereco_rua", "endereco_numero", "endereco_complemento",
  "endereco_bairro", "endereco_cidade", "endereco_estado",
  "contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo",
  "restricoes_alimentares", "condicoes_medicas", "saude",
  "ja_viajou_internacional", "paises_visitados",
] as const;

// Campos checados pra dizer "já temos" (rótulos).
export const CAMPOS_CHECAR = [
  "nome_completo", "data_nascimento", "email", "telefone",
  "endereco_cep", "endereco_rua", "endereco_numero", "endereco_cidade", "endereco_estado",
  "passaporte", "validade_passaporte",
  "contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo",
] as const;

// Campos pessoais que PROPAGAM para as outras expedições ao materializar (saúde e
// anexo do passaporte ficam por linha).
const CAMPOS_PROPAGAR = [
  "nome_completo", "email", "telefone", "passaporte", "validade_passaporte",
  "endereco_cep", "endereco_rua", "endereco_numero", "endereco_complemento",
  "endereco_bairro", "endereco_cidade", "endereco_estado",
  "contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo",
  "ja_viajou_internacional", "paises_visitados",
] as const;

/** Todas as linhas de passageiro (em QUALQUER expedição) da pessoa com este CPF. */
export async function acharLinhasPorCpf(cpf: string): Promise<Pax[]> {
  if (DEV_USE_MOCK_DATA) {
    return mockPassageiros.filter((p) => soDigitosCpf(p.cpf ?? "") === cpf);
  }
  const sb = createServiceRoleClient();
  const { data } = await sb.from("passageiros").select("*").not("cpf", "is", null);
  return ((data ?? []) as Pax[]).filter((p) => soDigitosCpf(p.cpf ?? "") === cpf);
}

/** Consolida o perfil PESSOAL (valor mais recente não-nulo) entre as linhas da pessoa. */
export function agregarPerfil(linhas: Pax[]): Partial<Pax> | null {
  if (!linhas.length) return null;
  const ord = [...linhas].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const perfil: Record<string, unknown> = {};
  for (const campo of CAMPOS_PESSOAIS_CARRY) {
    for (const r of ord) {
      const v = (r as Record<string, unknown>)[campo];
      if (campo === "saude" ? temSaude(v) : temValor(v)) perfil[campo] = v;
    }
  }
  return perfil as Partial<Pax>;
}

/** Completa a partir do perfil global — só onde ainda NÃO há valor. */
function camposBackfill(jaTem: (campo: string) => boolean, perfil: Partial<Pax> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!perfil) return out;
  for (const campo of CAMPOS_PESSOAIS_CARRY) {
    const v = (perfil as Record<string, unknown>)[campo];
    const temPerfil = campo === "saude" ? temSaude(v) : temValor(v);
    if (temPerfil && !jaTem(campo)) out[campo] = v;
  }
  return out;
}

// ── Schema do formulário ────────────────────────────────────────────────────
export const dadosSchema = z.object({
  expedicao_id: z.string().min(1, "Selecione a expedição desejada."),
  cpf: z.string().trim().min(11, "CPF inválido."),
  data_nascimento: z.string().min(8, "Informe sua data de nascimento."),
  nome_completo: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  telefone: z.string().trim().optional().default(""),
  passaporte: z.string().trim().optional().default(""),
  validade_passaporte: z.string().trim().optional().default(""),
  possui_passaporte: z.boolean().nullable().default(null),
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
export type Dados = z.infer<typeof dadosSchema>;

// ── Valores pra pré-preencher o formulário ──────────────────────────────────
export type ValoresInscricao = {
  nome_completo: string; email: string; telefone: string;
  passaporte: string; validade_passaporte: string;
  endereco_cep: string; endereco_rua: string; endereco_numero: string;
  endereco_complemento: string; endereco_bairro: string; endereco_cidade: string; endereco_estado: string;
  contato_emergencia_nome: string; contato_emergencia_fone: string; contato_emergencia_vinculo: string;
  paises_visitados: string;
  ja_viajou_internacional: boolean | null;
  pref_marcar_assento: boolean | null; pref_upgrade_classe: string | null;
  acompanhante_nome: string; acompanhante_divide_quarto: string | null;
  saude: SaudePassageiro;
};

export function montarValores(base: Partial<Pax>, existente: Pax | null): ValoresInscricao {
  const s = (v: unknown) => (v == null ? "" : String(v));
  const b = base as Record<string, unknown>;
  const ex = (existente ?? {}) as Record<string, unknown>;
  return {
    nome_completo: s(b.nome_completo), email: s(b.email), telefone: s(b.telefone),
    passaporte: s(b.passaporte), validade_passaporte: s(b.validade_passaporte).slice(0, 10),
    endereco_cep: s(b.endereco_cep), endereco_rua: s(b.endereco_rua), endereco_numero: s(b.endereco_numero),
    endereco_complemento: s(b.endereco_complemento), endereco_bairro: s(b.endereco_bairro),
    endereco_cidade: s(b.endereco_cidade), endereco_estado: s(b.endereco_estado),
    contato_emergencia_nome: s(b.contato_emergencia_nome), contato_emergencia_fone: s(b.contato_emergencia_fone),
    contato_emergencia_vinculo: s(b.contato_emergencia_vinculo),
    paises_visitados: s(b.paises_visitados),
    ja_viajou_internacional: typeof b.ja_viajou_internacional === "boolean" ? (b.ja_viajou_internacional as boolean) : null,
    pref_marcar_assento: typeof ex.pref_marcar_assento === "boolean" ? (ex.pref_marcar_assento as boolean) : null,
    pref_upgrade_classe: ex.pref_upgrade_classe ? String(ex.pref_upgrade_classe) : null,
    acompanhante_nome: s(ex.acompanhante_nome),
    acompanhante_divide_quarto: ex.acompanhante_divide_quarto ? String(ex.acompanhante_divide_quarto) : null,
    saude: (b.saude && typeof b.saude === "object" ? b.saude : {}) as SaudePassageiro,
  };
}

// ── Essenciais (rede de segurança do servidor) ──────────────────────────────
const ESSENCIAIS: { campo: string; label: string; email?: boolean }[] = [
  { campo: "nome_completo", label: "nome" },
  { campo: "email", label: "e-mail", email: true },
  { campo: "telefone", label: "telefone" },
  { campo: "endereco_cep", label: "CEP" },
  { campo: "endereco_rua", label: "logradouro" },
  { campo: "endereco_numero", label: "número" },
  { campo: "endereco_cidade", label: "cidade" },
  { campo: "endereco_estado", label: "estado" },
  { campo: "contato_emergencia_nome", label: "contato de emergência (nome)" },
  { campo: "contato_emergencia_fone", label: "contato de emergência (telefone)" },
  { campo: "contato_emergencia_vinculo", label: "contato de emergência (vínculo)" },
];
export function essenciaisFaltando(rec: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const c of ESSENCIAIS) {
    const v = rec[c.campo];
    if (v == null || String(v).trim() === "") out.push(c.label);
    else if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) out.push("e-mail válido");
  }
  return out;
}

export function validarArquivo(file: File): string | null {
  if (file.size === 0) return "Arquivo do passaporte vazio.";
  if (file.size > MAX_UPLOAD_BYTES) return `O passaporte excede ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`;
  if (!MIME_ARQUIVO_PERMITIDOS.includes(file.type as (typeof MIME_ARQUIVO_PERMITIDOS)[number])) {
    return "Envie o passaporte como imagem (JPG/PNG) ou PDF.";
  }
  return null;
}

/** Campos da reserva/pessoais a partir do form (para insert novo). */
export function novosCampos(d: Dados, cpf: string) {
  return {
    nome_completo: d.nome_completo, cpf, data_nascimento: d.data_nascimento,
    email: str(d.email), telefone: str(d.telefone),
    passaporte: str(d.passaporte), validade_passaporte: str(d.validade_passaporte),
    contato_emergencia_nome: str(d.contato_emergencia_nome),
    contato_emergencia_fone: str(d.contato_emergencia_fone),
    contato_emergencia_vinculo: str(d.contato_emergencia_vinculo),
    endereco_cep: str(d.endereco_cep), endereco_rua: str(d.endereco_rua), endereco_numero: str(d.endereco_numero),
    endereco_complemento: str(d.endereco_complemento), endereco_bairro: str(d.endereco_bairro),
    endereco_cidade: str(d.endereco_cidade), endereco_estado: str(d.endereco_estado),
    pref_marcar_assento: d.pref_marcar_assento, pref_upgrade_classe: str(d.pref_upgrade_classe ?? ""),
    ja_viajou_internacional: d.ja_viajou_internacional, paises_visitados: str(d.paises_visitados),
    acompanhante_nome: str(d.acompanhante_nome), acompanhante_divide_quarto: str(d.acompanhante_divide_quarto ?? ""),
    saude: (d.saude ?? {}) as SaudePassageiro,
    tipo: "Pagante" as const, inscricao_origem: "Formulário público",
  };
}

/** Sobrescreve dados pessoais/reserva no existente com o que foi revisado. Saúde é mesclada. */
function patchAtualizar(existente: Pax, d: Dados): Record<string, unknown> {
  const novo = novosCampos(d, soDigitosCpf(d.cpf));
  const patch: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(novo)) {
    if (campo === "tipo" || campo === "inscricao_origem" || campo === "cpf") continue;
    if (campo === "saude") {
      patch.saude = { ...((existente.saude ?? {}) as SaudePassageiro), ...(valor as SaudePassageiro) };
      continue;
    }
    patch[campo] = valor;
  }
  return patch;
}

function pessoaisPropagar(d: Dados): Record<string, unknown> {
  const novo = novosCampos(d, soDigitosCpf(d.cpf)) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS_PROPAGAR) if (k in novo) out[k] = novo[k];
  return out;
}

export type PendenteMaterializar = {
  expedicao_id: string;
  cpf: string;
  dados: Dados;
  passaporte_arquivo_id: string | null;
};

/**
 * APROVAÇÃO: grava a inscrição no passageiro. Atualiza a linha desta expedição
 * (ou cria) com os dados revisados, promove Lead→Pré-reserva, propaga os dados
 * pessoais para as outras expedições da pessoa, linka o anexo do passaporte e
 * gera os requisitos. Retorna a linha do passageiro (para o outbound Bitrix).
 */
export async function materializarInscricao(pend: PendenteMaterializar): Promise<Pax | null> {
  const { expedicao_id, cpf, dados: d, passaporte_arquivo_id } = pend;
  const linhas = await acharLinhasPorCpf(cpf);
  const existente = linhas.find((l) => l.expedicao_id === expedicao_id) ?? null;
  const perfil = agregarPerfil(linhas);

  // ── MOCK ──
  if (DEV_USE_MOCK_DATA) {
    const propagar = (idAtual: string) => {
      const prop = pessoaisPropagar(d);
      if (!Object.keys(prop).length) return;
      for (const l of linhas) if (l.id !== idAtual) Object.assign(l, prop, { updated_at: new Date().toISOString() });
    };
    if (existente) {
      const patch = patchAtualizar(existente, d);
      patch.pendente_aprovacao = false;
      if (existente.status_reserva === "Lead") patch.status_reserva = "Pré-reserva";
      if (passaporte_arquivo_id) patch.passaporte_arquivo_id = passaporte_arquivo_id;
      Object.assign(existente, patch, { updated_at: new Date().toISOString() });
      propagar(existente.id);
      await gerarRequisitosPadrao(expedicao_id);
      return existente;
    }
    const id = `p${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;
    const now = new Date().toISOString();
    const novo = {
      ...PASSAGEIRO_INSCRICAO_DEFAULTS,
      ...novosCampos(d, cpf),
      expedicao_id, id, grupo_id: null, conexao_viagem_id: null, bitrix_contact_id: null, bitrix_deal_id: null,
      passaporte_arquivo_id: passaporte_arquivo_id, voo_nacional_necessario: false, companhia_aerea: null,
      localizador: null, quarto_id: null, valor_contratado_brl: 0, valor_pago_brl: 0, saldo_brl: 0,
      status_financeiro: "Em aberto", restricoes_alimentares: null, condicoes_medicas: null,
      contrato_assinado: false, checkin_online_feito: false, observacoes: null,
      status_reserva: "Pré-reserva", pendente_aprovacao: false,
      created_at: now, updated_at: now,
    } as unknown as Pax;
    Object.assign(novo, camposBackfill((c) => temValor((novo as Record<string, unknown>)[c]), perfil));
    mockPassageiros.push(novo);
    propagar(novo.id);
    await gerarRequisitosPadrao(expedicao_id);
    return novo;
  }

  // ── PROD ──
  const sb = createServiceRoleClient();
  const propagarProd = async (idAtual: string) => {
    const prop = pessoaisPropagar(d);
    const ids = linhas.filter((l) => l.id !== idAtual).map((l) => l.id);
    if (Object.keys(prop).length && ids.length) await sb.from("passageiros").update(prop).in("id", ids);
  };
  const linkarAnexo = async (paxId: string) => {
    if (passaporte_arquivo_id) await sb.from("arquivos").update({ passageiro_id: paxId }).eq("id", passaporte_arquivo_id);
  };

  let paxId: string;
  if (existente) {
    const patch = patchAtualizar(existente, d);
    patch.pendente_aprovacao = false;
    if (existente.status_reserva === "Lead") patch.status_reserva = "Pré-reserva";
    if (passaporte_arquivo_id) patch.passaporte_arquivo_id = passaporte_arquivo_id;
    const upd = await sb.from("passageiros").update(patch).eq("id", existente.id);
    if (upd.error) throw new Error(upd.error.message);
    paxId = existente.id;
  } else {
    const registro: Record<string, unknown> = {
      ...novosCampos(d, cpf), expedicao_id,
      status_reserva: "Pré-reserva", pendente_aprovacao: false,
      passaporte_arquivo_id,
    };
    Object.assign(registro, camposBackfill((c) => temValor(registro[c]), perfil));
    const ins = await sb.from("passageiros").insert(registro).select("*").single();
    if (ins.error) throw new Error(ins.error.message);
    paxId = (ins.data as Pax).id;
  }
  await propagarProd(paxId);
  await linkarAnexo(paxId);
  await gerarRequisitosPadrao(expedicao_id);
  const { data: pax } = await sb.from("passageiros").select("*").eq("id", paxId).maybeSingle();
  return (pax as Pax | null) ?? null;
}
