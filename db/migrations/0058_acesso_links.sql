-- 0058: Links curtos de 1º acesso ao ExpedAmigo (encurtador in-house).
-- Em vez de mandar a URL longa /amigo/acesso?t=<token gigante>, o onboarding gera
-- um CÓDIGO curto e manda /a/<codigo>. A rota /a/[codigo] resolve o passageiro,
-- gera o token de 1º acesso e redireciona pro /amigo/acesso.
create table if not exists acesso_links (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  passageiro_id uuid not null references passageiros(id) on delete cascade,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_acesso_links_codigo on acesso_links (codigo);

-- Só o service role acessa (nenhuma policy = anon/authenticated não leem;
-- as rotas usam service role, que ignora RLS).
alter table acesso_links enable row level security;
