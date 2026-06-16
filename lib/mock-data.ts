/**
 * Mock fixtures pra rodar o app sem Supabase.
 * Estrutura espelha o schema (db/migrations/0001_initial_schema.sql).
 */
import type {
  Tables,
  ExpedicaoComAgregados,
  EtapaChecklist,
} from "@/types/database";
import fs from "node:fs";
import path from "node:path";
import { construirChecklistPadrao } from "@/lib/processos/template";
import { construirRequisitosDestino } from "@/lib/prontidao/requisitos-destino";
import { construirRequisitosPadrao } from "@/lib/prontidao/template";
import {
  parseCSV,
  parsePassageirosCSV,
  normalizarData,
  parseNumeroBR,
  type DadosImport,
} from "@/lib/csv/passageiros-import";

const today = new Date();
const iso = (d: Date) => d.toISOString();
const futureDate = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return iso(d);
};
const pastDate = (days: number) => futureDate(-days);

export const mockUsuarios: Tables<"usuarios">[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    email: "smartmiles4.0@gmail.com",
    nome: "Bruno Oliveira",
    papel: "admin",
    avatar_url: null,
    created_at: pastDate(120),
    updated_at: pastDate(1),
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    email: "ana.op@setur.com",
    nome: "Ana Costa",
    papel: "operacional",
    avatar_url: null,
    created_at: pastDate(100),
    updated_at: pastDate(1),
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    email: "carlos.com@setur.com",
    nome: "Carlos Mendes",
    papel: "comercial",
    avatar_url: null,
    created_at: pastDate(90),
    updated_at: pastDate(1),
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    email: "fin@setur.com",
    nome: "Juliana Lima",
    papel: "financeiro",
    avatar_url: null,
    created_at: pastDate(80),
    updated_at: pastDate(1),
  },
];

export const mockFornecedores: Tables<"fornecedores">[] = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    nome: "Andean DMC",
    tipo: "DMC",
    contato_nome: "Diego Quispe",
    contato_email: "diego@andeandmc.pe",
    contato_whatsapp: "+51 984 123 456",
    destino_cidade: "Cusco",
    servicos: ["Trekking", "Hotelaria", "Transfers"],
    moeda_padrao: "USD",
    politica_pagamento: "30% sinal, 70% até 30 dias antes",
    status: "Ativo",
    observacoes: null,
    created_at: pastDate(200),
    updated_at: pastDate(5),
  },
  {
    id: "f0000000-0000-0000-0000-000000000002",
    nome: "Patagonia Wild",
    tipo: "DMC",
    contato_nome: "Sofía Gómez",
    contato_email: "sofia@patagoniawild.ar",
    contato_whatsapp: "+54 9 11 6543 2100",
    destino_cidade: "El Calafate",
    servicos: ["Glaciar", "Trekking", "Hotelaria"],
    moeda_padrao: "USD",
    politica_pagamento: "50% sinal, 50% no check-in",
    status: "Ativo",
    observacoes: null,
    created_at: pastDate(180),
    updated_at: pastDate(10),
  },
  {
    id: "f0000000-0000-0000-0000-000000000003",
    nome: "Hotel Casa Andina",
    tipo: "Hotel",
    contato_nome: "Reservas",
    contato_email: "reservas@casaandina.com",
    contato_whatsapp: null,
    destino_cidade: "Cusco",
    servicos: ["Hospedagem"],
    moeda_padrao: "USD",
    politica_pagamento: "Pré-pagamento 100% 7 dias antes",
    status: "Ativo",
    observacoes: null,
    created_at: pastDate(150),
    updated_at: pastDate(2),
  },
  {
    id: "f0000000-0000-0000-0000-000000000004",
    nome: "LATAM Airlines",
    tipo: "Aéreo",
    contato_nome: "Conta corporativa",
    contato_email: "corporate@latam.com",
    contato_whatsapp: null,
    destino_cidade: null,
    servicos: ["Aéreo internacional"],
    moeda_padrao: "BRL",
    politica_pagamento: "Faturamento 30 dias",
    status: "Ativo",
    observacoes: null,
    created_at: pastDate(300),
    updated_at: pastDate(7),
  },
  {
    id: "f0000000-0000-0000-0000-000000000005",
    nome: "Travel Ace Seguros",
    tipo: "Seguro",
    contato_nome: "Atendimento corporativo",
    contato_email: "corp@travelace.com.br",
    contato_whatsapp: "+55 11 4002-8922",
    destino_cidade: null,
    servicos: ["Seguro viagem"],
    moeda_padrao: "BRL",
    politica_pagamento: "Faturado por embarque",
    status: "Ativo",
    observacoes: null,
    created_at: pastDate(250),
    updated_at: pastDate(3),
  },
];

export const mockCambios: Tables<"cambios">[] = [
  { moeda: "USD", taxa_brl: 5.20, atualizado_em: pastDate(1) },
  { moeda: "EUR", taxa_brl: 5.60, atualizado_em: pastDate(1) },
  { moeda: "PEN", taxa_brl: 1.40, atualizado_em: pastDate(1) },
  { moeda: "GBP", taxa_brl: 6.55, atualizado_em: pastDate(1) },
  { moeda: "JPY", taxa_brl: 0.035, atualizado_em: pastDate(1) },
  { moeda: "ARS", taxa_brl: 0.005, atualizado_em: pastDate(1) },
  { moeda: "CLP", taxa_brl: 0.0055, atualizado_em: pastDate(1) },
  { moeda: "BRL", taxa_brl: 1.0, atualizado_em: pastDate(1) },
];

