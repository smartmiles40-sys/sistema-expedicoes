-- 0046_rls_read_only.sql
-- Trava de ESCRITA para papéis somente-leitura (relacionamento, leitura).
--
-- Políticas RESTRICTIVE (fazem AND com as permissivas já existentes) que bloqueiam
-- insert/update/delete quando o usuário logado é read-only. SELECT continua liberado
-- (não adicionamos policy restritiva de select). Assim o relacionamento LÊ tudo, mas
-- não escreve — as ações que escrevem com a sessão do usuário passam a bater na RLS.
--
-- As ações que usam service_role (aprovar/recusar inscrição, etc.) IGNORAM a RLS de
-- propósito; a permissão delas é garantida por guardas no app (lib/auth/permissoes.ts).
--
-- Fail-OPEN: se não achar o papel (linha ausente/nula), NÃO bloqueia — não quebra
-- editores. Rode a migration 0045 (novo valor do enum) ANTES desta.

create or replace function public.is_readonly()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel::text in ('relacionamento','leitura')
       from public.usuarios where id = auth.uid()),
    false
  );
$$;

do $$
declare
  t text;
  tabelas text[] := array[
    'expedicoes','passageiros','custos','pagamentos','checklist_itens','documentos',
    'quartos','passageiro_quarto','links_expedicao','roteiro_dias','expedicao_voos',
    'expedicao_passeios','expedicao_info','expedicao_avisos','roteiro_dia_fotos',
    'passeios_opcionais','passeio_opcional_compras','fornecedores','cambios',
    'requisitos_destino','passageiro_requisitos','grupos_expedicao','roteiro_lider_dias',
    'inscricoes_pendentes','arquivos'
  ];
begin
  foreach t in array tabelas loop
    if to_regclass('public.'||t) is null then
      continue;  -- tabela não existe nesta base → pula
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "ro_block_insert" on public.%I', t);
    execute format('create policy "ro_block_insert" on public.%I as restrictive for insert to authenticated with check (not public.is_readonly())', t);
    execute format('drop policy if exists "ro_block_update" on public.%I', t);
    execute format('create policy "ro_block_update" on public.%I as restrictive for update to authenticated using (not public.is_readonly()) with check (not public.is_readonly())', t);
    execute format('drop policy if exists "ro_block_delete" on public.%I', t);
    execute format('create policy "ro_block_delete" on public.%I as restrictive for delete to authenticated using (not public.is_readonly())', t);
  end loop;
end $$;
