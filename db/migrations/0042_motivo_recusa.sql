-- 0042_motivo_recusa.sql
-- Ao recusar uma inscrição, o operacional registra o MOTIVO (texto) e, opcionalmente,
-- um ANEXO explicando tecnicamente a recusa (arquivo na tabela `arquivos`).
alter table inscricoes_pendentes
  add column if not exists motivo_recusa text,
  add column if not exists recusa_arquivo_id uuid references arquivos(id) on delete set null;
