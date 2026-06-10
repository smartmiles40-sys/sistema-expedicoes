-- =============================================================================
-- DEV ONLY — Policies de SELECT pra role `anon`.
--
-- Por que existe: o Supabase Realtime aplica RLS sobre quem pode receber
-- eventos. Como o app atualmente roda com `DEV_AUTH_BYPASS=true` (cliente
-- browser não loga, fica como `anon`), sem essas policies o anon não passa
-- pela RLS e os eventos não chegam.
--
-- Em produção (login obrigatório, RLS por papel): apague essas policies com:
--
--   do $$ declare t text;
--   tabelas text[] := array[
--     'expedicoes','passageiros','quartos','custos','pagamentos',
--     'checklist_itens','fornecedores','cambios','documentos','arquivos',
--     'usuarios','grupos_expedicao'];
--   begin foreach t in array tabelas loop
--     execute format('drop policy if exists "anon_read_dev" on public.%I', t);
--   end loop; end $$;
--
-- =============================================================================

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
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      continue;
    end if;
    -- Policy idempotente: drop + create.
    execute format('drop policy if exists "anon_read_dev" on public.%I', t);
    execute format(
      'create policy "anon_read_dev" on public.%I for select to anon using (true)',
      t
    );
  end loop;
end $$;
