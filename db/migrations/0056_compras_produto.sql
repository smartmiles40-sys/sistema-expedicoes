-- 0056_compras_produto.sql
-- "Nome real" do que foi comprado (expedição/pacote), vindo do Bitrix via n8n.
-- O título do deal é genérico ("Negócio #NNN"); este campo guarda o nome de verdade
-- (nome do produto/linha do negócio, ou nome da coluna/etapa do funil, conforme o
-- de-para no n8n). Nulo = ainda não veio; a UI cai no título como fallback.
alter table compras_bitrix add column if not exists produto text;

comment on column compras_bitrix.produto is
  'Nome real da expedicao/pacote comprado (Bitrix via n8n). Fallback: titulo.';