export const mockExpedicoes: Tables<"expedicoes">[] = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    codigo: "PERU-AGO2026",
    nome: "Peru – Caminho Inca Ago 2026",
    destino: "Peru",
    data_embarque: futureDate(95),
    data_retorno: futureDate(105),
    responsavel_operacional_id: "00000000-0000-0000-0000-000000000002",
    responsavel_comercial_id: "00000000-0000-0000-0000-000000000003",
    dmc_principal_id: "f0000000-0000-0000-0000-000000000001",
    status: "Vendas Abertas",
    pax_planejados: 24,
    pax_cortesia: 2,
    preco_venda_brl: 18900,
    bitrix_pipeline_id: "PIPE-001",
    ordem: 1,
    observacoes: "Grupo + Trekking 4 dias.",
    created_at: pastDate(60),
    updated_at: pastDate(2),
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    codigo: "PATAG-NOV2026",
    nome: "Patagônia – Glaciares Nov 2026",
    destino: "Argentina",
    data_embarque: futureDate(180),
    data_retorno: futureDate(189),
    responsavel_operacional_id: "00000000-0000-0000-0000-000000000002",
    responsavel_comercial_id: "00000000-0000-0000-0000-000000000003",
    dmc_principal_id: "f0000000-0000-0000-0000-000000000002",
    status: "Vendas Abertas",
    pax_planejados: 20,
    pax_cortesia: 1,
    preco_venda_brl: 22500,
    bitrix_pipeline_id: "PIPE-002",
    ordem: 2,
    observacoes: null,
    created_at: pastDate(50),
    updated_at: pastDate(5),
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    codigo: "JAPAO-MAR2027",
    nome: "Japão – Cerejeiras Mar 2027",
    destino: "Japão",
    data_embarque: futureDate(305),
    data_retorno: futureDate(320),
    responsavel_operacional_id: "00000000-0000-0000-0000-000000000002",
    responsavel_comercial_id: "00000000-0000-0000-0000-000000000003",
    dmc_principal_id: null,
    status: "Planejamento",
    pax_planejados: 18,
    pax_cortesia: 1,
    preco_venda_brl: 38900,
    bitrix_pipeline_id: "PIPE-003",
    ordem: 3,
    observacoes: null,
    created_at: pastDate(20),
    updated_at: pastDate(1),
  },
  {
    id: "e0000000-0000-0000-0000-000000000004",
    codigo: "EGITO-OUT2026",
    nome: "Egito – Pirâmides e Nilo Out 2026",
    destino: "Egito",
    data_embarque: futureDate(150),
    data_retorno: futureDate(160),
    responsavel_operacional_id: "00000000-0000-0000-0000-000000000002",
    responsavel_comercial_id: "00000000-0000-0000-0000-000000000003",
    dmc_principal_id: null,
    status: "Em andamento",
    pax_planejados: 22,
    pax_cortesia: 2,
    preco_venda_brl: 27800,
    bitrix_pipeline_id: "PIPE-004",
    ordem: 4,
    observacoes: "DMC sendo selecionado.",
    created_at: pastDate(40),
    updated_at: pastDate(7),
  },
  {
    id: "e0000000-0000-0000-0000-000000000005",
    codigo: "JAPAO-OUT2026",
    nome: "Japão – Out 2026",
    destino: "Japão",
    data_embarque: "2026-10-26T12:00:00.000Z",
    data_retorno: "2026-11-12T12:00:00.000Z",
    responsavel_operacional_id: "00000000-0000-0000-0000-000000000002",
    responsavel_comercial_id: "00000000-0000-0000-0000-000000000003",
    dmc_principal_id: null,
    status: "Planejamento",
    pax_planejados: 18,
    pax_cortesia: 1,
    preco_venda_brl: 38900,
    bitrix_pipeline_id: "PIPE-005",
    ordem: 5,
    observacoes: null,
    created_at: iso(today),
    updated_at: iso(today),
  },
  {
    id: "e0000000-0000-0000-0000-000000000006",
    codigo: "PERU-AGO26",
    nome: "Peru – Ago 2026",
    destino: "Peru",
    data_embarque: "2026-08-22T12:00:00.000Z",
    data_retorno: "2026-08-30T12:00:00.000Z",
    responsavel_operacional_id: "00000000-0000-0000-0000-000000000002",
    responsavel_comercial_id: "00000000-0000-0000-0000-000000000003",
    dmc_principal_id: null,
    status: "Em andamento",
    pax_planejados: 9,
    pax_cortesia: 0,
    preco_venda_brl: 0,
    bitrix_pipeline_id: null,
    ordem: 6,
    observacoes: "Machu Picchu, cultura inca e gastronomia premiada. 9 dias · edição encerrada (vendas fechadas).",
    created_at: iso(today),
    updated_at: iso(today),
  },
];

/**
 * Campos do passageiro anteriores à migration 0010 (financeiro + dados de
 * embarque entram via normalização logo abaixo, pra não repetir em 12 literais).
 */
type PassageiroBase = Omit<
  Tables<"passageiros">,
  | "valor_contratado_brl"
  | "valor_pago_brl"
  | "saldo_brl"
  | "status_financeiro"
  | "contato_emergencia_nome"
  | "contato_emergencia_fone"
  | "restricoes_alimentares"
  | "condicoes_medicas"
  | "contrato_assinado"
  | "checkin_online_feito"
>;

