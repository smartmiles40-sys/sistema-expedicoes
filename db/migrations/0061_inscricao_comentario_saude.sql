-- 0061: comentário de triagem de saúde nas inscrições pendentes.
-- A Carol (relacionamento) anota a conduta das inscrições com "Sim" na saúde
-- (ex.: "não precisa de receita", "receita já emitida") pra o time ver na fila
-- antes de aprovar. Fica na própria inscrição pendente (some junto na aprovação).
alter table inscricoes_pendentes
  add column if not exists comentario_saude text;
