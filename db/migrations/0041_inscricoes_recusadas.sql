-- 0041_inscricoes_recusadas.sql
-- Recusar uma inscrição NÃO apaga mais os dados: ela vai para um estado
-- "recusada" (fica guardada, com os anexos), de onde pode ser RESTAURADA
-- (volta para a fila) ou EXCLUÍDA definitivamente pelo operacional.
--
-- status:
--   'pendente' — aguardando aprovação (fluxo normal; conta no badge da fila)
--   'recusada' — recusada, aguardando numa aba à parte (não conta no badge)
alter table inscricoes_pendentes
  add column if not exists status text not null default 'pendente',
  add column if not exists recusada_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inscricoes_pendentes_status_chk'
  ) then
    alter table inscricoes_pendentes
      add constraint inscricoes_pendentes_status_chk check (status in ('pendente', 'recusada'));
  end if;
end $$;

create index if not exists idx_inscricoes_pendentes_status on inscricoes_pendentes (status);
