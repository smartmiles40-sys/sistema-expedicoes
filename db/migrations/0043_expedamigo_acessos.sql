-- 0043_expedamigo_acessos.sql
-- Log de acesso ao portal ExpedAmigo: quem (CPF) fez o quê (login / download de PDF /
-- abriu uma viagem) e quando. Minimalista de propósito — só CPF + evento + expedição +
-- data/hora (SEM IP/dispositivo), pra minimizar dado pessoal (LGPD).
create table if not exists expedamigo_acessos (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,                                   -- 11 dígitos
  evento text not null,                                -- 'login' | 'download_pdf' | 'viagem_aberta'
  expedicao_id uuid references expedicoes(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expedamigo_acessos_evento_chk') then
    alter table expedamigo_acessos
      add constraint expedamigo_acessos_evento_chk
      check (evento in ('login', 'download_pdf', 'viagem_aberta'));
  end if;
end $$;

create index if not exists idx_expedamigo_acessos_criado on expedamigo_acessos (created_at desc);
create index if not exists idx_expedamigo_acessos_cpf on expedamigo_acessos (cpf);

alter table expedamigo_acessos enable row level security;
-- Leitura pela tela do operacional (autenticado). Escrita do portal é via service role.
drop policy if exists "expedamigo_acessos: leitura autenticado" on expedamigo_acessos;
create policy "expedamigo_acessos: leitura autenticado" on expedamigo_acessos
  for select to authenticated using (true);
drop policy if exists "expedamigo_acessos: escrita autenticado" on expedamigo_acessos;
create policy "expedamigo_acessos: escrita autenticado" on expedamigo_acessos
  for all to authenticated using (true) with check (true);
