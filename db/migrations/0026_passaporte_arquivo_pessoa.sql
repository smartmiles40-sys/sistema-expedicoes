-- 0026 — Passaporte: anexo 1 por PESSOA + remoção do item "Documento Pessoal".
--
-- 1) Novo campo `passageiros.passaporte_arquivo_id` (arquivo do passaporte). É um
--    CAMPO_PESSOAL: propaga entre todas as expedições da pessoa (a prontidão do
--    Passaporte lê daqui em vez da instância do requisito).
-- 2) Backfill: move o arquivo do passaporte que já estava nas instâncias
--    "Passaporte" (passageiro_requisitos.arquivo_id) para o novo campo.
-- 3) Remove o requisito "Documento Pessoal": apaga as instâncias e os arquivos
--    daquele item (descrição "Documento Pessoal — prontidão", categoria
--    "Documentos pessoais"). MANTÉM passaporte, certificados de vacina e outros docs.
--    (O valor 'Documento Pessoal' fica no enum tipo_requisito — inofensivo.)
--
-- ⚠️ A limpeza de arquivos apaga só as LINHAS de `arquivos` (o app deixa de mostrá-los).
--    Os blobs no Storage ficam órfãos (inofensivos); se quiser removê-los de vez, dá
--    pra rodar um script à parte.

-- 1) Coluna nova (idempotente)
alter table passageiros
  add column if not exists passaporte_arquivo_id uuid references arquivos(id) on delete set null;

-- 2) Backfill: arquivo do passaporte (da instância) → campo da pessoa
update passageiros p
set passaporte_arquivo_id = r.arquivo_id
from passageiro_requisitos r
where r.passageiro_id = p.id
  and r.tipo = 'Passaporte'
  and r.arquivo_id is not null
  and p.passaporte_arquivo_id is null;

-- 3a) Remove as instâncias do requisito "Documento Pessoal"
delete from passageiro_requisitos where tipo = 'Documento Pessoal';

-- 3b) Remove os arquivos do "Documento Pessoal" (mantém passaporte, vacina, etc.)
delete from arquivos
where categoria = 'Documentos pessoais'
  and descricao = 'Documento Pessoal — prontidão';
