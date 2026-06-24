-- 0018 — Questionário de saúde do passageiro.
-- Coluna jsonb `saude` em passageiros (dado PESSOAL — propaga entre as expedições
-- da pessoa via CAMPOS_PESSOAIS em app/(app)/expedicoes/actions.ts).
-- Estrutura (chaves opcionais, ver types/database.ts SaudePassageiro):
--   problema_saude / problema_saude_qual, medicamento_diario / _qual,
--   alergia_medicamento / _qual, alergia_alimentar / _qual,
--   restricao_alimentar / _qual, limitacao_fisica / _qual,
--   cirurgia_importante / cirurgia_qual, vacina_febre_amarela.
-- Rode no SQL Editor do Supabase.

alter table passageiros add column if not exists saude jsonb;
