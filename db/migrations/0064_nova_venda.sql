-- "Novas vendas": passageiro que veio NOVO da sincronização do Bitrix (venda nova)
-- e ainda não foi triado pelo operacional.
--
-- A sync (upsertPassageiroBitrix) marca `nova_venda = true` ao CRIAR a linha (deal
-- que não existia). A tela /novas-vendas lista os `true`; "marcar como vista" zera.
alter table passageiros add column if not exists nova_venda boolean not null default false;
create index if not exists idx_passageiros_nova_venda on passageiros (nova_venda) where nova_venda;

comment on column passageiros.nova_venda is
  'true = veio novo da sync do Bitrix (venda nova), aguardando triagem em /novas-vendas.';
