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
