-- 0053_segmento_sem_extensao.sql
-- Terceiro estado de segmento para dias do roteiro e voos de grupo.
-- Contexto: quem contrata uma extensão tem um FINAL diferente (fica dias a mais,
-- voo de volta próprio). Então o ÚLTIMO dia / voo de volta do grupo principal
-- NÃO deve aparecer para quem estendeu. Antes só tínhamos:
--   extensao_id = null  → todos veem
--   extensao_id = X     → só quem contratou X
-- Agora um dia/voo pode ser marcado como "apenas_sem_extensao" = só aparece para
-- quem NÃO contratou nenhuma extensão (o grupo que volta com o roteiro base).

alter table roteiro_dias   add column if not exists apenas_sem_extensao boolean not null default false;
alter table expedicao_voos add column if not exists apenas_sem_extensao boolean not null default false;
