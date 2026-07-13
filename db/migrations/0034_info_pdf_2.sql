-- 0034_info_pdf_2.sql
-- Amplia o anexo das "Informações do destino" (migration 0033): agora até 2
-- arquivos por caixinha, cada um com um rótulo/nome de link personalizável.
--   arquivo_id      (0033) — 1º arquivo
--   arquivo_label          — nome do link do 1º arquivo
--   arquivo_id_2           — 2º arquivo
--   arquivo_label_2        — nome do link do 2º arquivo

alter table expedicao_info
  add column if not exists arquivo_label text,
  add column if not exists arquivo_id_2 uuid references arquivos(id) on delete set null,
  add column if not exists arquivo_label_2 text;
