-- 0050_acesso_download_voucher.sql
-- Novo evento no log do ExpedAmigo: 'download_voucher' (baixou qualquer voucher/
-- ingresso/seguro no portal). Só ampliar o CHECK do evento.

alter table expedamigo_acessos drop constraint if exists expedamigo_acessos_evento_chk;
alter table expedamigo_acessos
  add constraint expedamigo_acessos_evento_chk
  check (evento in ('login', 'download_pdf', 'viagem_aberta', 'download_voucher'));
