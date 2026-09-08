-- 0054_extensao_hospedagem_rooming.sql
-- Extensões (migration 0052/0053) ganham:
--  1) Voucher de hospedagem PRÓPRIO por extensão (o da expedição é 1 só, do hotel base).
--  2) Vínculo de quartos/hotéis do rooming a uma extensão — quando um hotel do rooming
--     é "da extensão X", só os passageiros que contrataram essa extensão entram na
--     alocação (e só eles veem no export/portal).

alter table extensoes add column if not exists hospedagem_voucher_arquivo_id uuid references arquivos(id) on delete set null;

alter table quartos add column if not exists extensao_id uuid references extensoes(id) on delete set null;
create index if not exists idx_quartos_extensao on quartos(extensao_id);
