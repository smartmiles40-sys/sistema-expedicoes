-- =============================================================================
-- 0036 — Remove as policies `anon_read_dev` (blindagem de RLS pra produção)
-- -----------------------------------------------------------------------------
-- As policies "anon_read_dev" (criadas em 0007/0008/0013) davam SELECT irrestrito
-- pra role `anon` em 15 tabelas — expedicoes, passageiros, quartos, custos,
-- pagamentos, checklist_itens, fornecedores, cambios, documentos, arquivos,
-- usuarios, grupos_expedicao, links_expedicao, requisitos_destino,
-- passageiro_requisitos. Ou seja: qualquer um com a anon key lia CPF, passaporte,
-- financeiro, endereço etc. Existiam só porque o app rodava com
-- DEV_AUTH_BYPASS=true (cliente browser não logava, ficava como `anon`) e o
-- Realtime aplica RLS sobre quem recebe evento.
--
-- Agora o app roda com login real (DEV_AUTH_BYPASS=false, e travado em prod —
-- lib/dev-mode.ts): o cliente browser é `authenticated` e passa pelas policies
-- `auth_*` (0001/0010), que já cobrem SELECT + Realtime. As de `anon` viram
-- só superfície de vazamento — este é o item 🔴 do HANDOFF.md.
--
-- ⚠️ Depois desta migration, o app SÓ funciona autenticado. Se algum ambiente
--    ainda estiver em DEV_AUTH_BYPASS=true contra este banco, o Realtime pára de
--    entregar eventos pro anon (a leitura via service role/SSR continua ok).
--
-- Dinâmico de propósito: dropa TODA policy chamada "anon_read_dev" no schema
-- public, não importa a tabela — pega as 15 e qualquer outra que tenha escapado.
-- Idempotente (drop if exists).
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_policies
    where schemaname = 'public' and policyname = 'anon_read_dev'
  loop
    execute format('drop policy if exists "anon_read_dev" on %I.%I', r.schemaname, r.tablename);
    raise notice 'anon_read_dev removida de %.%', r.schemaname, r.tablename;
  end loop;
end $$;
