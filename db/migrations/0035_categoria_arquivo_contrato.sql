-- 0035 — Categoria de arquivo "Contrato".
--
-- BUG: `lib/constants.ts` (CATEGORIA_ARQUIVO) já lista "Contrato" e o drawer de
-- prontidão anexa o contrato nessa categoria (ProntidaoPaxDrawer: categorias={["Contrato"]}),
-- mas o valor NUNCA foi adicionado ao enum criado na 0005. Em modo mock passava;
-- no Supabase real o upload falhava com:
--   invalid input value for enum categoria_arquivo: "Contrato"
--
-- Entra `before 'Bilhetes'` pra a ordem do enum bater com a de CATEGORIA_ARQUIVO
-- (é ela que define a ordem das pastas no Drive).
--
-- ⚠️ ALTER TYPE ... ADD VALUE deve rodar FORA de transação. Execute a linha isolada
--    no SQL Editor do Supabase.

alter type categoria_arquivo add value if not exists 'Contrato' before 'Bilhetes';