const passageirosBase: PassageiroBase[] = [
  // Peru
  { id: "p0000001", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000001", bitrix_contact_id: "BX-1001", bitrix_deal_id: "BX-D-1001", nome_completo: "Mariana Silva", tipo: "Pagante", cpf: "111.222.333-44", passaporte: "FA123456", data_nascimento: "1988-03-12", validade_passaporte: futureDate(800), email: "mari@gmail.com", telefone: "+55 11 99999-1111", status_reserva: "Confirmado", voo_nacional_necessario: true, companhia_aerea: "LATAM", localizador: "ABC123", quarto_id: null, observacoes: null, created_at: pastDate(50), updated_at: pastDate(2) },
  { id: "p0000002", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000001", bitrix_contact_id: "BX-1002", bitrix_deal_id: "BX-D-1002", nome_completo: "João Pereira", tipo: "Pagante", cpf: "222.333.444-55", passaporte: "FB234567", data_nascimento: "1990-07-22", validade_passaporte: futureDate(120), email: "jp@gmail.com", telefone: "+55 11 98888-2222", status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: "Vegetariano", created_at: pastDate(48), updated_at: pastDate(2) },
  { id: "p0000003", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000001", bitrix_contact_id: "BX-1003", bitrix_deal_id: "BX-D-1003", nome_completo: "Letícia Souza", tipo: "Pagante", cpf: "333.444.555-66", passaporte: null, data_nascimento: "1985-11-30", validade_passaporte: null, email: "le@gmail.com", telefone: "+55 21 97777-3333", status_reserva: "Pré-reserva", voo_nacional_necessario: true, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: pastDate(40), updated_at: pastDate(3) },
  { id: "p0000004", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000001", bitrix_contact_id: "BX-1004", bitrix_deal_id: "BX-D-1004", nome_completo: "Rafael Tonin", tipo: "Pagante", cpf: "444.555.666-77", passaporte: "FC345678", data_nascimento: "1992-05-18", validade_passaporte: futureDate(60), email: "rafa@gmail.com", telefone: "+55 11 95555-4444", status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: "LATAM", localizador: "DEF456", quarto_id: null, observacoes: null, created_at: pastDate(35), updated_at: pastDate(2) },
  { id: "p0000005", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000001", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Ana Costa", tipo: "Líder", cpf: "555.666.777-88", passaporte: "FD456789", data_nascimento: "1987-09-08", validade_passaporte: futureDate(900), email: "ana.op@setur.com", telefone: "+55 11 94444-5555", status_reserva: "Confirmado", voo_nacional_necessario: true, companhia_aerea: "LATAM", localizador: "GHI789", quarto_id: null, observacoes: "Líder do grupo", created_at: pastDate(60), updated_at: pastDate(1) },
  // Patagônia
  { id: "p0000006", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000002", bitrix_contact_id: "BX-2001", bitrix_deal_id: "BX-D-2001", nome_completo: "Camila Rocha", tipo: "Pagante", cpf: "666.777.888-99", passaporte: "FE567890", data_nascimento: "1991-02-14", validade_passaporte: futureDate(700), email: "ca@gmail.com", telefone: "+55 11 93333-6666", status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: pastDate(45), updated_at: pastDate(5) },
  { id: "p0000007", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000002", bitrix_contact_id: "BX-2002", bitrix_deal_id: "BX-D-2002", nome_completo: "Fernando Lima", tipo: "Pagante", cpf: "777.888.999-00", passaporte: "FF678901", data_nascimento: "1983-12-03", validade_passaporte: futureDate(500), email: "fer@gmail.com", telefone: "+55 11 92222-7777", status_reserva: "Lead", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: pastDate(20), updated_at: pastDate(2) },
  { id: "p0000008", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000002", bitrix_contact_id: "BX-2003", bitrix_deal_id: "BX-D-2003", nome_completo: "Patrícia Nunes", tipo: "Pagante", cpf: "888.999.000-11", passaporte: null, data_nascimento: "1989-06-25", validade_passaporte: null, email: "pa@gmail.com", telefone: "+55 11 91111-8888", status_reserva: "Pré-reserva", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: pastDate(18), updated_at: pastDate(3) },
  // Japão
  { id: "p0000009", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000003", bitrix_contact_id: "BX-3001", bitrix_deal_id: "BX-D-3001", nome_completo: "Marcos Tavares", tipo: "Pagante", cpf: "999.000.111-22", passaporte: "FG789012", data_nascimento: "1980-04-09", validade_passaporte: futureDate(1200), email: "ma@gmail.com", telefone: "+55 11 90000-9999", status_reserva: "Confirmado", voo_nacional_necessario: true, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: pastDate(15), updated_at: pastDate(1) },
  { id: "p0000010", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000003", bitrix_contact_id: "BX-3002", bitrix_deal_id: "BX-D-3002", nome_completo: "Bianca Andrade", tipo: "Pagante", cpf: "000.111.222-33", passaporte: null, data_nascimento: "1995-08-17", validade_passaporte: null, email: "bi@gmail.com", telefone: "+55 11 99876-5432", status_reserva: "Lead", voo_nacional_necessario: true, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: pastDate(8), updated_at: pastDate(1) },
  // Egito
  { id: "p0000011", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000004", bitrix_contact_id: "BX-4001", bitrix_deal_id: "BX-D-4001", nome_completo: "Roberto Carvalho", tipo: "Pagante", cpf: "111.000.222-44", passaporte: "FH890123", data_nascimento: "1978-01-19", validade_passaporte: futureDate(300), email: "ro@gmail.com", telefone: "+55 11 98765-1234", status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: "Emirates", localizador: "EM4001", quarto_id: null, observacoes: null, created_at: pastDate(35), updated_at: pastDate(7) },
  { id: "p0000012", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000004", bitrix_contact_id: "BX-4002", bitrix_deal_id: "BX-D-4002", nome_completo: "Helena Castro", tipo: "Pagante", cpf: "222.111.333-55", passaporte: "FI901234", data_nascimento: "1986-10-05", validade_passaporte: futureDate(400), email: "he@gmail.com", telefone: "+55 11 91234-5678", status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: "Emirates", localizador: "EM4002", quarto_id: null, observacoes: null, created_at: pastDate(33), updated_at: pastDate(7) },
  // Mariana Silva (mesmo CPF de p0000001) também na Patagônia — demonstra a
  // consolidação por pessoa: ela aparece como 1 pessoa com 2 expedições.
  { id: "p0000013", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000002", bitrix_contact_id: "BX-1001", bitrix_deal_id: "BX-D-2099", nome_completo: "Mariana Silva", tipo: "Pagante", cpf: "111.222.333-44", passaporte: "FA123456", data_nascimento: "1988-03-12", validade_passaporte: futureDate(800), email: "mari@gmail.com", telefone: "+55 11 99999-1111", status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: "Expedicionária recorrente", created_at: pastDate(25), updated_at: pastDate(3) },
  // Peru – Grupo (e...006). "Total" da planilha = tamanho da reserva; titular cadastrado aqui.
  { id: "p0000101", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Alynne Moura Maglioni Monti", tipo: "Pagante", cpf: "103.640.356-41", passaporte: "FW614529", data_nascimento: "1992-07-21", validade_passaporte: "2028-07-31", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000103", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Cristina Martini", tipo: "Pagante", cpf: "070.600.879-07", passaporte: "GM358823", data_nascimento: "1989-11-14", validade_passaporte: "2035-08-31", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000104", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Eduardo Regis Coroa Vasconcelos", tipo: "Pagante", cpf: "022.060.842-36", passaporte: "GG280125", data_nascimento: "1992-05-29", validade_passaporte: "2033-02-23", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000105", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Georgia Freitas Café", tipo: "Pagante", cpf: "058.459.213-25", passaporte: "FX579723", data_nascimento: "1998-02-20", validade_passaporte: "2028-11-29", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000107", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Jéssica de Andrade Freitas", tipo: "Pagante", cpf: "117.627.436-80", passaporte: "GN029292", data_nascimento: "1995-05-27", validade_passaporte: "2035-11-25", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000108", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Maria Aparecida Queirós de Sousa", tipo: "Pagante", cpf: "035.777.863-45", passaporte: null, data_nascimento: "1989-01-20", validade_passaporte: null, email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000109", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Maria Tais Claudino de Almeida", tipo: "Pagante", cpf: "031.689.813-97", passaporte: "GF958696", data_nascimento: "1992-05-29", validade_passaporte: "2033-01-15", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000110", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Matthäus Gondim Muniz", tipo: "Pagante", cpf: "008.937.093-79", passaporte: "FX579722", data_nascimento: "1991-08-13", validade_passaporte: "2028-11-29", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
  { id: "p0000111", grupo_id: null, expedicao_id:"e0000000-0000-0000-0000-000000000006", bitrix_contact_id: null, bitrix_deal_id: null, nome_completo: "Paula Viana Egypto", tipo: "Pagante", cpf: "016.016.133-93", passaporte: "GJ716623", data_nascimento: "1985-11-03", validade_passaporte: "2034-07-09", email: null, telefone: null, status_reserva: "Confirmado", voo_nacional_necessario: false, companhia_aerea: null, localizador: null, quarto_id: null, observacoes: null, created_at: iso(today), updated_at: iso(today) },
];

/**
 * Dados financeiros/pessoais (0010) de demo por passageiro. O que não estiver
 * aqui herda os defaults — saldo zerado, sem contrato/check-in. A variedade
 * abaixo cobre os três estados do semáforo de prontidão.
 */
type PassageiroExtra = Pick<
  Tables<"passageiros">,
  | "valor_contratado_brl"
  | "valor_pago_brl"
  | "status_financeiro"
  | "contato_emergencia_nome"
  | "contato_emergencia_fone"
  | "restricoes_alimentares"
  | "condicoes_medicas"
  | "contrato_assinado"
  | "checkin_online_feito"
>;

const extrasPorPassageiro: Record<string, Partial<PassageiroExtra>> = {
  // Peru — Mariana: tudo quitado e assinado (candidata a Apto)
  p0000001: { valor_contratado_brl: 18900, valor_pago_brl: 18900, status_financeiro: "Quitado", contrato_assinado: true, checkin_online_feito: true, contato_emergencia_nome: "Paulo Silva", contato_emergencia_fone: "+55 11 99999-0001" },
  // João: saldo em aberto + restrição alimentar (Atenção)
  p0000002: { valor_contratado_brl: 18900, valor_pago_brl: 9450, status_financeiro: "Em aberto", contrato_assinado: true, restricoes_alimentares: "Vegetariano" },
  // Letícia: sem passaporte e parcela em aberto (Bloqueado via requisito)
  p0000003: { valor_contratado_brl: 18900, valor_pago_brl: 6300, status_financeiro: "Em aberto" },
  // Rafael: passaporte vence ANTES do retorno (Bloqueado), mas pago
  p0000004: { valor_contratado_brl: 18900, valor_pago_brl: 18900, status_financeiro: "Quitado", contrato_assinado: true },
  // Ana (líder): cortesia, sem cobrança
  p0000005: { valor_contratado_brl: 0, valor_pago_brl: 0, status_financeiro: "Cortesia", contrato_assinado: true, checkin_online_feito: true },
  // Patagônia
  p0000006: { valor_contratado_brl: 22500, valor_pago_brl: 22500, status_financeiro: "Quitado", contrato_assinado: true },
  p0000013: { valor_contratado_brl: 22500, valor_pago_brl: 22500, status_financeiro: "Quitado", contrato_assinado: true },
  p0000007: { valor_contratado_brl: 22500, valor_pago_brl: 0, status_financeiro: "Em aberto" },
  p0000008: { valor_contratado_brl: 22500, valor_pago_brl: 11250, status_financeiro: "Em aberto" },
  // Egito — Roberto: condição médica relevante pro embarque
  p0000011: { valor_contratado_brl: 27800, valor_pago_brl: 27800, status_financeiro: "Quitado", contrato_assinado: true, condicoes_medicas: "Hipertensão — leva medicação" },
  p0000012: { valor_contratado_brl: 27800, valor_pago_brl: 13900, status_financeiro: "Em aberto" },
};

function normalizarPassageiro(p: PassageiroBase): Tables<"passageiros"> {
  const extra = extrasPorPassageiro[p.id] ?? {};
  const valor_contratado_brl = extra.valor_contratado_brl ?? 0;
  const valor_pago_brl = extra.valor_pago_brl ?? 0;
  return {
    ...p,
    valor_contratado_brl,
    valor_pago_brl,
    saldo_brl: valor_contratado_brl - valor_pago_brl, // espelha a coluna gerada
    status_financeiro: extra.status_financeiro ?? "Em aberto",
    contato_emergencia_nome: extra.contato_emergencia_nome ?? null,
    contato_emergencia_fone: extra.contato_emergencia_fone ?? null,
    restricoes_alimentares: extra.restricoes_alimentares ?? null,
    condicoes_medicas: extra.condicoes_medicas ?? null,
    contrato_assinado: extra.contrato_assinado ?? false,
    checkin_online_feito: extra.checkin_online_feito ?? false,
  };
}

export const mockPassageiros: Tables<"passageiros">[] =
  passageirosBase.map(normalizarPassageiro);

export const mockQuartos: Tables<"quartos">[] = [
  { id: "q001", expedicao_id: "e0000000-0000-0000-0000-000000000001", numero: "101", tipo: "Duplo", hotel_cidade: "Cusco", check_in: futureDate(95), check_out: futureDate(98), status: "Reservado", observacoes: null, created_at: pastDate(30), updated_at: pastDate(2) },
  { id: "q002", expedicao_id: "e0000000-0000-0000-0000-000000000001", numero: "102", tipo: "Twin", hotel_cidade: "Cusco", check_in: futureDate(95), check_out: futureDate(98), status: "Reservado", observacoes: null, created_at: pastDate(30), updated_at: pastDate(2) },
  { id: "q003", expedicao_id: "e0000000-0000-0000-0000-000000000001", numero: "103", tipo: "Triplo", hotel_cidade: "Cusco", check_in: futureDate(95), check_out: futureDate(98), status: "Reservado", observacoes: null, created_at: pastDate(30), updated_at: pastDate(2) },
  { id: "q004", expedicao_id: "e0000000-0000-0000-0000-000000000001", numero: "201", tipo: "Líder", hotel_cidade: "Cusco", check_in: futureDate(95), check_out: futureDate(98), status: "Reservado", observacoes: null, created_at: pastDate(30), updated_at: pastDate(2) },
];

export const mockCustos: Tables<"custos">[] = [
  { id: "c0001", expedicao_id: "e0000000-0000-0000-0000-000000000001", categoria: "Hotelaria", servico: "Hospedagem Cusco 3 noites", fornecedor_id: "f0000000-0000-0000-0000-000000000003", cidade: "Cusco", data_servico: futureDate(95), moeda: "USD", valor_planejado: 5200, valor_realizado: 5350, cambio_aplicado: 5.20, valor_planejado_brl: 27040, valor_realizado_brl: 27820, status: "Programado", pago_por: null, observacoes: null, created_at: pastDate(40), updated_at: pastDate(5) },
  { id: "c0002", expedicao_id: "e0000000-0000-0000-0000-000000000001", categoria: "Aéreo", servico: "Voo internacional GRU-LIM", fornecedor_id: "f0000000-0000-0000-0000-000000000004", cidade: null, data_servico: futureDate(95), moeda: "BRL", valor_planejado: 96000, valor_realizado: null, cambio_aplicado: 1.0, valor_planejado_brl: 96000, valor_realizado_brl: null, status: "A programar", pago_por: null, observacoes: null, created_at: pastDate(38), updated_at: pastDate(5) },
  { id: "c0003", expedicao_id: "e0000000-0000-0000-0000-000000000001", categoria: "Terrestre", servico: "Trekking Caminho Inca 4d", fornecedor_id: "f0000000-0000-0000-0000-000000000001", cidade: "Cusco", data_servico: futureDate(98), moeda: "USD", valor_planejado: 14400, valor_realizado: null, cambio_aplicado: 5.20, valor_planejado_brl: 74880, valor_realizado_brl: null, status: "Programado", pago_por: null, observacoes: null, created_at: pastDate(38), updated_at: pastDate(5) },
  { id: "c0004", expedicao_id: "e0000000-0000-0000-0000-000000000001", categoria: "Ingressos", servico: "Machu Picchu", fornecedor_id: "f0000000-0000-0000-0000-000000000001", cidade: "Aguas Calientes", data_servico: futureDate(101), moeda: "USD", valor_planejado: 1200, valor_realizado: null, cambio_aplicado: 5.20, valor_planejado_brl: 6240, valor_realizado_brl: null, status: "A programar", pago_por: null, observacoes: null, created_at: pastDate(30), updated_at: pastDate(5) },
  { id: "c0005", expedicao_id: "e0000000-0000-0000-0000-000000000001", categoria: "Seguro", servico: "Seguro Viagem grupo 24 pax", fornecedor_id: "f0000000-0000-0000-0000-000000000005", cidade: null, data_servico: futureDate(95), moeda: "BRL", valor_planejado: 4800, valor_realizado: null, cambio_aplicado: 1.0, valor_planejado_brl: 4800, valor_realizado_brl: null, status: "A programar", pago_por: null, observacoes: null, created_at: pastDate(25), updated_at: pastDate(5) },
];

export const mockPagamentos: Tables<"pagamentos">[] = [
  { id: "pg001", custo_id: "c0001", fornecedor_id: "f0000000-0000-0000-0000-000000000003", servico: "Hospedagem Cusco — sinal", moeda: "USD", valor_total: 5200, entrada: 1560, saldo: 3640, vencimento_saldo: futureDate(60), status: "Programado", observacoes: "30% sinal pago em 15/03", created_at: pastDate(15), updated_at: pastDate(15) },
  { id: "pg002", custo_id: "c0002", fornecedor_id: "f0000000-0000-0000-0000-000000000004", servico: "Voo internacional", moeda: "BRL", valor_total: 96000, entrada: 0, saldo: 96000, vencimento_saldo: futureDate(45), status: "Pendente", observacoes: null, created_at: pastDate(10), updated_at: pastDate(10) },
  { id: "pg003", custo_id: "c0003", fornecedor_id: "f0000000-0000-0000-0000-000000000001", servico: "Trekking — sinal", moeda: "USD", valor_total: 14400, entrada: 4320, saldo: 10080, vencimento_saldo: pastDate(2), status: "Vencido", observacoes: "Atenção: vencido", created_at: pastDate(20), updated_at: pastDate(2) },
  { id: "pg004", custo_id: "c0004", fornecedor_id: "f0000000-0000-0000-0000-000000000001", servico: "Ingressos Machu Picchu", moeda: "USD", valor_total: 1200, entrada: 0, saldo: 1200, vencimento_saldo: futureDate(80), status: "Pendente", observacoes: null, created_at: pastDate(8), updated_at: pastDate(8) },
];

// Checklist da expedição Peru = os 31 processos reais do SOP (ClickUp),
// gerados a partir do template com prazos calculados do embarque (futureDate(95)).
// Embarque a ~95 dias ⇒ fase atual "6 a 2 meses": as fases anteriores aparecem
// concluídas, a atual em andamento e as seguintes pendentes (demo realista).
export const mockChecklistItens: Tables<"checklist_itens">[] = (() => {
  const peruId = "e0000000-0000-0000-0000-000000000001";
  const peru = mockExpedicoes.find((e) => e.id === peruId);
  if (!peru) return [];

  const itens = construirChecklistPadrao({
    expedicaoId: peruId,
    dataEmbarque: peru.data_embarque,
    responsavelPorPapel: {
      admin: "00000000-0000-0000-0000-000000000001",
      operacional: "00000000-0000-0000-0000-000000000002",
      comercial: "00000000-0000-0000-0000-000000000003",
      financeiro: "00000000-0000-0000-0000-000000000004",
    },
    idPrefix: "ckperu",
    createdAt: pastDate(80),
  });

  // Simula progresso: fases passadas concluídas, fase atual mista, futuras pendentes.
  const concluidas = new Set<EtapaChecklist>(["Após o fechamento", "12 a 6 meses"]);
  const idStatus = new Map<string, Tables<"checklist_itens">["status"]>();
  for (const it of itens) {
    if (it.parent_id) continue; // decide status pelo pai; filho herda abaixo
    if (concluidas.has(it.etapa)) {
      idStatus.set(it.id, "Concluído");
    } else if (it.etapa === "6 a 2 meses") {
      // 7 processos: 2 concluídos, 1 em andamento, 1 atenção, resto pendente
      const s =
        it.ordem <= 2 ? "Concluído" :
        it.ordem === 3 ? "Em andamento" :
        it.ordem === 4 ? "Atenção" : "Pendente";
      idStatus.set(it.id, s);
    } else {
      idStatus.set(it.id, "Pendente");
    }
  }
  for (const it of itens) {
    const ref = it.parent_id ?? it.id;
    const parentStatus = idStatus.get(ref) ?? "Pendente";
    if (it.parent_id) {
      // filhos: se pai concluído todos concluídos; se em andamento, parte feita
      it.status = parentStatus === "Concluído" ? "Concluído"
        : parentStatus === "Em andamento" ? (it.ordem <= 2 ? "Concluído" : "Pendente")
        : "Pendente";
    } else {
      it.status = parentStatus;
    }
  }
  return itens;
})();

export const mockDocumentos: Tables<"documentos">[] = [
  { id: "d001", passageiro_id: "p0000001", visto_necessario: false, status_visto: "Não necessário", seguro_status: "Emitido", apolice_url: null, observacoes: null, created_at: pastDate(40), updated_at: pastDate(2) },
  { id: "d002", passageiro_id: "p0000002", visto_necessario: false, status_visto: "Não necessário", seguro_status: "Pendente", apolice_url: null, observacoes: null, created_at: pastDate(40), updated_at: pastDate(2) },
  { id: "d003", passageiro_id: "p0000003", visto_necessario: false, status_visto: "Não necessário", seguro_status: "Pendente", apolice_url: null, observacoes: "Aguardando passaporte", created_at: pastDate(35), updated_at: pastDate(2) },
  { id: "d004", passageiro_id: "p0000004", visto_necessario: false, status_visto: "Não necessário", seguro_status: "Solicitado", apolice_url: null, observacoes: null, created_at: pastDate(30), updated_at: pastDate(2) },
];

export const mockLinksExpedicao: Tables<"links_expedicao">[] = [];

// Catálogo de requisitos (0010) para os destinos das expedições de demo.
export const mockRequisitosDestino: Tables<"requisitos_destino">[] = (() => {
  const destinos = [...new Set(mockExpedicoes.map((e) => e.destino))];
  return destinos.flatMap((destino) =>
    construirRequisitosDestino({
      destino,
      idPrefix: `rd-${destino.toLowerCase().replace(/[^a-z]/g, "")}`,
      createdAt: pastDate(200),
    }),
  );
})();

/**
 * Instâncias de requisito por passageiro (0010). Geradas do catálogo do destino
 * e ajustadas por `reqOverrides` para cobrir os três estados do semáforo.
 * Chave do override: `"<passageiroId>:<tipo>"`.
 */
const reqOverrides: Record<
  string,
  Partial<Pick<Tables<"passageiro_requisitos">, "status" | "validade" | "numero" | "observacoes">>
> = {
  // Peru — Mariana (Apto): tudo resolvido
  "p0000001:Seguro": { status: "Aprovado", numero: "TA-99001", validade: futureDate(110) },
  "p0000001:Vacina": { status: "Dispensado", observacoes: "Não vai à selva" },
  "p0000001:Aéreo Doméstico": { status: "Aprovado", numero: "LA2040" },
  // João (Atenção): seguro ok e vacina dispensada; sobra saldo + passaporte na janela
  "p0000002:Seguro": { status: "Aprovado", numero: "TA-99002", validade: futureDate(110) },
  "p0000002:Vacina": { status: "Dispensado" },
  // Rafael (Bloqueado pelo passaporte) — seguro até resolvido
  "p0000004:Seguro": { status: "Aprovado", numero: "TA-99004", validade: futureDate(110) },
  "p0000004:Vacina": { status: "Dispensado" },
  // Ana líder (Apto)
  "p0000005:Seguro": { status: "Aprovado", numero: "TA-99005", validade: futureDate(110) },
  "p0000005:Vacina": { status: "Dispensado" },
  "p0000005:Aéreo Doméstico": { status: "Aprovado", numero: "LA2041" },
  // Patagônia — Camila (Apto)
  "p0000006:Seguro": { status: "Aprovado", numero: "TA-88006", validade: futureDate(195) },
  "p0000006:RG": { status: "Dispensado" },
  // Egito — Roberto (Atenção): visto e seguro ok; passaporte vence dentro de 6 meses
  "p0000011:Visto": { status: "Aprovado", numero: "EG-2026-114" },
  "p0000011:Seguro": { status: "Aprovado", numero: "TA-77011", validade: futureDate(165) },
  "p0000011:Vacina": { status: "Dispensado" },
  "p0000011:Aéreo Doméstico": { status: "Dispensado" },
  // Helena (Bloqueado pelo visto pendente) — seguro adiantado
  "p0000012:Seguro": { status: "Aprovado", numero: "TA-77012", validade: futureDate(165) },
};

export const mockPassageiroRequisitos: Tables<"passageiro_requisitos">[] =
  mockPassageiros.flatMap((pax) => {
    const exp = mockExpedicoes.find((e) => e.id === pax.expedicao_id);
    if (!exp) return [];
    const rows = construirRequisitosPadrao({
      passageiro: pax,
      destino: exp.destino,
      idPrefix: `pr-${pax.id}`,
      createdAt: pastDate(30),
    });
    for (const r of rows) {
      const ov = reqOverrides[`${pax.id}:${r.tipo}`];
      if (ov) Object.assign(r, ov);
    }
    return rows;
  });

export function getExpedicoesComAgregados(): ExpedicaoComAgregados[] {
  const usuariosById = new Map(mockUsuarios.map((u) => [u.id, u]));
  return mockExpedicoes.map((e) => {
    const pax = mockPassageiros.filter((p) => p.expedicao_id === e.id);
    const pax_confirmados = pax.filter((p) => p.status_reserva === "Confirmado").length;
    const receita_prevista_brl = e.preco_venda_brl * (e.pax_planejados - e.pax_cortesia);
    const custos = mockCustos.filter((c) => c.expedicao_id === e.id);
    const custo_planejado_brl = custos.reduce((acc, c) => acc + c.valor_planejado_brl, 0);
    const margem_prevista = receita_prevista_brl > 0
      ? (receita_prevista_brl - custo_planejado_brl) / receita_prevista_brl
      : 0;
    const pagamentos_vencidos = mockPagamentos.filter((p) => {
      const c = mockCustos.find((cc) => cc.id === p.custo_id);
      if (!c || c.expedicao_id !== e.id) return false;
      return p.status === "Vencido";
    }).length;
    const docs_pendentes = pax.filter((p) => {
      const d = mockDocumentos.find((dd) => dd.passageiro_id === p.id);
      return !p.passaporte || (d?.seguro_status !== "Emitido");
    }).length;
    return {
      ...e,
      pax_confirmados,
      receita_prevista_brl,
      custo_planejado_brl,
      margem_prevista,
      pagamentos_vencidos,
      docs_pendentes,
      responsavel_op_nome: e.responsavel_operacional_id ? (usuariosById.get(e.responsavel_operacional_id)?.nome ?? null) : null,
      responsavel_com_nome: e.responsavel_comercial_id ? (usuariosById.get(e.responsavel_comercial_id)?.nome ?? null) : null,
    };
  });
}

// =============================================================================
// Seed LOCAL (gitignored) — carrega expedições/passageiros reais de data-local/
// só no servidor e só em modo mock. Nunca vai pro GitHub (ver .gitignore).
// Os CSVs usam o mesmo formato dos modelos em docs/modelos/.
// =============================================================================
function passageiroDeSeed(
  d: DadosImport,
  expedicaoId: string,
  id: string,
): Tables<"passageiros"> {
  const contratado = d.valor_contratado_brl ?? 0;
  const pago = d.valor_pago_brl ?? 0;
  const status_financeiro =
    d.tipo !== "Pagante" && contratado === 0
      ? "Cortesia"
      : contratado > 0 && pago >= contratado
        ? "Quitado"
        : "Em aberto";
  return {
    id,
    expedicao_id: expedicaoId,
    grupo_id: null,
    bitrix_contact_id: null,
    bitrix_deal_id: null,
    nome_completo: d.nome_completo,
    tipo: d.tipo,
    cpf: d.cpf,
    passaporte: d.passaporte,
    data_nascimento: d.data_nascimento,
    validade_passaporte: d.validade_passaporte,
    email: d.email,
    telefone: d.telefone,
    status_reserva: d.status_reserva,
    voo_nacional_necessario: false,
    companhia_aerea: null,
    localizador: null,
    quarto_id: null,
    valor_contratado_brl: contratado,
    valor_pago_brl: pago,
    saldo_brl: contratado - pago,
    status_financeiro,
    contato_emergencia_nome: null,
    contato_emergencia_fone: null,
    restricoes_alimentares: null,
    condicoes_medicas: null,
    contrato_assinado: false,
    checkin_online_feito: false,
    observacoes: d.observacoes,
    created_at: pastDate(1),
    updated_at: pastDate(1),
  };
}

function carregarSeedLocal(): void {
  if (typeof window !== "undefined") return; // só no servidor
  try {
    const dir = path.join(process.cwd(), "data-local");
    const paxPath = path.join(dir, "passageiros.csv");
    if (!fs.existsSync(paxPath)) return;

    const codigoToId = new Map<string, string>();
    const destinoById = new Map<string, string>();

    // Permite anexar passageiros a expedições JÁ existentes (pelo código),
    // além das definidas em data-local/expedicoes.csv.
    for (const e of mockExpedicoes) {
      codigoToId.set(e.codigo, e.id);
      destinoById.set(e.id, e.destino);
    }

    const expPath = path.join(dir, "expedicoes.csv");
    if (fs.existsSync(expPath)) {
      const grade = parseCSV(fs.readFileSync(expPath, "utf8"));
      const [hdr, ...linhas] = grade;
      const col = (nome: string) =>
        hdr.findIndex((h) => h.trim().toLowerCase() === nome);
      const cCod = col("codigo"), cNome = col("nome"), cDest = col("destino"),
        cEmb = col("data_embarque"), cRet = col("data_retorno"),
        cStatus = col("status"), cPax = col("pax"), cPreco = col("preco_venda_brl");
      for (const r of linhas) {
        const codigo = (cCod >= 0 ? r[cCod] : "")?.trim();
        if (!codigo) continue;
        const id = `seed-${codigo.toLowerCase()}`;
        const destino = (cDest >= 0 ? r[cDest] : "")?.trim() ?? "";
        const emb = normalizarData(cEmb >= 0 ? r[cEmb] ?? "" : "").iso ?? iso(today);
        const ret = normalizarData(cRet >= 0 ? r[cRet] ?? "" : "").iso ?? emb;
        mockExpedicoes.push({
          id,
          codigo,
          nome: (cNome >= 0 ? r[cNome] : "")?.trim() || codigo,
          destino,
          data_embarque: emb,
          data_retorno: ret,
          responsavel_operacional_id: null,
          responsavel_comercial_id: null,
          dmc_principal_id: null,
          status: ((cStatus >= 0 ? r[cStatus] : "")?.trim() ||
            "Concluída") as Tables<"expedicoes">["status"],
          pax_planejados: Number((cPax >= 0 ? r[cPax] : "0")?.trim() || 0) || 0,
          pax_cortesia: 0,
          preco_venda_brl: parseNumeroBR(cPreco >= 0 ? r[cPreco] ?? "" : "").num ?? 0,
          bitrix_pipeline_id: null,
          observacoes: null,
          ordem: null,
          created_at: pastDate(1),
          updated_at: pastDate(1),
        });
        codigoToId.set(codigo, id);
        destinoById.set(id, destino);
      }
    }

    const parsed = parsePassageirosCSV(fs.readFileSync(paxPath, "utf8"));
    let i = 0;
    for (const linha of parsed.linhas) {
      if (linha.erros.length > 0) continue;
      const codigo = linha.dados.expedicao_codigo;
      const expId = codigo ? codigoToId.get(codigo) : undefined;
      if (!expId) continue;
      i++;
      const pax = passageiroDeSeed(linha.dados, expId, `seed-pax-${i}`);
      mockPassageiros.push(pax);
      mockPassageiroRequisitos.push(
        ...construirRequisitosPadrao({
          passageiro: pax,
          destino: destinoById.get(expId) ?? "",
          idPrefix: `prseed-${i}`,
        }),
      );
    }
  } catch (e) {
    console.error("[seed-local] falha ao carregar data-local/:", e);
  }
}

carregarSeedLocal();
