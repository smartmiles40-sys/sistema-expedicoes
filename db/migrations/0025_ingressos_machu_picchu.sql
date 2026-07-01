-- 0025 — Requisitos de prontidão "Ingresso Machu Picchu" e "Ingresso Trem Machu Picchu".
--
-- Só aparecem em expedições do destino "Peru" (entram no template de Peru em
-- lib/prontidao/requisitos-destino.ts). São OPCIONAIS (não bloqueiam) e só de anexo
-- (arquivo). Ingresso do trem aceita VÁRIOS anexos (ida e volta).
--
-- Basta adicionar os valores ao enum tipo_requisito. NÃO precisa backfill: a lista da
-- prontidão já mostra os itens (vêm do template do destino) e o drawer permite clicar
-- pra criar a instância e anexar; pax novos recebem a instância via gerarRequisitosPadrao.
--
-- ⚠️ ALTER TYPE ... ADD VALUE deve rodar FORA de transação. Execute cada linha isolada
--    no SQL Editor do Supabase.

alter type tipo_requisito add value if not exists 'Ingresso Machu Picchu';
alter type tipo_requisito add value if not exists 'Ingresso Trem Machu Picchu';
