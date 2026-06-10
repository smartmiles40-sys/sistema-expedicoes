-- Coluna `ordem` pra reordenação manual via drag-and-drop na lista de expedições.
-- Nullable: registros antigos ficam null; ORDER BY trata null como último.

alter table expedicoes
  add column if not exists ordem int;

create index if not exists idx_expedicoes_ordem on expedicoes(ordem);
