-- =============================================================================
-- Portal do ExpedAmigo (Fase 2) — conteúdo da viagem visível ao passageiro:
--   roteiro_dias      : roteiro dia a dia
--   expedicao_voos    : voos de grupo (ida/volta/interno)
--   expedicao_passeios: passeios / ingressos
--   expedicao_info    : blocos de informações importantes do destino
-- Conteúdo é AUTORADO no operacional e SÓ-LEITURA no portal (/amigo via service role).
-- =============================================================================

-- ---------- Roteiro dia a dia ----------
create table if not exists roteiro_dias (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  dia int not null default 1,            -- número do dia (Dia 1, Dia 2…)
  data date,                             -- data real do dia (opcional)
  titulo text not null,
  descricao text,
  cidade text,
  refeicoes text,                        -- ex.: "Café, Almoço"
  hospedagem text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_roteiro_dias_exp on roteiro_dias(expedicao_id, ordem);

drop trigger if exists tg_roteiro_dias_updated_at on roteiro_dias;
create trigger tg_roteiro_dias_updated_at
  before update on roteiro_dias for each row execute function set_updated_at();

-- ---------- Voos de grupo ----------
create table if not exists expedicao_voos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  trecho text not null default 'Ida',    -- Ida | Volta | Interno (texto livre)
  companhia text,
  numero_voo text,
  origem text,                           -- aeroporto/cidade de origem
  destino text,                          -- aeroporto/cidade de destino
  partida text,                          -- ex.: "12/08/2026 14:30"
  chegada text,
  localizador text,
  observacoes text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expedicao_voos_exp on expedicao_voos(expedicao_id, ordem);

drop trigger if exists tg_expedicao_voos_updated_at on expedicao_voos;
create trigger tg_expedicao_voos_updated_at
  before update on expedicao_voos for each row execute function set_updated_at();

-- ---------- Passeios / ingressos ----------
create table if not exists expedicao_passeios (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  nome text not null,
  data date,
  horario text,
  local text,
  incluso boolean not null default true, -- incluso no pacote?
  observacoes text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expedicao_passeios_exp on expedicao_passeios(expedicao_id, ordem);

drop trigger if exists tg_expedicao_passeios_updated_at on expedicao_passeios;
create trigger tg_expedicao_passeios_updated_at
  before update on expedicao_passeios for each row execute function set_updated_at();

-- ---------- Informações do destino (blocos) ----------
create table if not exists expedicao_info (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  titulo text not null,                  -- ex.: "Moeda e câmbio", "Clima", "Tomadas"
  conteudo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expedicao_info_exp on expedicao_info(expedicao_id, ordem);

drop trigger if exists tg_expedicao_info_updated_at on expedicao_info;
create trigger tg_expedicao_info_updated_at
  before update on expedicao_info for each row execute function set_updated_at();

-- ---------- RLS: leitura + escrita para autenticado (refinar antes de prod) ----------
do $$
declare t text;
begin
  foreach t in array array['roteiro_dias','expedicao_voos','expedicao_passeios','expedicao_info']
  loop
    execute format('alter table %I enable row level security', t);
    begin
      execute format('create policy "%s: leitura autenticado" on %I for select to authenticated using (true)', t, t);
    exception when duplicate_object then null; end;
    begin
      execute format('create policy "%s: escrita autenticado" on %I for all to authenticated using (true) with check (true)', t, t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
