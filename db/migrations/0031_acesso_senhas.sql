-- 0031_acesso_senhas.sql
-- Senha por pessoa (por CPF) para o ExpedAmigo e a Área do Líder.
-- 1º acesso usa a data de nascimento como senha; depois a pessoa cria a sua e o
-- hash fica aqui. Uma senha por CPF (serve para as duas áreas da mesma pessoa).
create table if not exists acesso_senhas (
  cpf text primary key,                 -- 11 dígitos
  senha_hash text not null,             -- hash da senha (nunca em texto)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table acesso_senhas enable row level security;
-- Sem policies públicas de propósito: só o service role (usado nas actions do
-- /amigo e /lider) acessa esta tabela de credenciais.

drop trigger if exists tg_acesso_senhas_updated_at on acesso_senhas;
create trigger tg_acesso_senhas_updated_at
  before update on acesso_senhas for each row execute function set_updated_at();
