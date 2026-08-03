-- 0048_compras_bitrix.sql
-- Histórico de compras puxado do Bitrix: cada NEGÓCIO GANHO (deal WON) vira uma
-- linha. Chaveado por bitrix_deal_id (idempotente). Casa com a pessoa por CPF
-- (ou bitrix_contact_id). Alimentado pelo n8n em /api/bitrix/importar-compras.

create table if not exists compras_bitrix (
  id uuid primary key default gen_random_uuid(),
  bitrix_deal_id text not null unique,     -- id do negócio no Bitrix (idempotência)
  bitrix_contact_id text,                  -- id do contato no Bitrix
  cpf text,                                -- só dígitos, quando houver
  nome_contato text,                       -- snapshot do nome do contato
  titulo text,                             -- nome do negócio / viagem
  data_compra date,                        -- data de fechamento (ganho)
  valor numeric,                           -- valor do negócio
  moeda text default 'BRL',
  funil text,                              -- pipeline/categoria do negócio
  etapa text,                              -- stage (ganho)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_compras_bitrix_cpf on compras_bitrix(cpf);
create index if not exists idx_compras_bitrix_contact on compras_bitrix(bitrix_contact_id);
create index if not exists idx_compras_bitrix_data on compras_bitrix(data_compra desc);

drop trigger if exists tg_compras_bitrix_updated_at on compras_bitrix;
create trigger tg_compras_bitrix_updated_at
  before update on compras_bitrix for each row execute function set_updated_at();

-- RLS: leitura para autenticado (a UI mostra pra time interno). Escrita só via
-- service role (o endpoint /api/bitrix/importar-compras).
alter table compras_bitrix enable row level security;
do $$ begin
  create policy "compras_bitrix: leitura autenticado" on compras_bitrix
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
