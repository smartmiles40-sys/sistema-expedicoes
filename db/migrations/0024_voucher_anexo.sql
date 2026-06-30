-- 0024 — Anexo de voucher (1 arquivo) por item de Voo e de Passeio do ExpedAmigo.
-- O blob fica na tabela `arquivos` (upload via /api/arquivos/upload, categoria "Vouchers");
-- cada linha guarda o arquivo_id do seu voucher. On delete do arquivo → seta null.

alter table expedicao_voos
  add column if not exists arquivo_id uuid references arquivos(id) on delete set null;

alter table expedicao_passeios
  add column if not exists arquivo_id uuid references arquivos(id) on delete set null;
