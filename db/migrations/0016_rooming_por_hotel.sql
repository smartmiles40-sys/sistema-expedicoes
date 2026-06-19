-- 0016: rooming multi-hotel — alocação M2M passageiro↔quarto.
--
-- Antes, cada passageiro tinha 1 quarto (passageiros.quarto_id). Agora um
-- passageiro pode ter 1 quarto por hotel/trecho, então a alocação vira uma
-- tabela de ligação. A coluna quarto_id fica como legada (não usada pelo
-- rooming novo); pode ser removida numa migração futura.
--
-- ⚠️ Rodar no SQL Editor do Supabase ao publicar a feature de rooming.

create table if not exists passageiro_quarto (
  id uuid primary key default gen_random_uuid(),
  passageiro_id uuid not null references passageiros(id) on delete cascade,
  quarto_id uuid not null references quartos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (passageiro_id, quarto_id)
);
create index if not exists idx_pq_quarto on passageiro_quarto(quarto_id);
create index if not exists idx_pq_passageiro on passageiro_quarto(passageiro_id);

-- Migra as alocações existentes da coluna legada quarto_id.
insert into passageiro_quarto (passageiro_id, quarto_id)
  select id, quarto_id from passageiros where quarto_id is not null
on conflict (passageiro_id, quarto_id) do nothing;

-- RLS permissiva (mesmo padrão das demais tabelas; refinar no hardening).
alter table passageiro_quarto enable row level security;
do $$ begin
  create policy "auth_all_select" on passageiro_quarto for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth_all_insert" on passageiro_quarto for insert to anon, authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth_all_delete" on passageiro_quarto for delete to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
