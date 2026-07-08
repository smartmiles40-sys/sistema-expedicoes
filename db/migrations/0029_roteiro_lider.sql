-- 0029_roteiro_lider.sql
-- Roteiro do Líder: resumo operacional dia a dia para os líderes da expedição.
-- Separado do roteiro do passageiro (roteiro_dias) — aqui entram programação,
-- líderes ativos, nº de pax, local e alertas operacionais (trocas de grupo,
-- logística de bagagem, aeroportos diferentes etc.).

-- Vínculo leve entre expedições irmãs que rodam juntas (ex.: Japão & China G1/G2):
alter table expedicoes add column if not exists viagem_grupo text;  -- rótulo compartilhado entre irmãs (ex.: "Japão & China 2026 Out/Nov")
alter table expedicoes add column if not exists grupo_rotulo text;   -- rótulo do grupo desta linha (ex.: "G1", "G2")

create table if not exists roteiro_lider_dias (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  dia int not null default 1,
  data date,                 -- data do dia (para o "hoje")
  fase text,                 -- região/etapa (ex.: "TÓQUIO", "OSAKA · KYOTO · HIROSHIMA")
  local text,                -- cidade/local do dia
  programacao text,          -- o que o grupo faz no dia
  lideres_ativos text,       -- líderes ativos no dia (nomes separados por " · ")
  pax text,                  -- nº de pax (texto: aceita "18 → 25")
  observacoes text,          -- observações operacionais
  alerta_nivel text,         -- null | 'Crítico' | 'Atenção' | 'Verificar'
  alerta_texto text,         -- descrição do alerta
  alerta_acao text,          -- ação necessária
  alerta_responsavel text,   -- responsável pela ação
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roteiro_lider_dias_exp on roteiro_lider_dias(expedicao_id, ordem);

drop trigger if exists tg_roteiro_lider_dias_updated_at on roteiro_lider_dias;
create trigger tg_roteiro_lider_dias_updated_at
  before update on roteiro_lider_dias for each row execute function set_updated_at();

-- RLS (mesmo padrão das tabelas do portal: autenticado lê e escreve)
alter table roteiro_lider_dias enable row level security;

drop policy if exists "roteiro_lider_dias: leitura autenticado" on roteiro_lider_dias;
create policy "roteiro_lider_dias: leitura autenticado" on roteiro_lider_dias
  for select to authenticated using (true);

drop policy if exists "roteiro_lider_dias: escrita autenticado" on roteiro_lider_dias;
create policy "roteiro_lider_dias: escrita autenticado" on roteiro_lider_dias
  for all to authenticated using (true) with check (true);
