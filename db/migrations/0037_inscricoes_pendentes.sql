-- 0037_inscricoes_pendentes.sql
-- Área de espera das inscrições do formulário público.
--
-- Regra nova: uma inscrição enviada NÃO grava mais nada na tabela `passageiros`.
-- Ela fica aqui até o operacional aprovar. Só na APROVAÇÃO os dados são
-- materializados no passageiro (cria/atualiza a linha + propaga os dados pessoais
-- para as outras expedições da pessoa). Recusar apaga esta linha (e o anexo).
--
-- `dados` guarda o payload completo do formulário (o mesmo objeto validado por
-- zod no envio). O anexo do passaporte, se houver, é subido na hora e referenciado
-- por `passaporte_arquivo_id` (a linha em `arquivos` nasce sem passageiro_id; ele é
-- preenchido na aprovação).
create table if not exists inscricoes_pendentes (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  cpf text not null,                                  -- 11 dígitos
  data_nascimento date,
  nome_completo text,
  dados jsonb not null,                               -- payload do formulário
  passaporte_arquivo_id uuid references arquivos(id) on delete set null,
  origem text default 'Formulário público',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expedicao_id, cpf)                          -- reenvio substitui a pendência
);

alter table inscricoes_pendentes enable row level security;

-- Leitura pela fila do operacional (sessão autenticada). Escrita do form público
-- é via service role (bypassa RLS). Modelo permissivo, igual às demais tabelas.
drop policy if exists "inscricoes_pendentes: leitura autenticado" on inscricoes_pendentes;
create policy "inscricoes_pendentes: leitura autenticado" on inscricoes_pendentes
  for select to authenticated using (true);
drop policy if exists "inscricoes_pendentes: escrita autenticado" on inscricoes_pendentes;
create policy "inscricoes_pendentes: escrita autenticado" on inscricoes_pendentes
  for all to authenticated using (true) with check (true);

drop trigger if exists tg_inscricoes_pendentes_updated_at on inscricoes_pendentes;
create trigger tg_inscricoes_pendentes_updated_at
  before update on inscricoes_pendentes for each row execute function set_updated_at();
