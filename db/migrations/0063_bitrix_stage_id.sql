-- Etapa do Bitrix por expedição (STAGE_ID completo, ex. "C29:UC_F6M93I").
--
-- Usado pela sincronização de passageiros: o app manda `stage_id` + `category_id`
-- (derivada do prefixo "C<cat>:") pro webhook único do n8n, que filtra os deals
-- daquela coluna. Com isso o de-para hardcoded sai do n8n e passa a viver no
-- sistema — vale pra QUALQUER expedição futura (2027/2028+) só preenchendo aqui.
alter table expedicoes add column if not exists bitrix_stage_id text;

comment on column expedicoes.bitrix_stage_id is
  'STAGE_ID completo do Bitrix (ex. C29:UC_F6M93I). Alimenta a sync de passageiros via n8n.';
