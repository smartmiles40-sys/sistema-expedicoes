-- 0068_acesso_formulario_preenchido.sql
-- Novo evento no log do Portal do Viajante (antigo "ExpedAmigo"):
-- 'formulario_preenchido' — o passageiro preencheu o formulário de inscrição
-- ABERTO PELO PORTAL (link ?t=…). Só ampliar o CHECK do evento.
alter table expedamigo_acessos drop constraint if exists expedamigo_acessos_evento_chk;
alter table expedamigo_acessos
  add constraint expedamigo_acessos_evento_chk
  check (evento in ('login', 'download_pdf', 'viagem_aberta', 'download_voucher', 'primeiro_acesso', 'formulario_preenchido'));
