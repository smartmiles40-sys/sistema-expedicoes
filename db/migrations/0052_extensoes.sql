-- 0052_extensoes.sql
-- Extensões da expedição: um subgrupo de passageiros que fica dias a mais
-- (destino/hotel/voos próprios) depois (ou antes) da expedição principal.
-- Uma expedição pode ter VÁRIAS extensões independentes (ex.: uns ficam no Mar
-- Vermelho, outros vão pra Alexandria). O CONTEÚDO (dias de roteiro e voos) é
-- amarrado à extensão; a CONTRATAÇÃO é marcada manualmente pelo operacional no
-- perfil do passageiro. No portal, dias/voos de extensão aparecem SÓ para quem
-- contratou — quem não fica vê a viagem idêntica à de hoje.
-- Mesmo padrão do 0044 (passeios opcionais): catálogo + junção presença=contratou.

-- ---------- Catálogo: extensões por expedição ----------
create table if not exists extensoes (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  nome text not null,                             -- ex.: "Extensão Mar Vermelho — +3 dias"
  descricao text,                                 -- bloco explicativo (topo da extensão no portal)
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_extensoes_exp on extensoes(expedicao_id, ordem);

drop trigger if exists tg_extensoes_updated_at on extensoes;
create trigger tg_extensoes_updated_at
  before update on extensoes for each row execute function set_updated_at();

-- ---------- Contratação: presença = passageiro contratou a extensão ----------
create table if not exists passageiro_extensao (
  id uuid primary key default gen_random_uuid(),
  passageiro_id uuid not null references passageiros(id) on delete cascade,
  extensao_id uuid not null references extensoes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (passageiro_id, extensao_id)
);
create index if not exists idx_pax_extensao_pax on passageiro_extensao(passageiro_id);
create index if not exists idx_pax_extensao_ext on passageiro_extensao(extensao_id);

-- ---------- Vínculo de conteúdo à extensão (null = grupo principal, todos veem) ----------
-- Um dia do roteiro ou um voo de grupo pertence ao grupo principal (null) ou a
-- uma extensão específica (só quem contratou vê). on delete set null: apagar a
-- extensão não apaga o dia/voo, só o desvincula (volta a ser do grupo principal).
alter table roteiro_dias   add column if not exists extensao_id uuid references extensoes(id) on delete set null;
alter table expedicao_voos add column if not exists extensao_id uuid references extensoes(id) on delete set null;
create index if not exists idx_roteiro_dias_extensao on roteiro_dias(extensao_id);
create index if not exists idx_expedicao_voos_extensao on expedicao_voos(extensao_id);

-- ---------- RLS: leitura + escrita para autenticado (refinar antes de prod) ----------
do $$
declare t text;
begin
  foreach t in array array['extensoes','passageiro_extensao']
  loop
    execute format('alter table %I enable row level security', t);
    begin
      execute format('create policy "%s: leitura autenticado" on %I for select to authenticated using (true)', t, t);
    exception when duplicate_object then null; end;
    begin
      execute format('create policy "%s: escrita autenticado" on %I for all to authenticated using (true) with check (true)', t, t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
