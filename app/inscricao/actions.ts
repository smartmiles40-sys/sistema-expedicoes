"use server";
import { randomUUID } from "node:crypto";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { cpfValido, soDigitosCpf } from "@/lib/cpf";
import { mockExpedicoes } from "@/lib/mock-data";
import { mockInscricoesPendentes } from "@/lib/mock-data";
import { addArquivoMock } from "@/lib/data/arquivos-mock";
import {
  dadosSchema, acharLinhasPorCpf, agregarPerfil, montarValores, CAMPOS_CHECAR, temValor,
  essenciaisFaltando, validarArquivo, safeName,
  type Pax, type ValoresInscricao,
} from "@/lib/inscricao/core";
import type { ExpedicaoRow, InscricaoPendenteRow, Json } from "@/types/database";
import type { CategoriaArquivo } from "@/lib/constants";

const BUCKET = "arquivos-expedicoes";

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

export type Identificacao =
  | { ok: false; error: string }
  | { ok: true; existe: false }
  | { ok: true; existe: true; conflito: true }
  | { ok: true; existe: true; conflito: false; temos: string[]; temPassaporteAnexo: boolean; valores: ValoresInscricao };

/** Passo 1: identifica o passageiro pelo CPF + nascimento (na expedição OU no histórico). */
export async function identificarInscricao(
  expedicaoId: string,
  cpfRaw: string,
  nascimento: string,
): Promise<Identificacao> {
  const cpf = soDigitosCpf(cpfRaw);
  if (!expedicaoId) return { ok: false, error: "Selecione a expedição desejada." };
  if (!cpfValido(cpf)) return { ok: false, error: "CPF inválido." };
  if (!nascimento || nascimento.length < 8) return { ok: false, error: "Informe sua data de nascimento." };

  const linhas = await acharLinhasPorCpf(cpf);
  const existente = linhas.find((l) => l.expedicao_id === expedicaoId) ?? null;
  const base = (existente ?? agregarPerfil(linhas)) as Partial<Pax> | null;
  if (!base) return { ok: true, existe: false };

  // Trava: se já temos o nascimento e não bate, não revela nada.
  if (base.data_nascimento && base.data_nascimento.slice(0, 10) !== nascimento.slice(0, 10)) {
    return { ok: true, existe: true, conflito: true };
  }

  const temos = CAMPOS_CHECAR.filter((c) => temValor((base as Record<string, unknown>)[c]));
  return {
    ok: true, existe: true, conflito: false, temos,
    temPassaporteAnexo: temValor(base.passaporte_arquivo_id),
    valores: montarValores(base, existente),
  };
}

export type InscricaoResult = { ok: true; completou: boolean } | { ok: false; error: string };

/** Acha a inscrição pendente (staging) desta pessoa nesta expedição. */
async function acharPendente(expedicaoId: string, cpf: string): Promise<InscricaoPendenteRow | null> {
  if (DEV_USE_MOCK_DATA) {
    return mockInscricoesPendentes.find((p) => p.expedicao_id === expedicaoId && p.cpf === cpf) ?? null;
  }
  const sb = createServiceRoleClient();
  const { data } = await sb.from("inscricoes_pendentes").select("*").eq("expedicao_id", expedicaoId).eq("cpf", cpf).maybeSingle();
  return (data as InscricaoPendenteRow | null) ?? null;
}

/** Sobe um anexo para o staging (arquivo sem passageiro_id ainda; linkado na aprovação). */
async function subirArquivoStaging(expedicaoId: string, file: File, categoria: CategoriaArquivo, descricao: string): Promise<string | null> {
  if (DEV_USE_MOCK_DATA) {
    const arq = await addArquivoMock(
      { expedicao_id: expedicaoId, passageiro_id: null, categoria, nome: file.name, descricao, mime: file.type || null, tamanho_bytes: file.size },
      Buffer.from(await file.arrayBuffer()),
    );
    return arq.id;
  }
  const sb = createServiceRoleClient();
  const path = `${expedicaoId}/inscricoes/${randomUUID()}/${safeName(categoria)}/${randomUUID()}-${safeName(file.name)}`;
  const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream", upsert: false,
  });
  if (up.error) return null;
  const ins = await sb.from("arquivos").insert({
    expedicao_id: expedicaoId, passageiro_id: null, categoria,
    nome: file.name, descricao, mime: file.type || null,
    tamanho_bytes: file.size, storage_path: path,
  }).select("id").single();
  if (ins.error) return null;
  return (ins.data as { id: string }).id;
}

/** Remove um anexo de staging órfão (ao substituir por um novo). */
async function removerArquivoStaging(arqId: string): Promise<void> {
  if (DEV_USE_MOCK_DATA) return;
  const sb = createServiceRoleClient();
  const { data } = await sb.from("arquivos").select("storage_path").eq("id", arqId).maybeSingle();
  const sp = (data as { storage_path: string } | null)?.storage_path;
  if (sp) await sb.storage.from(BUCKET).remove([sp]);
  await sb.from("arquivos").delete().eq("id", arqId);
}

