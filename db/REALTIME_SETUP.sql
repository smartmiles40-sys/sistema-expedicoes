-- =============================================================================
-- SETUP REALTIME — aplicar no SQL Editor do Supabase
-- (https://supabase.com/dashboard/project/bnbpsuenlokhljrkvlke/sql/new)
--
-- Cola este arquivo INTEIRO e clica em "Run".
--
-- Faz duas coisas:
--   1. Habilita Realtime nas tabelas (publication + REPLICA IDENTITY)
--   2. Permite role `anon` ler — necessário enquanto o app rodar com
--      DEV_AUTH_BYPASS=true. Em prod (login obrigatório), apague as
--      policies `anon_read_dev` (vide bloco no final).
-- =============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Habilitar Realtime
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
  tabelas text[] := array[
    'expedicoes', 'passageiros', 'quartos', 'custos', 'pagamentos',
    'checklist_itens', 'fornecedores', 'cambios', 'documentos',
    'arquivos', 'usuarios', 'grupos_expedicao', 'links_expedicao',
    'requisitos_destino', 'passageiro_requisitos'
  ];
begin
  foreach t in array tabelas loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      raise notice 'Tabela public.% não existe, pulando', t;
      continue;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Policies anon SELECT (DEV apenas — apague em produção)
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tabelas text[] := array[
    'expedicoes', 'passageiros', 'quartos', 'custos', 'pagamentos',
    'checklist_itens', 'fornecedores', 'cambios', 'documentos',
    'arquivos', 'usuarios', 'grupos_expedicao', 'links_expedicao',
    'requisitos_destino', 'passageiro_requisitos'
  ];
begin
  foreach t in array tabelas loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      continue;
    end if;
    execute format('drop policy if exists "anon_read_dev" on public.%I', t);
    execute format(
      'create policy "anon_read_dev" on public.%I for select to anon using (true)',
      t
    );
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- DEPOIS, EM PRODUÇÃO COM LOGIN REAL: rode este bloco pra remover anon_read_dev
-- ────────────────────────────────────────────────────────────────────────────
-- do $$
-- declare
--   t text;
--   tabelas text[] := array[
--     'expedicoes','passageiros','quartos','custos','pagamentos',
--     'checklist_itens','fornecedores','cambios','documentos','arquivos',
--     'usuarios','grupos_expedicao','links_expedicao'];
-- begin foreach t in array tabelas loop
--   execute format('drop policy if exists "anon_read_dev" on public.%I', t);
-- end loop; end $$;
