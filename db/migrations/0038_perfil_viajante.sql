-- 0038_perfil_viajante.sql
-- Perguntas de perfil/conexão do formulário de inscrição (profissão, @Instagram,
-- tamanho de camiseta, música, "como se descreve em grupo", "o que te anima",
-- "significado", confirmação de veracidade) + a foto do viajante.
--
-- Guardadas num jsonb único no passageiro (padrão do `saude`). A foto é um arquivo
-- (como o passaporte): `foto_arquivo_id` no passageiro e no staging.

alter table passageiros
  add column if not exists perfil_viajante jsonb,
  add column if not exists foto_arquivo_id uuid references arquivos(id) on delete set null;

alter table inscricoes_pendentes
  add column if not exists foto_arquivo_id uuid references arquivos(id) on delete set null;
