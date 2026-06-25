-- 0019: conexão "viajam juntas" (mesmo quarto no rooming), por expedição.
--
-- Passageiros com o MESMO `conexao_viagem_id` dentro de uma expedição viajam
-- juntos (casal, família, amigos) e devem ficar no mesmo quarto. É um token de
-- agrupamento simples (uuid), análogo a um "grupo de quarto" — não há tabela
-- própria; `null` = sem conexão. A conexão é POR EXPEDIÇÃO: cada viagem é
-- marcada de novo (o token vive na linha `passageiros` daquela expedição).
--
-- ⚠️ Rodar no SQL Editor do Supabase ao publicar a feature.

alter table passageiros
  add column if not exists conexao_viagem_id uuid;

create index if not exists idx_passageiros_conexao_viagem
  on passageiros(conexao_viagem_id);
