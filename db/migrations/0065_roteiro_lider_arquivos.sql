-- Vouchers/documentos por dia do Roteiro do Líder (migration 0065).
-- Cada dia pode apontar para arquivos (ids) já existentes (docs da Área do Líder),
-- pra aparecerem clicáveis dentro do dia ("Você pode precisar:").
alter table roteiro_lider_dias add column if not exists arquivo_ids text[];
