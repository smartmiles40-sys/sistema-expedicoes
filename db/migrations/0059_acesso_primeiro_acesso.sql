-- 0059_acesso_primeiro_acesso.sql
-- Novo evento no log do ExpedAmigo: 'primeiro_acesso' (a pessoa criou a senha pelo
-- link mágico de 1º acesso — `/amigo/acesso?t=...`). Só ampliar o CHECK do evento.

alter table expedamigo_acessos drop constraint if exists expedamigo_acessos_evento_chk;
alter table expedamigo_acessos
  add constraint expedamigo_acessos_evento_chk
  check (evento in ('login', 'download_pdf', 'viagem_aberta', 'download_voucher', 'primeiro_acesso'));