/**
 * Envio do formulário: NÃO grava no passageiro. Guarda a inscrição na área de
 * espera (inscricoes_pendentes). Só a APROVAÇÃO materializa no passageiro.
 */
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

  const linhas = await acharLinhasPorCpf(cpf);
  const existente = linhas.find((l) => l.expedicao_id === d.expedicao_id) ?? null;
  const perfil = agregarPerfil(linhas);

  // Conflito de nascimento (segurança).
  const nascConhecido = existente?.data_nascimento ?? perfil?.data_nascimento ?? null;
  if (nascConhecido && nascConhecido.slice(0, 10) !== d.data_nascimento.slice(0, 10)) {
    return { ok: false, error: "Os dados não conferem com a nossa base. Confira ou fale com a agência." };
  }

  const pendenteExistente = await acharPendente(d.expedicao_id, cpf);

  // Passaporte: exigido só se ainda não temos o anexo (nem no pax, nem no staging).
  const anexoConhecido = existente?.passaporte_arquivo_id ?? perfil?.passaporte_arquivo_id ?? pendenteExistente?.passaporte_arquivo_id ?? null;
  const precisaAnexo = !anexoConhecido;
  const fileRaw = formData.get("passaporte");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  if (precisaAnexo && d.possui_passaporte !== false && !file) {
    return { ok: false, error: "Anexe a foto ou PDF do seu passaporte." };
  }
  if (file) {
    const err = validarArquivo(file);
    if (err) return { ok: false, error: err };
  }

  // Foto do viajante (opcional).
  const fotoRaw = formData.get("foto");
  const foto = fotoRaw instanceof File && fotoRaw.size > 0 ? fotoRaw : null;
  if (foto) {
    const err = validarArquivo(foto);
    if (err) return { ok: false, error: err };
  }

  // Certificado de Febre Amarela (opcional; só quando respondeu "Sim").
  const certRaw = formData.get("certificado");
  const certFile = certRaw instanceof File && certRaw.size > 0 ? certRaw : null;
  if (certFile) {
    const err = validarArquivo(certFile);
    if (err) return { ok: false, error: err };
  }

  // Rede de segurança: campos essenciais + confirmação de veracidade.
  const faltam = essenciaisFaltando(d as unknown as Record<string, unknown>);
  if (faltam.length) return { ok: false, error: "Faltam dados obrigatórios: " + faltam.join(", ") };
  if (!d.confirmou_veracidade) return { ok: false, error: "Confirme que revisou as informações antes de enviar." };

  // Anexos: novo upload substitui o antigo do staging; sem novo upload, mantém o que já havia.
  let passaporteArqId = pendenteExistente?.passaporte_arquivo_id ?? null;
  if (file) {
    const novo = await subirArquivoStaging(d.expedicao_id, file, "Documentos pessoais", "Passaporte — prontidão");
    if (novo) {
      if (passaporteArqId) await removerArquivoStaging(passaporteArqId);
      passaporteArqId = novo;
    }
  }
  let fotoArqId = pendenteExistente?.foto_arquivo_id ?? null;
  if (foto) {
    const novo = await subirArquivoStaging(d.expedicao_id, foto, "Outros", "Foto do viajante");
    if (novo) {
      if (fotoArqId) await removerArquivoStaging(fotoArqId);
      fotoArqId = novo;
    }
  }

  // Certificado de Febre Amarela — guardado dentro do jsonb de saúde
  // (`saude.vacina_febre_amarela_arquivo_id`), que já flui pro pax na aprovação.
  const saudePrev = (pendenteExistente?.dados as { saude?: Record<string, string> } | null)?.saude ?? null;
  let certArqId = saudePrev?.vacina_febre_amarela_arquivo_id ?? null;
  if (certFile) {
    const novo = await subirArquivoStaging(d.expedicao_id, certFile, "Documentos pessoais", "Certificado Internacional de Vacinação — Febre Amarela");
    if (novo) {
      if (certArqId) await removerArquivoStaging(certArqId);
      certArqId = novo;
    }
  }
  const saudeObj = (d.saude ?? {}) as Record<string, string>;
  if (certArqId) saudeObj.vacina_febre_amarela_arquivo_id = certArqId;
  else delete saudeObj.vacina_febre_amarela_arquivo_id;
  d.saude = saudeObj;

  const registro = {
    expedicao_id: d.expedicao_id,
    cpf,
    data_nascimento: d.data_nascimento.slice(0, 10),
    nome_completo: d.nome_completo || null,
    dados: d as unknown as Json,
    passaporte_arquivo_id: passaporteArqId,
    foto_arquivo_id: fotoArqId,
    origem: "Formulário público",
    // Reenvio de quem tinha sido recusado volta pra fila como pendente.
    status: "pendente",
    recusada_em: null,
  };

  if (DEV_USE_MOCK_DATA) {
    const now = new Date().toISOString();
    const idx = mockInscricoesPendentes.findIndex((p) => p.expedicao_id === d.expedicao_id && p.cpf === cpf);
    if (idx >= 0) {
      mockInscricoesPendentes[idx] = { ...mockInscricoesPendentes[idx], ...registro, updated_at: now };
    } else {
      mockInscricoesPendentes.push({ ...registro, id: `insc${Math.random().toString(36).slice(2, 12)}`, created_at: now, updated_at: now });
    }
    return { ok: true, completou: !!(existente || perfil) };
  }

  const sb = createServiceRoleClient();
  const up = await sb.from("inscricoes_pendentes").upsert(registro, { onConflict: "expedicao_id,cpf" });
  if (up.error) return { ok: false, error: up.error.message };
  return { ok: true, completou: !!(existente || perfil) };
}
