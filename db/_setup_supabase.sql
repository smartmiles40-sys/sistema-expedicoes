-- =============================================================================
-- SETUP CONSOLIDADO DO SUPABASE
-- Rode UMA vez, num projeto Supabase NOVO/VAZIO, no SQL Editor.
-- Gerado a partir de db/migrations (na ordem). NAO inclui o 0002_seed (demo).
-- =============================================================================

-- ============================== 0001_initial_schema ==============================
-- =============================================================================
-- Sistema Operacional de Expedições — Schema inicial
-- Agência: Se Tu For, Eu Vou
-- Postgres + Supabase Auth + RLS
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================
do $$ begin
  create type papel_usuario as enum ('admin','operacional','comercial','financeiro','leitura');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_fornecedor as enum ('DMC','Hotel','Guia','Aéreo','Receptivo','Seguro','Outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_fornecedor as enum ('Ativo','Pausado','Bloqueado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_expedicao as enum ('Planejamento','Vendas Abertas','Em andamento','Concluída','Cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_passageiro as enum ('Pagante','Cortesia','Líder');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_reserva as enum ('Lead','Pré-reserva','Confirmado','Cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_quarto as enum ('Single','Duplo','Twin','Triplo','Compartilhado','Líder');
exception when duplicate_object then null; end $$;

do $$ begin
  create type categoria_custo as enum ('Hotelaria','Aéreo','Terrestre','Ingressos','Guias','Seguro','Taxas','Brindes','Outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_custo as enum ('A programar','Programado','Pago','Parcial','Vencido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_pagamento as enum ('Pendente','Programado','Pago','Parcial','Vencido','Cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type etapa_checklist as enum ('Pós-venda','Pré-viagem','Operação','Pós-viagem');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_checklist as enum ('Pendente','Em andamento','Atenção','Concluído','Bloqueado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade as enum ('Baixa','Média','Alta','Crítica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type acao_audit as enum ('insert','update','delete');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- TABELAS
-- =============================================================================

-- usuarios — vinculada ao auth.users
create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nome text not null,
  papel papel_usuario not null default 'leitura',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- fornecedores
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_fornecedor not null,
  contato_nome text,
  contato_email text,
  contato_whatsapp text,
  destino_cidade text,
  servicos text[],
  moeda_padrao text not null default 'BRL',
  politica_pagamento text,
  status status_fornecedor not null default 'Ativo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fornecedores_tipo on fornecedores(tipo);
create index if not exists idx_fornecedores_status on fornecedores(status);

-- cambios
create table if not exists cambios (
  moeda text primary key,
  taxa_brl numeric(14,6) not null check (taxa_brl > 0),
  atualizado_em timestamptz not null default now()
);

-- expedicoes
create table if not exists expedicoes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  destino text not null,
  data_embarque date not null,
  data_retorno date not null,
  responsavel_operacional_id uuid references usuarios(id) on delete set null,
  responsavel_comercial_id uuid references usuarios(id) on delete set null,
  dmc_principal_id uuid references fornecedores(id) on delete set null,
  status status_expedicao not null default 'Planejamento',
  pax_planejados int not null default 0,
  pax_cortesia int not null default 0,
  preco_venda_brl numeric(14,2) not null default 0,
  bitrix_pipeline_id text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_retorno >= data_embarque)
);
create index if not exists idx_expedicoes_status on expedicoes(status);
create index if not exists idx_expedicoes_data_embarque on expedicoes(data_embarque);
create index if not exists idx_expedicoes_destino on expedicoes(destino);

-- quartos
create table if not exists quartos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  numero text not null,
  tipo tipo_quarto not null,
  hotel_cidade text,
  check_in date,
  check_out date,
  status text not null default 'Reservado',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_quartos_expedicao on quartos(expedicao_id);

-- passageiros
create table if not exists passageiros (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  bitrix_contact_id text,
  bitrix_deal_id text unique,
  nome_completo text not null,
  tipo tipo_passageiro not null default 'Pagante',
  cpf text,
  passaporte text,
  data_nascimento date,
  validade_passaporte date,
  email text,
  telefone text,
  status_reserva status_reserva not null default 'Lead',
  voo_nacional_necessario boolean not null default false,
  companhia_aerea text,
  localizador text,
  quarto_id uuid references quartos(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_passageiros_expedicao on passageiros(expedicao_id);
create index if not exists idx_passageiros_bitrix_deal on passageiros(bitrix_deal_id);
create index if not exists idx_passageiros_status on passageiros(status_reserva);

-- custos
create table if not exists custos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  categoria categoria_custo not null,
  servico text not null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  cidade text,
  data_servico date,
  moeda text not null default 'BRL',
  valor_planejado numeric(14,2) not null default 0,
  valor_realizado numeric(14,2),
  cambio_aplicado numeric(14,6),
  valor_planejado_brl numeric(14,2) generated always as
    (valor_planejado * coalesce(cambio_aplicado, 1)) stored,
  valor_realizado_brl numeric(14,2),
  status status_custo not null default 'A programar',
  pago_por uuid references usuarios(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_custos_expedicao on custos(expedicao_id);
create index if not exists idx_custos_categoria on custos(categoria);
create index if not exists idx_custos_status on custos(status);

-- pagamentos
create table if not exists pagamentos (
  id uuid primary key default gen_random_uuid(),
  custo_id uuid not null references custos(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  servico text not null,
  moeda text not null default 'BRL',
  valor_total numeric(14,2) not null default 0,
  entrada numeric(14,2) not null default 0,
  saldo numeric(14,2) generated always as (valor_total - entrada) stored,
  vencimento_saldo date,
  status status_pagamento not null default 'Pendente',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pagamentos_custo on pagamentos(custo_id);
create index if not exists idx_pagamentos_status on pagamentos(status);
create index if not exists idx_pagamentos_vencimento on pagamentos(vencimento_saldo);

-- checklist_itens
create table if not exists checklist_itens (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  etapa etapa_checklist not null,
  tarefa text not null,
  responsavel_id uuid references usuarios(id) on delete set null,
  status status_checklist not null default 'Pendente',
  prazo date,
  prioridade prioridade not null default 'Média',
  dependencia_id uuid references checklist_itens(id) on delete set null,
  evidencia_url text,
  bitrix_task_id text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_checklist_expedicao on checklist_itens(expedicao_id);
create index if not exists idx_checklist_status on checklist_itens(status);

-- documentos
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  passageiro_id uuid not null references passageiros(id) on delete cascade,
  visto_necessario boolean not null default false,
  status_visto text not null default 'Não necessário',
  seguro_status text not null default 'Pendente',
  apolice_url text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_documentos_passageiro on documentos(passageiro_id);

-- audit_log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  usuario_id uuid references usuarios(id) on delete set null,
  acao acao_audit not null,
  dados_antes jsonb,
  dados_depois jsonb,
  origem text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_tabela_registro on audit_log(tabela, registro_id);
create index if not exists idx_audit_created_at on audit_log(created_at desc);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at automático
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$ declare t text;
begin
  for t in
    select unnest(array[
      'usuarios','fornecedores','expedicoes','quartos','passageiros',
      'custos','pagamentos','checklist_itens','documentos'
    ])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s; ' ||
      'create trigger trg_%1$s_updated_at before update on %1$s ' ||
      'for each row execute function set_updated_at();',
      t
    );
  end loop;
end $$;

-- audit log para tabelas críticas
create or replace function audit_change() returns trigger
language plpgsql security definer as $$
declare
  v_user uuid;
begin
  begin
    v_user := auth.uid();
  exception when others then
    v_user := null;
  end;

  if (tg_op = 'INSERT') then
    insert into audit_log(tabela, registro_id, usuario_id, acao, dados_depois)
      values (tg_table_name, new.id, v_user, 'insert', to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into audit_log(tabela, registro_id, usuario_id, acao, dados_antes, dados_depois)
      values (tg_table_name, new.id, v_user, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit_log(tabela, registro_id, usuario_id, acao, dados_antes)
      values (tg_table_name, old.id, v_user, 'delete', to_jsonb(old));
    return old;
  end if;
  return null;
end $$;

do $$ declare t text;
begin
  for t in select unnest(array['expedicoes','passageiros','custos','pagamentos'])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_audit on %1$s; ' ||
      'create trigger trg_%1$s_audit after insert or update or delete on %1$s ' ||
      'for each row execute function audit_change();',
      t
    );
  end loop;
end $$;

-- =============================================================================
-- RLS — políticas iniciais permissivas (autenticado pode tudo)
-- TODO: restringir por papel antes de prod
-- =============================================================================

alter table usuarios enable row level security;
alter table fornecedores enable row level security;
alter table cambios enable row level security;
alter table expedicoes enable row level security;
alter table quartos enable row level security;
alter table passageiros enable row level security;
alter table custos enable row level security;
alter table pagamentos enable row level security;
alter table checklist_itens enable row level security;
alter table documentos enable row level security;
alter table audit_log enable row level security;

do $$ declare t text;
begin
  for t in
    select unnest(array[
      'usuarios','fornecedores','cambios','expedicoes','quartos',
      'passageiros','custos','pagamentos','checklist_itens','documentos','audit_log'
    ])
  loop
    execute format('drop policy if exists "auth_all_select" on %1$s', t);
    execute format('create policy "auth_all_select" on %1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "auth_all_insert" on %1$s', t);
    execute format('create policy "auth_all_insert" on %1$s for insert to authenticated with check (true)', t);
    execute format('drop policy if exists "auth_all_update" on %1$s', t);
    execute format('create policy "auth_all_update" on %1$s for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists "auth_all_delete" on %1$s', t);
    execute format('create policy "auth_all_delete" on %1$s for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ============================== 0003_grupos_expedicao ==============================
-- =============================================================================
-- Migration: subgrupos dentro de uma expedição (G1, G2, G3...)
-- Contexto: algumas expedições rodam em datas próximas com grupos diferentes.
-- Antes virava expedição separada (TAI1-2026-11 e TAI2-2026-11). Agora pode
-- ser UMA expedição "Tailândia 2026" com vários grupos.
-- =============================================================================

create table if not exists grupos_expedicao (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  nome text not null,
  data_embarque date,
  data_retorno date,
  pax_planejados int not null default 0,
  observacoes text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expedicao_id, nome),
  check (data_retorno is null or data_embarque is null or data_retorno >= data_embarque)
);

create index if not exists idx_grupos_expedicao_id on grupos_expedicao(expedicao_id);

-- Trigger updated_at
drop trigger if exists tg_grupos_expedicao_updated_at on grupos_expedicao;
create trigger tg_grupos_expedicao_updated_at
  before update on grupos_expedicao
  for each row execute function set_updated_at();

-- Passageiros agora podem (opcionalmente) pertencer a um grupo da expedição
alter table passageiros
  add column if not exists grupo_id uuid references grupos_expedicao(id) on delete set null;

create index if not exists idx_passageiros_grupo on passageiros(grupo_id);

-- RLS
alter table grupos_expedicao enable row level security;

do $$ begin
  create policy "grupos: leitura autenticado" on grupos_expedicao for select
    to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "grupos: escrita autenticado" on grupos_expedicao for all
    to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ============================== 0004_expedicoes_ordem ==============================
-- Coluna `ordem` pra reordenação manual via drag-and-drop na lista de expedições.
-- Nullable: registros antigos ficam null; ORDER BY trata null como último.

alter table expedicoes
  add column if not exists ordem int;

create index if not exists idx_expedicoes_ordem on expedicoes(ordem);

-- ============================== 0005_arquivos ==============================
-- =============================================================================
-- Arquivos: drive pra anexar apólices, bilhetes, documentos pessoais.
-- Pode ser por expedição (categoria) OU por passageiro específico.
-- Os arquivos físicos ficam no Supabase Storage (bucket "arquivos-expedicoes").
-- =============================================================================

do $$ begin
  create type categoria_arquivo as enum (
    'Aéreos',
    'Documentos pessoais',
    'Bilhetes',
    'Vistos',
    'Seguros',
    'Hospedagem',
    'Vouchers',
    'Outros'
  );
exception when duplicate_object then null; end $$;

create table if not exists arquivos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  passageiro_id uuid references passageiros(id) on delete cascade,
  categoria categoria_arquivo not null default 'Outros',
  nome text not null,
  descricao text,
  mime text,
  tamanho_bytes bigint,
  storage_path text not null unique,
  uploaded_by uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_arquivos_expedicao on arquivos(expedicao_id);
create index if not exists idx_arquivos_passageiro on arquivos(passageiro_id);
create index if not exists idx_arquivos_categoria on arquivos(categoria);

drop trigger if exists tg_arquivos_updated_at on arquivos;
create trigger tg_arquivos_updated_at
  before update on arquivos
  for each row execute function set_updated_at();

alter table arquivos enable row level security;

do $$ begin
  create policy "arquivos: leitura autenticado" on arquivos for select
    to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "arquivos: escrita autenticado" on arquivos for all
    to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ============================== 0006_realtime ==============================
-- =============================================================================
-- Realtime: adiciona tabelas operacionais à publicação `supabase_realtime`
-- pra que mudanças (INSERT/UPDATE/DELETE) sejam transmitidas pros clients
-- conectados via Supabase Realtime.
--
-- REPLICA IDENTITY FULL garante que payloads de DELETE/UPDATE incluam a
-- linha inteira (não só a PK), o que facilita o cliente decidir o que fazer.
-- Custo: WAL um pouco maior. Aceitável pra o volume da agência.
-- =============================================================================

-- Garante que a publication existe (default no Supabase, mas seguro).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Helper: adiciona tabela à publication se ainda não estiver.
do $$
declare
  t text;
  tabelas text[] := array[
    'expedicoes',
    'passageiros',
    'quartos',
    'custos',
    'pagamentos',
    'checklist_itens',
    'fornecedores',
    'cambios',
    'documentos',
    'arquivos',
    'usuarios',
    'grupos_expedicao'
  ];
begin
  foreach t in array tabelas loop
    -- Skip se a tabela não existir (defensivo).
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      raise notice 'Tabela public.% não existe, pulando', t;
      continue;
    end if;

    -- Adiciona à publication se ainda não foi.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    -- REPLICA IDENTITY FULL: payload completo em DELETE/UPDATE.
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ============================== 0007_realtime_anon_select_dev ==============================
-- =============================================================================
-- DEV ONLY — Policies de SELECT pra role `anon`.
--
-- Por que existe: o Supabase Realtime aplica RLS sobre quem pode receber
-- eventos. Como o app atualmente roda com `DEV_AUTH_BYPASS=true` (cliente
-- browser não loga, fica como `anon`), sem essas policies o anon não passa
-- pela RLS e os eventos não chegam.
--
-- Em produção (login obrigatório, RLS por papel): apague essas policies com:
--
--   do $$ declare t text;
--   tabelas text[] := array[
--     'expedicoes','passageiros','quartos','custos','pagamentos',
--     'checklist_itens','fornecedores','cambios','documentos','arquivos',
--     'usuarios','grupos_expedicao'];
--   begin foreach t in array tabelas loop
--     execute format('drop policy if exists "anon_read_dev" on public.%I', t);
--   end loop; end $$;
--
-- =============================================================================

do $$
declare
  t text;
  tabelas text[] := array[
    'expedicoes',
    'passageiros',
    'quartos',
    'custos',
    'pagamentos',
    'checklist_itens',
    'fornecedores',
    'cambios',
    'documentos',
    'arquivos',
    'usuarios',
    'grupos_expedicao'
  ];
begin
  foreach t in array tabelas loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      continue;
    end if;
    -- Policy idempotente: drop + create.
    execute format('drop policy if exists "anon_read_dev" on public.%I', t);
    execute format(
      'create policy "anon_read_dev" on public.%I for select to anon using (true)',
      t
    );
  end loop;
end $$;

-- ============================== 0008_links_expedicao ==============================
-- =============================================================================
-- Links da expedição: refs externas (apresentação, LP, planilha, etc.)
-- Cada expedição pode ter N links com label + url livres.
-- =============================================================================

create table if not exists links_expedicao (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  label text not null,
  url text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_links_expedicao on links_expedicao(expedicao_id);
create index if not exists idx_links_expedicao_ordem on links_expedicao(expedicao_id, ordem);

drop trigger if exists tg_links_expedicao_updated_at on links_expedicao;
create trigger tg_links_expedicao_updated_at
  before update on links_expedicao
  for each row execute function set_updated_at();

alter table links_expedicao enable row level security;

do $$ begin
  create policy "links_expedicao: leitura autenticado" on links_expedicao for select
    to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "links_expedicao: escrita autenticado" on links_expedicao for all
    to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Realtime: adiciona à publication e REPLICA IDENTITY FULL
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'links_expedicao'
  ) then
    execute 'alter publication supabase_realtime add table public.links_expedicao';
  end if;
  execute 'alter table public.links_expedicao replica identity full';
end $$;

-- Policy anon SELECT (DEV — vide REALTIME_SETUP.sql)
do $$ begin
  drop policy if exists "anon_read_dev" on public.links_expedicao;
  create policy "anon_read_dev" on public.links_expedicao for select
    to anon using (true);
end $$;

-- ============================== 0009_checklist_processos ==============================
-- 0009 — Alinha o checklist ao SOP real da agência (ClickUp "Processos - Expedição").
-- Troca as 4 etapas genéricas pelas 5 fases por ANTECEDÊNCIA ao embarque (+ Pós-viagem)
-- e adiciona suporte a subtarefas (parent_id) e ordenação (ordem).

-- 1) Novo enum de fases. Recria o tipo porque os valores antigos não têm
--    correspondência 1:1 com os novos (mudança de modelo, não renomeação).
alter table checklist_itens alter column etapa type text;

drop type if exists etapa_checklist;
create type etapa_checklist as enum (
  'Após o fechamento',
  '12 a 6 meses',
  '6 a 2 meses',
  '2 meses a 15 dias',
  'Na semana',
  'Pós-viagem'
);

-- 2) Mapeia os valores antigos pros novos antes de reconverter o tipo.
update checklist_itens set etapa = case etapa
  when 'Pós-venda'  then 'Após o fechamento'
  when 'Pré-viagem' then '6 a 2 meses'
  when 'Operação'   then 'Na semana'
  when 'Pós-viagem' then 'Pós-viagem'
  else 'Após o fechamento'
end;

alter table checklist_itens
  alter column etapa type etapa_checklist using etapa::etapa_checklist;

-- 3) Subtarefas + ordenação.
alter table checklist_itens
  add column if not exists parent_id uuid references checklist_itens(id) on delete cascade,
  add column if not exists ordem int not null default 0;

create index if not exists idx_checklist_parent on checklist_itens(parent_id);
create index if not exists idx_checklist_etapa on checklist_itens(expedicao_id, etapa, ordem);

-- ============================== 0010_prontidao_embarque ==============================
-- 0010 — Motor de Prontidão para Embarque.
-- Responde "este passageiro pode embarcar?" de forma CALCULADA, não digitada.
--
-- Modelo (espelha o motor de processos do P8: catálogo + instâncias + status):
--   requisitos_destino     → o QUE cada destino exige (catálogo, 1x por destino)
--   passageiro_requisitos  → o STATUS de cada exigência por passageiro
--   passageiros (+campos)  → financeiro espelhado do Bitrix + dados pessoais
--   vw_prontidao_passageiro→ semáforo Apto / Atenção / Bloqueado por pax
--
-- A regra fina (janela de 6 meses do passaporte, fase atual) também vive no TS
-- em lib/prontidao/regras.ts — a view é a fonte pro dashboard quando o Supabase
-- estiver conectado; o mock usa o TS. As duas implementam a MESMA lógica.

-- =============================================================================
-- ENUMS
-- =============================================================================
do $$ begin
  create type tipo_requisito as enum (
    'Passaporte','RG','Visto','Vacina','Seguro',
    'Aéreo Internacional','Aéreo Doméstico','Contrato',
    'Autorização de Menor','Pagamento','Dados Pessoais'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type obrigatoriedade as enum ('Obrigatório','Condicional','Recomendado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_requisito as enum (
    'Pendente','Em análise','Enviado','Aprovado','Vencido','Dispensado','Reprovado'
  );
exception when duplicate_object then null; end $$;

-- =============================================================================
-- CATÁLOGO — o que cada destino exige
-- =============================================================================
create table if not exists requisitos_destino (
  id uuid primary key default gen_random_uuid(),
  destino text not null,                         -- casa com expedicoes.destino
  tipo tipo_requisito not null,
  descricao text not null,                       -- "Passaporte válido 6m após o retorno"
  obrigatoriedade obrigatoriedade not null default 'Obrigatório',
  bloqueia_embarque boolean not null default true,
  meses_validade_minima int,                     -- 6 → regra do passaporte; null = não se aplica
  papel_responsavel papel_usuario,               -- responsável padrão ao instanciar
  ordem int not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (destino, tipo)
);
create index if not exists idx_requisitos_destino_destino on requisitos_destino(destino);

-- =============================================================================
-- INSTÂNCIAS — status de cada exigência por passageiro
-- =============================================================================
create table if not exists passageiro_requisitos (
  id uuid primary key default gen_random_uuid(),
  passageiro_id uuid not null references passageiros(id) on delete cascade,
  tipo tipo_requisito not null,
  descricao text not null,
  status status_requisito not null default 'Pendente',
  obrigatoriedade obrigatoriedade not null default 'Obrigatório',
  bloqueia_embarque boolean not null default true,
  validade date,                                 -- passaporte, visto, seguro, vacina
  numero text,                                   -- nº apólice / localizador / nº visto
  arquivo_id uuid references arquivos(id) on delete set null,   -- evidência anexada
  responsavel_id uuid references usuarios(id) on delete set null,
  verificado_em timestamptz,
  verificado_por uuid references usuarios(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (passageiro_id, tipo)
);
create index if not exists idx_preq_passageiro on passageiro_requisitos(passageiro_id);
create index if not exists idx_preq_tipo on passageiro_requisitos(tipo);
create index if not exists idx_preq_status on passageiro_requisitos(status);

-- =============================================================================
-- PASSAGEIROS — financeiro espelhado do Bitrix + dados pessoais/embarque
-- =============================================================================
alter table passageiros
  add column if not exists valor_contratado_brl numeric(14,2) not null default 0,
  add column if not exists valor_pago_brl       numeric(14,2) not null default 0,
  add column if not exists saldo_brl numeric(14,2)
    generated always as (valor_contratado_brl - valor_pago_brl) stored,
  add column if not exists status_financeiro    text not null default 'Em aberto',
  add column if not exists contato_emergencia_nome text,
  add column if not exists contato_emergencia_fone text,
  add column if not exists restricoes_alimentares  text,
  add column if not exists condicoes_medicas        text,
  add column if not exists contrato_assinado   boolean not null default false,
  add column if not exists checkin_online_feito boolean not null default false;

-- =============================================================================
-- VIEW — semáforo de prontidão por passageiro
-- =============================================================================
create or replace view vw_prontidao_passageiro as
with req as (
  select
    pr.passageiro_id,
    -- bloqueio: requisito obrigatório-bloqueante não resolvido OU documento
    -- cuja validade não cobre o retorno
    count(*) filter (
      where pr.bloqueia_embarque
        and not (
          pr.status in ('Aprovado','Dispensado')
          and (pr.validade is null or pr.validade >= e.data_retorno)
        )
    ) as bloqueios_abertos,
    -- pendência leve: não-bloqueante ainda não resolvida
    count(*) filter (
      where not pr.bloqueia_embarque
        and pr.status not in ('Aprovado','Dispensado')
    ) as pendencias_leves,
    -- passaporte na janela de alerta (válido pro retorno, mas vence em < 6 meses)
    count(*) filter (
      where pr.tipo = 'Passaporte'
        and pr.validade is not null
        and pr.validade >= e.data_retorno
        and pr.validade < (e.data_retorno + interval '6 months')
    ) as passaporte_em_alerta
  from passageiro_requisitos pr
  join passageiros p on p.id = pr.passageiro_id
  join expedicoes  e on e.id = p.expedicao_id
  group by pr.passageiro_id
)
select
  p.id                              as passageiro_id,
  p.expedicao_id,
  p.nome_completo,
  e.data_embarque,
  e.data_retorno,
  (e.data_embarque - current_date)  as dias_ate_embarque,
  coalesce(r.bloqueios_abertos, 0)  as bloqueios_abertos,
  coalesce(r.pendencias_leves, 0)   as pendencias_leves,
  coalesce(r.passaporte_em_alerta, 0) as passaporte_em_alerta,
  (p.saldo_brl > 0)                 as tem_saldo,
  case
    when coalesce(r.bloqueios_abertos, 0) > 0 then 'Bloqueado'
    -- saldo em aberto vira bloqueio na reta final (≤ 15 dias do embarque)
    when p.saldo_brl > 0 and (e.data_embarque - current_date) <= 15 then 'Bloqueado'
    when coalesce(r.passaporte_em_alerta, 0) > 0
      or coalesce(r.pendencias_leves, 0) > 0
      or p.saldo_brl > 0 then 'Atenção'
    else 'Apto'
  end                               as prontidao
from passageiros p
join expedicoes e on e.id = p.expedicao_id
left join req r on r.passageiro_id = p.id;

-- =============================================================================
-- TRIGGERS — updated_at + auditoria (reusa funções da 0001)
-- =============================================================================
do $$ declare t text;
begin
  for t in select unnest(array['requisitos_destino','passageiro_requisitos'])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s; ' ||
      'create trigger trg_%1$s_updated_at before update on %1$s ' ||
      'for each row execute function set_updated_at();',
      t
    );
  end loop;
end $$;

drop trigger if exists trg_passageiro_requisitos_audit on passageiro_requisitos;
create trigger trg_passageiro_requisitos_audit
  after insert or update or delete on passageiro_requisitos
  for each row execute function audit_change();

-- =============================================================================
-- RLS — permissivo (autenticado pode tudo), refinar antes de prod
-- =============================================================================
alter table requisitos_destino enable row level security;
alter table passageiro_requisitos enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['requisitos_destino','passageiro_requisitos'])
  loop
    execute format('drop policy if exists "auth_all_select" on %1$s', t);
    execute format('create policy "auth_all_select" on %1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "auth_all_insert" on %1$s', t);
    execute format('create policy "auth_all_insert" on %1$s for insert to authenticated with check (true)', t);
    execute format('drop policy if exists "auth_all_update" on %1$s', t);
    execute format('create policy "auth_all_update" on %1$s for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists "auth_all_delete" on %1$s', t);
    execute format('create policy "auth_all_delete" on %1$s for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ============================== 0011_seed_requisitos_destino ==============================
-- 0011 — Seed do catálogo de requisitos por destino.
-- Espelha lib/prontidao/requisitos-destino.ts. Idempotente: unique (destino,tipo).
-- A base internacional vale para todos os destinos operados; extras por destino
-- (visto, vacina, RG, voo doméstico) são adicionados depois.

-- Base internacional aplicada a cada destino via cross join.
insert into requisitos_destino
  (destino, tipo, descricao, obrigatoriedade, bloqueia_embarque, meses_validade_minima, papel_responsavel, ordem)
select d.destino, b.tipo::tipo_requisito, b.descricao, b.obrig::obrigatoriedade,
       b.bloqueia, b.meses, b.papel::papel_usuario, b.ordem
from (values ('Peru'),('Argentina'),('Chile'),('Japão'),('Egito'),('Itália')) as d(destino)
cross join (values
  ('Passaporte',          'Passaporte válido por ao menos 6 meses após o retorno', 'Obrigatório', true,  6,           'operacional', 1),
  ('Dados Pessoais',      'Cadastro completo (CPF, nascimento, contato)',          'Obrigatório', true,  null::int,   'operacional', 2),
  ('Contrato',            'Contrato assinado',                                     'Obrigatório', true,  null::int,   'comercial',   3),
  ('Pagamento',           'Saldo quitado antes do embarque',                       'Obrigatório', true,  null::int,   'financeiro',  4),
  ('Seguro',              'Seguro viagem emitido cobrindo todo o período',         'Obrigatório', true,  null::int,   'comercial',   5),
  ('Aéreo Internacional', 'Bilhete internacional emitido (localizador)',           'Obrigatório', true,  null::int,   'operacional', 6)
) as b(tipo, descricao, obrig, bloqueia, meses, papel, ordem)
on conflict (destino, tipo) do nothing;

-- Extras por destino.
insert into requisitos_destino
  (destino, tipo, descricao, obrigatoriedade, bloqueia_embarque, meses_validade_minima, papel_responsavel, ordem, observacoes)
values
  -- Peru
  ('Peru','Vacina','Certificado Internacional de Vacinação (febre amarela)','Condicional',true,null,'operacional',7,'Recomendada para selva/Machu Picchu; conferir exigência.'),
  ('Peru','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Argentina
  ('Argentina','RG','RG válido (≤ 10 anos) — alternativa ao passaporte no Mercosul','Recomendado',false,null,'operacional',7,null),
  ('Argentina','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Chile
  ('Chile','RG','RG válido (≤ 10 anos) — alternativa ao passaporte no Mercosul','Recomendado',false,null,'operacional',7,null),
  ('Chile','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Japão
  ('Japão','Visto','Visto de turismo (confirmar isenção vigente para BR)','Condicional',true,null,'operacional',7,'Verificar regra de isenção atual antes de instanciar como obrigatório.'),
  ('Japão','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Egito
  ('Egito','Visto','Visto do Egito (e-visa ou on arrival)','Obrigatório',true,null,'operacional',7,null),
  ('Egito','Vacina','Certificado Internacional de Vacinação (febre amarela)','Condicional',true,null,'operacional',8,'Exigível conforme regiões visitadas / país de origem.'),
  ('Egito','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',9,null),
  -- Itália / Schengen
  ('Itália','Visto','Autorização ETIAS (quando exigível) — Schengen','Recomendado',false,null,'operacional',7,'ETIAS para isentos de visto; confirmar data de entrada em vigor.')
on conflict (destino, tipo) do nothing;

-- ============================== 0012_prontidao_automacao ==============================
-- 0012 — Automação da prontidão: job diário de validade + realtime.

-- =============================================================================
-- Função: marca como "Vencido" todo requisito cuja validade não cobre o retorno.
-- Idempotente; devolve quantas linhas mudaram. Chamável manualmente ou via cron.
-- =============================================================================
create or replace function prontidao_marcar_vencidos() returns integer
language plpgsql as $$
declare
  n integer;
begin
  with alvo as (
    select pr.id
    from passageiro_requisitos pr
    join passageiros p on p.id = pr.passageiro_id
    join expedicoes  e on e.id = p.expedicao_id
    where pr.validade is not null
      and pr.validade < e.data_retorno
      and pr.status not in ('Vencido', 'Dispensado', 'Reprovado')
  )
  update passageiro_requisitos
     set status = 'Vencido', updated_at = now()
   where id in (select id from alvo);
  get diagnostics n = row_count;
  return n;
end $$;

-- =============================================================================
-- Agendamento diário (06:00) via pg_cron — só se a extensão existir.
-- No Supabase: habilitar pg_cron em Database > Extensions.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'prontidao-marcar-vencidos') then
      perform cron.unschedule('prontidao-marcar-vencidos');
    end if;
    perform cron.schedule(
      'prontidao-marcar-vencidos',
      '0 6 * * *',
      $cron$ select prontidao_marcar_vencidos(); $cron$
    );
  else
    raise notice 'pg_cron não instalado — rode prontidao_marcar_vencidos() por outro agendador.';
  end if;
end $$;

-- =============================================================================
-- Realtime: transmite mudanças das tabelas de prontidão pros clients conectados.
-- =============================================================================
do $$
declare
  t text;
  tabelas text[] := array['requisitos_destino', 'passageiro_requisitos'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array tabelas loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ============================== 0013_realtime_prontidao ==============================
-- =============================================================================
-- 0013 — Realtime para as tabelas de Prontidão (P9)
-- -----------------------------------------------------------------------------
-- requisitos_destino e passageiro_requisitos foram criadas na 0010, depois do
-- setup de realtime (0006/0007), então ficaram sem replicação. Aqui entram na
-- publication + REPLICA IDENTITY FULL e ganham SELECT pra anon (modo dev), pra
-- que mudanças de requisito (semáforo de prontidão) também atualizem em tempo
-- real na tela dos outros usuários.
-- Idempotente.
-- =============================================================================
do $$
declare
  t text;
  tabelas text[] := array['requisitos_destino', 'passageiro_requisitos'];
begin
  -- Garante a publication (caso a 0006 não tenha rodado ainda).
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tabelas loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      raise notice 'Tabela public.% não existe, pulando', t;
      continue;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    execute format('alter table public.%I replica identity full', t);

    -- SELECT pra anon (DEV apenas — remover em produção com login real).
    execute format('drop policy if exists "anon_read_dev" on public.%I', t);
    execute format(
      'create policy "anon_read_dev" on public.%I for select to anon using (true)', t
    );
  end loop;
end $$;

-- ============================== 0014_passageiro_avulso ==============================
-- 0014 — Passageiro avulso (sem expedição)
-- Permite que uma pessoa exista na base operacional sem estar vinculada a
-- nenhuma expedição (cadastro avulso / "pool"). A linha `passageiros` passa a
-- aceitar expedicao_id = null; quando a pessoa é alocada a uma expedição, é
-- criada uma nova linha vinculada (a agregação por identidade junta as duas).
--
-- A FK continua: expedicao_id null simplesmente não referencia nada. O
-- `on delete cascade` segue valendo para as linhas que TÊM expedição.

alter table passageiros
  alter column expedicao_id drop not null;

-- Índice parcial para listar rapidamente os avulsos (sem expedição).
create index if not exists idx_passageiros_avulsos
  on passageiros (id)
  where expedicao_id is null;

