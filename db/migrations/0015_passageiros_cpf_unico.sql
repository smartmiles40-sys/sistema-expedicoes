-- 0015: CPF como chave anti-duplicação de passageiros dentro de uma expedição.
--
-- Impede fisicamente o mesmo CPF (ignorando pontuação: pontos/traço) aparecer
-- duas vezes na MESMA expedição. Mantém de propósito:
--   - a mesma pessoa em VÁRIAS expedições (uma linha por expedição) — ok;
--   - passageiros avulsos (expedicao_id null) e linhas sem CPF — não restringidos.
--
-- Idempotente (IF NOT EXISTS). Se falhar com "could not create unique index",
-- é porque já existem duplicados — rode antes a query de detecção do README/chat
-- e limpe os repetidos.

create unique index if not exists ux_passageiros_expedicao_cpf
  on passageiros (expedicao_id, regexp_replace(cpf, '\D', '', 'g'))
  where cpf is not null and expedicao_id is not null;

-- E no máximo UM avulso (sem expedição) por CPF — evita duplicar a pessoa na
-- base global. A pessoa ainda pode ter, além do avulso, linhas em expedições.
create unique index if not exists ux_passageiros_avulso_cpf
  on passageiros (regexp_replace(cpf, '\D', '', 'g'))
  where cpf is not null and expedicao_id is null;
