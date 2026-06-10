-- =============================================================================
-- Migration: subgrupos dentro de uma expedição (G1, G2, G3...)
-- Contexto: algumas expedições rodam em datas próximas com grupos diferentes.
-- Antes virava expedição separada (TAI1-2026-11 e TAI2-2026-11). Agora pode
-- ser UMA expedição "Tailândia 2026" com vários grupos.
-- =============================================================================

create table if not exists grupos_expedicao (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  nome text not null,
  data_embarque date,
  data_retorno date,
  pax_planejados int not null default 0,
  observacoes text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expedicao_id, nome),
  check (data_retorno is null or data_embarque is null or data_retorno >= data_embarque)
);

create index if not exists idx_grupos_expedicao_id on grupos_expedicao(expedicao_id);

-- Trigger updated_at
drop trigger if exists tg_grupos_expedicao_updated_at on grupos_expedicao;
create trigger tg_grupos_expedicao_updated_at
  before update on grupos_expedicao
  for each row execute function set_updated_at();

-- Passageiros agora podem (opcionalmente) pertencer a um grupo da expedição
alter table passageiros
  add column if not exists grupo_id uuid references grupos_expedicao(id) on delete set null;

create index if not exists idx_passageiros_grupo on passageiros(grupo_id);

-- RLS
alter table grupos_expedicao enable row level security;

do $$ begin
  create policy "grupos: leitura autenticado" on grupos_expedicao for select
    to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "grupos: escrita autenticado" on grupos_expedicao for all
    to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
