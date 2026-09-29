-- 0060_expedicao_tipo.sql
-- Distingue "expedição" (viagem em grupo) de "pacote" (viagem personalizada / sob medida).
-- Um pacote reaproveita 100% da estrutura de `expedicoes` (passageiros, portal ExpedAmigo,
-- roteiro, voos, hospedagem, vouchers), mudando só o `tipo`.
-- Additiva e segura: default 'expedicao' mantém todas as linhas e inserts existentes
-- (inclusive o sync do Bitrix) funcionando sem alteração.

alter table expedicoes add column if not exists tipo text not null default 'expedicao';
alter table expedicoes drop constraint if exists expedicoes_tipo_chk;
alter table expedicoes add constraint expedicoes_tipo_chk check (tipo in ('expedicao', 'pacote'));
create index if not exists idx_expedicoes_tipo on expedicoes(tipo);
