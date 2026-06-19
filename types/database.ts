/**
 * Tipos do schema Postgres. Escritos à mão (Supabase ainda não conectado).
 * Quando o projeto Supabase existir, regerar com:
 *   supabase gen types typescript --project-id <id> > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PapelUsuario = "admin" | "operacional" | "comercial" | "financeiro" | "leitura";
export type StatusExpedicao = "Planejamento" | "Vendas Abertas" | "Em andamento" | "Concluída" | "Cancelada";
export type StatusReserva = "Lead" | "Pré-reserva" | "Confirmado" | "Cancelado";
export type TipoPassageiro = "Pagante" | "Cortesia" | "Líder";
export type TipoFornecedor = "DMC" | "Hotel" | "Guia" | "Aéreo" | "Receptivo" | "Seguro" | "Outros";
export type StatusFornecedor = "Ativo" | "Pausado" | "Bloqueado";
export type CategoriaCusto = "Hotelaria" | "Aéreo" | "Terrestre" | "Ingressos" | "Guias" | "Seguro" | "Taxas" | "Brindes" | "Outros";
export type StatusCusto = "A programar" | "Programado" | "Pago" | "Parcial" | "Vencido";
export type StatusPagamento = "Pendente" | "Programado" | "Pago" | "Parcial" | "Vencido" | "Cancelado";
export type EtapaChecklist =
  | "Após o fechamento"
  | "12 a 6 meses"
  | "6 a 2 meses"
  | "2 meses a 15 dias"
  | "Na semana"
  | "Pós-viagem";
export type StatusChecklist = "Pendente" | "Em andamento" | "Atenção" | "Concluído" | "Bloqueado";
export type Prioridade = "Baixa" | "Média" | "Alta" | "Crítica";
export type TipoQuarto = "Single" | "Duplo" | "Twin" | "Triplo" | "Compartilhado" | "Líder";

// Motor de Prontidão para Embarque (migration 0010)
export type TipoRequisito =
  | "Passaporte"
  | "RG"
  | "Visto"
  | "Vacina"
  | "Seguro"
  | "Aéreo Internacional"
  | "Aéreo Doméstico"
  | "Contrato"
  | "Autorização de Menor"
  | "Pagamento"
  | "Dados Pessoais";
export type Obrigatoriedade = "Obrigatório" | "Condicional" | "Recomendado";
export type StatusRequisito =
  | "Pendente"
  | "Em análise"
  | "Enviado"
  | "Aprovado"
  | "Vencido"
  | "Dispensado"
  | "Reprovado";
/** Semáforo consolidado de prontidão de um passageiro. */
export type Prontidao = "Apto" | "Atenção" | "Bloqueado";

// ========== Row interfaces ==========

