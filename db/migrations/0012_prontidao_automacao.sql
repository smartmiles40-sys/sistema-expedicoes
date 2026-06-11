-- 0012 — Automação da prontidão: job diário de validade + realtime.

-- =============================================================================
-- Função: marca como "Vencido" todo requisito cuja validade não cobre o retorno.
-- Idempotente; devolve quantas linhas mudaram. Chamável manualmente ou via cron.
-- =============================================================================
create or replace function prontidao_marcar_vencidos() returns integer
language plpgsql as $$
declare
  n integer;
begin
  with alvo as (
    select pr.id
    from passageiro_requisitos pr
    join passageiros p on p.id = pr.passageiro_id
    join expedicoes  e on e.id = p.expedicao_id
    where pr.validade is not null
      and pr.validade < e.data_retorno
      and pr.status not in ('Vencido', 'Dispensado', 'Reprovado')
  )
  update passageiro_requisitos
     set status = 'Vencido', updated_at = now()
   where id in (select id from alvo);
  get diagnostics n = row_count;
  return n;
end $$;

-- =============================================================================
-- Agendamento diário (06:00) via pg_cron — só se a extensão existir.
-- No Supabase: habilitar pg_cron em Database > Extensions.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'prontidao-marcar-vencidos') then
      perform cron.unschedule('prontidao-marcar-vencidos');
    end if;
    perform cron.schedule(
      'prontidao-marcar-vencidos',
      '0 6 * * *',
      $cron$ select prontidao_marcar_vencidos(); $cron$
    );
  else
    raise notice 'pg_cron não instalado — rode prontidao_marcar_vencidos() por outro agendador.';
  end if;
end $$;

-- =============================================================================
-- Realtime: transmite mudanças das tabelas de prontidão pros clients conectados.
-- =============================================================================
do $$
declare
  t text;
  tabelas text[] := array['requisitos_destino', 'passageiro_requisitos'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array tabelas loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
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
