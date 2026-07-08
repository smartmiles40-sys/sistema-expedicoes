-- 0030_hospedagem_voucher.sql
-- Voucher ÚNICO da hospedagem por expedição — todos os passageiros ficam no mesmo
-- hotel, então é o mesmo arquivo para todos. Aponta para arquivos(id).
alter table expedicoes
  add column if not exists hospedagem_voucher_arquivo_id uuid
  references arquivos(id) on delete set null;
