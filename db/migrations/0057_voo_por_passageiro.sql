-- 0057_voo_por_passageiro.sql
-- Voo INDIVIDUAL de um passageiro (quando alguém emenda com outra viagem / voa
-- diferente do grupo e não dá pra usar o subgrupo G1/G2 — que é divisão real).
-- Quando um passageiro tem voo(s) próprio(s) numa expedição, o portal mostra SÓ os
-- dele e esconde os de grupo. Quem não tem voo próprio vê os de grupo normalmente.
alter table expedicao_voos
  add column if not exists passageiro_id uuid references passageiros(id) on delete cascade;

create index if not exists idx_expedicao_voos_passageiro on expedicao_voos(passageiro_id);

comment on column expedicao_voos.passageiro_id is
  'Voo individual (null = voo de grupo). Se o pax tem voo proprio, o portal mostra so os dele.';
