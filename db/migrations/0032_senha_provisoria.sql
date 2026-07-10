-- 0032_senha_provisoria.sql
-- Primeiro acesso com senha provisória (login OPERACIONAL — equipe da agência).
-- O admin cria a conta no Supabase Auth com uma senha provisória; no 1º login o
-- sistema OBRIGA o usuário a definir a própria senha antes de usar o app. A flag
-- `senha_provisoria` marca esse estado. (Renumerada de 0031 → 0032 por colisão com
-- 0031_acesso_senhas.sql, que é outra feature — senha por CPF do /amigo e /lider.)
--
-- Regras:
--   • Toda linha NOVA em `usuarios` (criada no 1º login por getCurrentUser) nasce
--     provisória (default true) → é forçada a trocar a senha.
--   • Usuários que JÁ existem hoje já definiram/usam a senha atual → não são forçados
--     (backfill para false).

alter table usuarios
  add column if not exists senha_provisoria boolean not null default true;

-- Backfill: contas existentes não passam pela troca forçada.
update usuarios set senha_provisoria = false;
