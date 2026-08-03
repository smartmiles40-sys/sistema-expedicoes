-- 0047_inscricoes_decisoes.sql
-- Log de decisões sobre inscrições: registra QUEM aprovou / recusou / restaurou /
-- excluiu cada inscrição, com data/hora e (na recusa) o motivo. Só admin visualiza
-- (gate no app). Escrito pelas server actions com service role (bypassa RLS).

create table if not exists inscricoes_decisoes (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid references expedicoes(id) on delete set null,
  cpf text,
  nome_completo text,
  acao text not null check (acao in ('aprovada','recusada','restaurada','excluida')),
  motivo text,                                  -- preenchido na recusa
  decidido_por uuid references usuarios(id) on delete set null,
  decidido_por_nome text,                       -- snapshot do nome de quem decidiu
  created_at timestamptz not null default now()
);
create index if not exists idx_insc_decisoes_created on inscricoes_decisoes(created_at desc);

-- RLS: leitura para autenticado (a UI restringe a admin). Escrita só via service role.
alter table inscricoes_decisoes enable row level security;
do $$ begin
  create policy "insc_decisoes: leitura autenticado" on inscricoes_decisoes
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
