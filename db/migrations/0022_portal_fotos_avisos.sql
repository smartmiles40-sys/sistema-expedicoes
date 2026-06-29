-- =============================================================================
-- Portal do ExpedAmigo (Fase 2.1):
--   roteiro_dia_fotos : fotos de cada dia do roteiro (o blob fica em `arquivos`)
--   expedicao_avisos  : avisos / boas práticas / dicas da viagem (com tipo)
-- =============================================================================

-- ---------- Fotos por dia do roteiro ----------
create table if not exists roteiro_dia_fotos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  roteiro_dia_id uuid not null references roteiro_dias(id) on delete cascade,
  arquivo_id uuid not null references arquivos(id) on delete cascade,
  legenda text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_roteiro_dia_fotos_dia on roteiro_dia_fotos(roteiro_dia_id, ordem);
create index if not exists idx_roteiro_dia_fotos_exp on roteiro_dia_fotos(expedicao_id);

drop trigger if exists tg_roteiro_dia_fotos_updated_at on roteiro_dia_fotos;
create trigger tg_roteiro_dia_fotos_updated_at
  before update on roteiro_dia_fotos for each row execute function set_updated_at();

-- ---------- Avisos / boas práticas / dicas ----------
create table if not exists expedicao_avisos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  tipo text not null default 'Aviso',   -- Aviso | Boa prática | Dica
  titulo text not null,
  conteudo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expedicao_avisos_exp on expedicao_avisos(expedicao_id, ordem);

drop trigger if exists tg_expedicao_avisos_updated_at on expedicao_avisos;
create trigger tg_expedicao_avisos_updated_at
  before update on expedicao_avisos for each row execute function set_updated_at();

-- ---------- RLS: leitura + escrita para autenticado (refinar antes de prod) ----------
do $$
declare t text;
begin
  foreach t in array array['roteiro_dia_fotos','expedicao_avisos']
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
