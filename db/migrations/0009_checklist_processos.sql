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
