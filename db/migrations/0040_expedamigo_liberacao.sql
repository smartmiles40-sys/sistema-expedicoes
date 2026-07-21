-- 0040_expedamigo_liberacao.sql
-- Liberação do ExpedAmigo pelo operacional + senha inicial aleatória.
--
-- - `passageiros.liberado_expedamigo`: a expedição só aparece no portal do viajante
--   quando o operacional libera. A 1ª liberação de uma PESSOA gera a senha (onboarding);
--   depois disso, novas expedições dela entram auto-liberadas (ver materializarInscricao).
-- - `acesso_senhas.senha_provisoria`: senha inicial ALEATÓRIA, guardada legível pra o
--   admin ver e repassar ao viajante. Some quando o viajante cria a própria (vira hash).
-- - `acesso_senhas.senha_hash` passa a aceitar NULO (linha pode existir só com a provisória,
--   antes de o viajante trocar). A senha por data de nascimento foi removida do código.
alter table passageiros
  add column if not exists liberado_expedamigo boolean not null default false;

alter table acesso_senhas
  add column if not exists senha_provisoria text;

alter table acesso_senhas
  alter column senha_hash drop not null;
