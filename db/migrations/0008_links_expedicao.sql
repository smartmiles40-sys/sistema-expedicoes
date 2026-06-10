-- =============================================================================
-- Links da expedição: refs externas (apresentação, LP, planilha, etc.)
-- Cada expedição pode ter N links com label + url livres.
-- =============================================================================

create table if not exists links_expedicao (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  label text not null,
  url text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_links_expedicao on links_expedicao(expedicao_id);
create index if not exists idx_links_expedicao_ordem on links_expedicao(expedicao_id, ordem);

drop trigger if exists tg_links_expedicao_updated_at on links_expedicao;
create trigger tg_links_expedicao_updated_at
  before update on links_expedicao
  for each row execute function set_updated_at();

alter table links_expedicao enable row level security;

do $$ begin
  create policy "links_expedicao: leitura autenticado" on links_expedicao for select
    to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "links_expedicao: escrita autenticado" on links_expedicao for all
    to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Realtime: adiciona à publication e REPLICA IDENTITY FULL
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'links_expedicao'
  ) then
    execute 'alter publication supabase_realtime add table public.links_expedicao';
  end if;
  execute 'alter table public.links_expedicao replica identity full';
end $$;

-- Policy anon SELECT (DEV — vide REALTIME_SETUP.sql)
do $$ begin
  drop policy if exists "anon_read_dev" on public.links_expedicao;
  create policy "anon_read_dev" on public.links_expedicao for select
    to anon using (true);
end $$;
