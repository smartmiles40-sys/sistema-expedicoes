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
