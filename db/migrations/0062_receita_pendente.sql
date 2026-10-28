-- 0062: lembrete de receita médica (Carol emite/envia ~20 dias antes da viagem).
-- Marcado na triagem da inscrição (bloco de saúde) e CARREGADO pro passageiro na
-- aprovação — por isso vive também em `passageiros`, pra sobreviver à aprovação e
-- alimentar o menu /receitas. `receita_enviada_em` tira da lista (mantém histórico).
alter table inscricoes_pendentes
  add column if not exists receita_pendente boolean not null default false;

alter table passageiros
  add column if not exists receita_pendente boolean not null default false;

alter table passageiros
  add column if not exists receita_enviada_em timestamptz;
