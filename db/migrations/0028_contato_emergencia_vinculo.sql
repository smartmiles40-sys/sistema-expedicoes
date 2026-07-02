-- 0028 — Vínculo do contato de emergência (mãe, pai, irmão, cônjuge, amigo…).
-- Dado PESSOAL (propaga entre expedições da pessoa, junto de nome/telefone).
alter table passageiros
  add column if not exists contato_emergencia_vinculo text;
