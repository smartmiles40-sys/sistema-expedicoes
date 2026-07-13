-- 0033_info_pdf.sql
-- PDF (ou imagem) baixável por bloco de "Informações do destino" no portal do
-- ExpedAmigo. Cada caixinha de info pode ter 1 arquivo anexado; no portal vira
-- um botão "Baixar PDF" (invisível quando não há arquivo). Espelha o voucher
-- dos passeios (migration 0024).

alter table expedicao_info
  add column if not exists arquivo_id uuid references arquivos(id) on delete set null;
