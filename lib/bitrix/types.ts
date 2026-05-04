/**
 * Tipos do payload que o n8n envia (já transformado a partir do Bitrix).
 * O n8n é responsável por achatar campos UF_CRM_* em chaves planas.
 */

export interface BitrixPassageiroPayload {
  bitrix_deal_id: string;
  bitrix_contact_id?: string | null;
  expedicao_codigo: string;            // PIPE-001, identifica a expedição
  estagio_deal: string;                // STAGE_ID do deal — vai pro stage-mapping
  nome_completo: string;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  passaporte?: string | null;
  validade_passaporte?: string | null; // ISO date
  data_nascimento?: string | null;
  voo_nacional_necessario?: boolean | null;
  observacoes?: string | null;
}

export interface BitrixExpedicaoPayload {
  bitrix_pipeline_id: string;          // ID do pipeline no Bitrix
  codigo: string;                      // codigo único da expedição
  nome: string;
  destino: string;
  data_embarque: string;
  data_retorno: string;
  pax_planejados?: number;
  preco_venda_brl?: number;
}

export interface SyncResponse {
  ok: boolean;
  passageiro_id?: string;
  expedicao_id?: string;
  action?: "created" | "updated";
  error?: string;
}
