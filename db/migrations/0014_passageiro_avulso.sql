-- 0014 — Passageiro avulso (sem expedição)
-- Permite que uma pessoa exista na base operacional sem estar vinculada a
-- nenhuma expedição (cadastro avulso / "pool"). A linha `passageiros` passa a
-- aceitar expedicao_id = null; quando a pessoa é alocada a uma expedição, é
-- criada uma nova linha vinculada (a agregação por identidade junta as duas).
--
-- A FK continua: expedicao_id null simplesmente não referencia nada. O
-- `on delete cascade` segue valendo para as linhas que TÊM expedição.

alter table passageiros
  alter column expedicao_id drop not null;

-- Índice parcial para listar rapidamente os avulsos (sem expedição).
create index if not exists idx_passageiros_avulsos
  on passageiros (id)
  where expedicao_id is null;
