-- =============================================================================
-- 0013 — Realtime para as tabelas de Prontidão (P9)
-- -----------------------------------------------------------------------------
-- requisitos_destino e passageiro_requisitos foram criadas na 0010, depois do
-- setup de realtime (0006/0007), então ficaram sem replicação. Aqui entram na
-- publication + REPLICA IDENTITY FULL e ganham SELECT pra anon (modo dev), pra
-- que mudanças de requisito (semáforo de prontidão) também atualizem em tempo
-- real na tela dos outros usuários.
-- Idempotente.
-- =============================================================================
do $$
declare
  t text;
  tabelas text[] := array['requisitos_destino', 'passageiro_requisitos'];
begin
  -- Garante a publication (caso a 0006 não tenha rodado ainda).
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

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

    -- SELECT pra anon (DEV apenas — remover em produção com login real).
    execute format('drop policy if exists "anon_read_dev" on public.%I', t);
    execute format(
      'create policy "anon_read_dev" on public.%I for select to anon using (true)', t
    );
  end loop;
end $$;
