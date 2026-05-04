import { z } from "zod";

export const passageiroSyncSchema = z.object({
  bitrix_deal_id: z.string().min(1),
  bitrix_contact_id: z.string().nullable().optional(),
  expedicao_codigo: z.string().min(1),
  estagio_deal: z.string().min(1),
  nome_completo: z.string().min(1),
  email: z.string().email().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  passaporte: z.string().nullable().optional(),
  validade_passaporte: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  voo_nacional_necessario: z.boolean().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const expedicaoSyncSchema = z.object({
  bitrix_pipeline_id: z.string().min(1),
  codigo: z.string().min(1),
  nome: z.string().min(1),
  destino: z.string().min(1),
  data_embarque: z.string().min(1),
  data_retorno: z.string().min(1),
  pax_planejados: z.number().int().nonnegative().optional(),
  preco_venda_brl: z.number().nonnegative().optional(),
});
