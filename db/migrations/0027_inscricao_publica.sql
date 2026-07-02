-- 0027 — Formulário público de inscrição (/inscricao).
--
-- Cria o cadastro do passageiro já na expedição escolhida, mas com
-- `pendente_aprovacao = true` até alguém do operacional aprovar (fila em /inscricoes).
-- Acrescenta endereço, preferências de voo, histórico de viagem e acompanhante.
-- (As novas perguntas de SAÚDE vão no JSONB `saude` — sem coluna nova.)

alter table passageiros
  add column if not exists pendente_aprovacao boolean not null default false,
  add column if not exists inscricao_origem text,                 -- ex.: "Formulário público"
  -- Endereço (dado PESSOAL — propaga entre expedições da pessoa)
  add column if not exists endereco_cep text,
  add column if not exists endereco_rua text,
  add column if not exists endereco_numero text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_estado text,
  -- Preferências de voo (dado da RESERVA)
  add column if not exists pref_marcar_assento boolean,
  add column if not exists pref_upgrade_classe text,              -- null | "Executiva" | "Primeira classe"
  -- Histórico de viagem (dado PESSOAL)
  add column if not exists ja_viajou_internacional boolean,
  add column if not exists paises_visitados text,
  -- Acompanhante (dado da RESERVA)
  add column if not exists acompanhante_nome text,
  add column if not exists acompanhante_divide_quarto text;       -- null | "Quarto" | "Cama" | "Não"

-- Fila de aprovações: só as linhas pendentes.
create index if not exists idx_passageiros_pendente
  on passageiros (pendente_aprovacao) where pendente_aprovacao;
