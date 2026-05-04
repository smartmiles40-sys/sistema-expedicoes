export const MARGEM_MINIMA = 0.20;
export const MARGEM_IDEAL = 0.30;
export const PROVISAO_EXTRA_PADRAO = 0.05;

export const STATUS_EXPEDICAO = [
  "Planejamento",
  "Vendas Abertas",
  "Em andamento",
  "Concluída",
  "Cancelada",
] as const;
export type StatusExpedicao = (typeof STATUS_EXPEDICAO)[number];

export const STATUS_RESERVA = [
  "Lead",
  "Pré-reserva",
  "Confirmado",
  "Cancelado",
] as const;
export type StatusReserva = (typeof STATUS_RESERVA)[number];

export const TIPO_PASSAGEIRO = ["Pagante", "Cortesia", "Líder"] as const;
export type TipoPassageiro = (typeof TIPO_PASSAGEIRO)[number];

export const TIPO_FORNECEDOR = [
  "DMC",
  "Hotel",
  "Guia",
  "Aéreo",
  "Receptivo",
  "Seguro",
  "Outros",
] as const;
export type TipoFornecedor = (typeof TIPO_FORNECEDOR)[number];

export const CATEGORIA_CUSTO = [
  "Hotelaria",
  "Aéreo",
  "Terrestre",
  "Ingressos",
  "Guias",
  "Seguro",
  "Taxas",
  "Brindes",
  "Outros",
] as const;
export type CategoriaCusto = (typeof CATEGORIA_CUSTO)[number];

export const STATUS_CUSTO = [
  "A programar",
  "Programado",
  "Pago",
  "Parcial",
  "Vencido",
] as const;
export type StatusCusto = (typeof STATUS_CUSTO)[number];

export const STATUS_PAGAMENTO = [
  "Pendente",
  "Programado",
  "Pago",
  "Parcial",
  "Vencido",
  "Cancelado",
] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

export const ETAPA_CHECKLIST = [
  "Pós-venda",
  "Pré-viagem",
  "Operação",
  "Pós-viagem",
] as const;
export type EtapaChecklist = (typeof ETAPA_CHECKLIST)[number];

export const STATUS_CHECKLIST = [
  "Pendente",
  "Em andamento",
  "Atenção",
  "Concluído",
  "Bloqueado",
] as const;
export type StatusChecklist = (typeof STATUS_CHECKLIST)[number];

export const PRIORIDADE = ["Baixa", "Média", "Alta", "Crítica"] as const;
export type Prioridade = (typeof PRIORIDADE)[number];

export const TIPO_QUARTO = [
  "Single",
  "Duplo",
  "Twin",
  "Triplo",
  "Compartilhado",
  "Líder",
] as const;
export type TipoQuarto = (typeof TIPO_QUARTO)[number];

export const PAPEL_USUARIO = [
  "admin",
  "operacional",
  "comercial",
  "financeiro",
  "leitura",
] as const;
export type PapelUsuario = (typeof PAPEL_USUARIO)[number];

export const MOEDAS = ["BRL", "USD", "EUR", "PEN", "GBP", "JPY", "ARS", "CLP"] as const;
export type Moeda = (typeof MOEDAS)[number];

export const STATUS_FORNECEDOR = ["Ativo", "Pausado", "Bloqueado"] as const;
export type StatusFornecedor = (typeof STATUS_FORNECEDOR)[number];

export const STATUS_VISTO = ["Não necessário", "A solicitar", "Em análise", "Aprovado", "Negado"] as const;
export const STATUS_SEGURO = ["Pendente", "Solicitado", "Emitido"] as const;
