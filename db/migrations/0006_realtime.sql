-- =============================================================================
-- Realtime: adiciona tabelas operacionais à publicação `supabase_realtime`
-- pra que mudanças (INSERT/UPDATE/DELETE) sejam transmitidas pros clients
-- conectados via Supabase Realtime.
--
-- REPLICA IDENTITY FULL garante que payloads de DELETE/UPDATE incluam a
-- linha inteira (não só a PK), o que facilita o cliente decidir o que fazer.
-- Custo: WAL um pouco maior. Aceitável pra o volume da agência.
-- =============================================================================

-- Garante que a publication existe (default no Supabase, mas seguro).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Helper: adiciona tabela à publication se ainda não estiver.
do $$
declare
  t text;
  tabelas text[] := array[
    'expedicoes',
    'passageiros',
    'quartos',
    'custos',
    'pagamentos',
    'checklist_itens',
    'fornecedores',
    'cambios',
    'documentos',
    'arquivos',
    'usuarios',
    'grupos_expedicao'
  ];
begin
  foreach t in array tabelas loop
    -- Skip se a tabela não existir (defensivo).
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      raise notice 'Tabela public.% não existe, pulando', t;
      continue;
    end if;

    -- Adiciona à publication se ainda não foi.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    -- REPLICA IDENTITY FULL: payload completo em DELETE/UPDATE.
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
