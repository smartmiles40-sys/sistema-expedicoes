-- 0055_voo_por_grupo.sql
-- Voos de grupo podem ser específicos de um SUBGRUPO (G1/G2) da expedição.
-- Caso Tailândia 2026: uma expedição junta dois grupos que voam em voos DIFERENTES —
-- quem é G1 está num voo, quem é G2 está noutro. Com `grupo_id`:
--   null            → voo compartilhado (todos os passageiros veem)
--   <grupos_expedicao.id> → só quem é daquele grupo vê no portal.
-- on delete set null: apagar o grupo não apaga o voo, só o desvincula.

alter table expedicao_voos add column if not exists grupo_id uuid references grupos_expedicao(id) on delete set null;
create index if not exists idx_expedicao_voos_grupo on expedicao_voos(grupo_id);
