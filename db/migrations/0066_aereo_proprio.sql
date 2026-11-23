-- 0066: aéreo próprio do passageiro (não comprou o aéreo com a agência).
-- Quando true, os voos de GRUPO não aparecem pra esse passageiro no portal do ExpedAmigo
-- (ele voa por conta própria). Voos individuais atribuídos a ele continuam aparecendo.
alter table passageiros
  add column if not exists aereo_proprio boolean not null default false;

comment on column passageiros.aereo_proprio is
  'true = passageiro comprou o próprio aéreo (não com a agência); esconde os voos de grupo no portal.';
