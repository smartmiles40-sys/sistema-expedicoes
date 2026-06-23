-- 0017 — Requisito "Documento Pessoal" na prontidão (foto do documento obrigatória).
--
-- Espelha lib/prontidao/requisitos-destino.ts (entrou em BASE_INTERNACIONAL) e a
-- regra REQUISITOS_COM_ANEXO_OBRIGATORIO em lib/prontidao/regras.ts: o requisito só
-- fica "Apto" quando há um arquivo (foto/scan) anexado à instância (arquivo_id).
--
-- Passageiros NOVOS recebem a exigência automaticamente (gerarRequisitosPadrao ao
-- criar o pax). Os EXISTENTES precisam do backfill (passo 2) — feito uma única vez.
--
-- ⚠️ RODE EM DOIS PASSOS no SQL Editor do Supabase: o Postgres não deixa usar um
--    valor de enum recém-criado na mesma transação. Execute o PASSO 1 sozinho,
--    depois o PASSO 2.

-- =============================================================================
-- PASSO 1 — adiciona o valor ao enum (executar isolado)
-- =============================================================================
alter type tipo_requisito add value if not exists 'Documento Pessoal';

-- =============================================================================
-- PASSO 2 — backfill: cria a instância p/ todo passageiro de expedição ativo
--           que ainda não a tenha (idempotente via unique (passageiro_id, tipo)).
-- =============================================================================
insert into passageiro_requisitos
  (passageiro_id, tipo, descricao, status, obrigatoriedade, bloqueia_embarque)
select
  p.id,
  'Documento Pessoal'::tipo_requisito,
  'Foto do documento pessoal (RG, CNH ou passaporte)',
  'Pendente'::status_requisito,
  'Obrigatório'::obrigatoriedade,
  true
from passageiros p
where p.expedicao_id is not null
  and p.status_reserva <> 'Cancelado'
  and not exists (
    select 1 from passageiro_requisitos r
    where r.passageiro_id = p.id
      and r.tipo = 'Documento Pessoal'
  );