export type UsuarioRow = {
  id: string;
  email: string;
  nome: string;
  papel: PapelUsuario;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type FornecedorRow = {
  id: string;
  nome: string;
  tipo: TipoFornecedor;
  contato_nome: string | null;
  contato_email: string | null;
  contato_whatsapp: string | null;
  destino_cidade: string | null;
  servicos: string[] | null;
  moeda_padrao: string;
  politica_pagamento: string | null;
  status: StatusFornecedor;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type CambioRow = {
  moeda: string;
  taxa_brl: number;
  atualizado_em: string;
}

export type ExpedicaoRow = {
  id: string;
  codigo: string;
  nome: string;
  destino: string;
  data_embarque: string;
  data_retorno: string;
  responsavel_operacional_id: string | null;
  responsavel_comercial_id: string | null;
  dmc_principal_id: string | null;
  status: StatusExpedicao;
  pax_planejados: number;
  pax_cortesia: number;
  preco_venda_brl: number;
  bitrix_pipeline_id: string | null;
  observacoes: string | null;
  ordem: number | null;
  created_at: string;
  updated_at: string;
}

export type PassageiroRow = {
  id: string;
  expedicao_id: string | null; // null = passageiro avulso (na base, sem expedição)
  grupo_id: string | null;
  bitrix_contact_id: string | null;
  bitrix_deal_id: string | null;
  nome_completo: string;
  tipo: TipoPassageiro;
  cpf: string | null;
  passaporte: string | null;
  data_nascimento: string | null;
  validade_passaporte: string | null;
  email: string | null;
  telefone: string | null;
  status_reserva: StatusReserva;
  voo_nacional_necessario: boolean;
  companhia_aerea: string | null;
  localizador: string | null;
  quarto_id: string | null;
  // Financeiro espelhado do Bitrix (migration 0010)
  valor_contratado_brl: number;
  valor_pago_brl: number;
  saldo_brl: number; // gerado: valor_contratado_brl - valor_pago_brl
  status_financeiro: string;
  // Dados de embarque/pessoais (migration 0010)
  contato_emergencia_nome: string | null;
  contato_emergencia_fone: string | null;
  restricoes_alimentares: string | null;
  condicoes_medicas: string | null;
  contrato_assinado: boolean;
  checkin_online_feito: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type RequisitoDestinoRow = {
  id: string;
  destino: string;
  tipo: TipoRequisito;
  descricao: string;
  obrigatoriedade: Obrigatoriedade;
  bloqueia_embarque: boolean;
  meses_validade_minima: number | null;
  papel_responsavel: PapelUsuario | null;
  ordem: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type PassageiroRequisitoRow = {
  id: string;
  passageiro_id: string;
  tipo: TipoRequisito;
  descricao: string;
  status: StatusRequisito;
  obrigatoriedade: Obrigatoriedade;
  bloqueia_embarque: boolean;
  validade: string | null;
  numero: string | null;
  arquivo_id: string | null;
  responsavel_id: string | null;
  verificado_em: string | null;
  verificado_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha da view vw_prontidao_passageiro (mesma lógica em lib/prontidao/regras.ts). */
export type ProntidaoPassageiroView = {
  passageiro_id: string;
  expedicao_id: string;
  nome_completo: string;
  data_embarque: string;
  data_retorno: string;
  dias_ate_embarque: number;
  bloqueios_abertos: number;
  pendencias_leves: number;
  passaporte_em_alerta: number;
  tem_saldo: boolean;
  prontidao: Prontidao;
}

export type CategoriaArquivo =
  | "Aéreos"
  | "Documentos pessoais"
  | "Contrato"
  | "Bilhetes"
  | "Vistos"
  | "Seguros"
  | "Hospedagem"
  | "Vouchers"
  | "Outros";

export type ArquivoRow = {
  id: string;
  expedicao_id: string;
  passageiro_id: string | null;
  categoria: CategoriaArquivo;
  nome: string;
  descricao: string | null;
  mime: string | null;
  tamanho_bytes: number | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GrupoExpedicaoRow = {
  id: string;
  expedicao_id: string;
  nome: string;
  data_embarque: string | null;
  data_retorno: string | null;
  pax_planejados: number;
  observacoes: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export type QuartoRow = {
  id: string;
  expedicao_id: string;
  numero: string;
  tipo: TipoQuarto;
  hotel_cidade: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

/** Alocação muitos-para-muitos: um passageiro pode ter um quarto por hotel/trecho. */
export type AlocacaoQuartoRow = {
  id: string;
  passageiro_id: string;
  quarto_id: string;
  created_at: string;
}

export type CustoRow = {
  id: string;
  expedicao_id: string;
  categoria: CategoriaCusto;
  servico: string;
  fornecedor_id: string | null;
  cidade: string | null;
  data_servico: string | null;
  moeda: string;
  valor_planejado: number;
  valor_realizado: number | null;
  cambio_aplicado: number | null;
  valor_planejado_brl: number;
  valor_realizado_brl: number | null;
  status: StatusCusto;
  pago_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type PagamentoRow = {
  id: string;
  custo_id: string;
  fornecedor_id: string | null;
  servico: string;
  moeda: string;
  valor_total: number;
  entrada: number;
  saldo: number;
  vencimento_saldo: string | null;
  status: StatusPagamento;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type ChecklistItemRow = {
  id: string;
  expedicao_id: string;
  etapa: EtapaChecklist;
  tarefa: string;
  responsavel_id: string | null;
  status: StatusChecklist;
  prazo: string | null;
  prioridade: Prioridade;
  dependencia_id: string | null;
  parent_id: string | null; // subtarefa: aponta pro item pai
  ordem: number; // ordem dentro da fase (ou dentro do pai)
  evidencia_url: string | null;
  bitrix_task_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type LinkExpedicaoRow = {
  id: string;
  expedicao_id: string;
  label: string;
  url: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export type DocumentoRow = {
  id: string;
  passageiro_id: string;
  visto_necessario: boolean;
  status_visto: string;
  seguro_status: string;
  apolice_url: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLogRow = {
  id: string;
  tabela: string;
  registro_id: string;
  usuario_id: string | null;
  acao: "insert" | "update" | "delete";
  dados_antes: Json | null;
  dados_depois: Json | null;
  origem: string | null;
  created_at: string;
}

// ========== Database shape (formato esperado pelo @supabase/supabase-js) ==========

export type Database = {
  public: {
    Tables: {
      usuarios: { Row: UsuarioRow; Insert: Partial<UsuarioRow> & Pick<UsuarioRow, "id" | "email" | "nome">; Update: Partial<UsuarioRow> };
      fornecedores: { Row: FornecedorRow; Insert: Partial<FornecedorRow> & Pick<FornecedorRow, "nome" | "tipo">; Update: Partial<FornecedorRow> };
      cambios: { Row: CambioRow; Insert: { moeda: string; taxa_brl: number; atualizado_em?: string }; Update: Partial<CambioRow> };
      expedicoes: { Row: ExpedicaoRow; Insert: Partial<ExpedicaoRow> & Pick<ExpedicaoRow, "codigo" | "nome" | "destino" | "data_embarque" | "data_retorno">; Update: Partial<ExpedicaoRow> };
      passageiros: { Row: PassageiroRow; Insert: Partial<PassageiroRow> & Pick<PassageiroRow, "nome_completo">; Update: Partial<PassageiroRow> };
      grupos_expedicao: { Row: GrupoExpedicaoRow; Insert: Partial<GrupoExpedicaoRow> & Pick<GrupoExpedicaoRow, "expedicao_id" | "nome">; Update: Partial<GrupoExpedicaoRow> };
      arquivos: { Row: ArquivoRow; Insert: Partial<ArquivoRow> & Pick<ArquivoRow, "expedicao_id" | "nome" | "storage_path">; Update: Partial<ArquivoRow> };
      quartos: { Row: QuartoRow; Insert: Partial<QuartoRow> & Pick<QuartoRow, "expedicao_id" | "numero" | "tipo">; Update: Partial<QuartoRow> };
      passageiro_quarto: { Row: AlocacaoQuartoRow; Insert: Partial<AlocacaoQuartoRow> & Pick<AlocacaoQuartoRow, "passageiro_id" | "quarto_id">; Update: Partial<AlocacaoQuartoRow> };
      custos: { Row: CustoRow; Insert: Partial<CustoRow> & Pick<CustoRow, "expedicao_id" | "categoria" | "servico" | "moeda" | "valor_planejado">; Update: Partial<CustoRow> };
      pagamentos: { Row: PagamentoRow; Insert: Partial<PagamentoRow> & Pick<PagamentoRow, "custo_id" | "servico" | "moeda" | "valor_total">; Update: Partial<PagamentoRow> };
      checklist_itens: { Row: ChecklistItemRow; Insert: Partial<ChecklistItemRow> & Pick<ChecklistItemRow, "expedicao_id" | "etapa" | "tarefa">; Update: Partial<ChecklistItemRow> };
      documentos: { Row: DocumentoRow; Insert: Partial<DocumentoRow> & Pick<DocumentoRow, "passageiro_id">; Update: Partial<DocumentoRow> };
      links_expedicao: { Row: LinkExpedicaoRow; Insert: Partial<LinkExpedicaoRow> & Pick<LinkExpedicaoRow, "expedicao_id" | "label" | "url">; Update: Partial<LinkExpedicaoRow> };
      requisitos_destino: { Row: RequisitoDestinoRow; Insert: Partial<RequisitoDestinoRow> & Pick<RequisitoDestinoRow, "destino" | "tipo" | "descricao">; Update: Partial<RequisitoDestinoRow> };
      passageiro_requisitos: { Row: PassageiroRequisitoRow; Insert: Partial<PassageiroRequisitoRow> & Pick<PassageiroRequisitoRow, "passageiro_id" | "tipo" | "descricao">; Update: Partial<PassageiroRequisitoRow> };
      audit_log: { Row: AuditLogRow; Insert: Partial<AuditLogRow> & Pick<AuditLogRow, "tabela" | "registro_id" | "acao">; Update: Partial<AuditLogRow> };
    };
    Views: {
      vw_prontidao_passageiro: { Row: ProntidaoPassageiroView };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TableUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Tipos enriquecidos pra UI (com agregados)
export type ExpedicaoComAgregados = ExpedicaoRow & {
  pax_confirmados: number;
  docs_pendentes: number;
  /** Fração (0..1) dos processos do checklist concluídos. */
  checklist_pct: number;
  /** Passageiros aptos a embarcar / total avaliado (não cancelados). */
  prontidao_aptos: number;
  prontidao_total: number;
  responsavel_op_nome: string | null;
  responsavel_com_nome: string | null;
};
