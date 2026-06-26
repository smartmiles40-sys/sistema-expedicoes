-- 0020 — Requisito "Voo Interno" na prontidão (mesmo racional do Aéreo Doméstico).
--
-- Espelha lib/prontidao/requisitos-destino.ts (template VOO_INTERNO, condicional,
-- não bloqueante, nos destinos Peru/Argentina/Chile/Japão/Egito) e a regra
-- REQUISITOS_COM_ANEXO_OBRIGATORIO: fica "Apto" quando há voucher anexado OU quando
-- é dispensado ("não é necessário voo interno").
--
-- Passageiros NOVOS recebem a exigência automaticamente (gerarRequisitosPadrao ao
-- criar o pax). Os EXISTENTES desses destinos recebem no backfill (PASSO 2).
--
-- ⚠️ RODE EM DOIS PASSOS no SQL Editor do Supabase: o Postgres não deixa usar um
--    valor de enum recém-criado na mesma transação. Execute o PASSO 1 sozinho,
--    depois o PASSO 2.

-- =============================================================================
-- PASSO 1 — adiciona o valor ao enum (executar isolado)
-- =============================================================================
alter type tipo_requisito add value if not exists 'Voo Interno' before 'Contrato';

-- =============================================================================
-- PASSO 2 — backfill: cria a instância p/ todo passageiro de expedição ativa
--           dos destinos que exigem voo interno e que ainda não a tenha
--           (idempotente via unique (passageiro_id, tipo)).
-- =============================================================================
insert into passageiro_requisitos
  (passageiro_id, tipo, descricao, status, obrigatoriedade, bloqueia_embarque)
select
  p.id,
  'Voo Interno'::tipo_requisito,
  'Voo interno (trecho aéreo) emitido',
  'Pendente'::status_requisito,
  'Condicional'::obrigatoriedade,
  false
from passageiros p
join expedicoes e on e.id = p.expedicao_id
where p.expedicao_id is not null
  and p.status_reserva <> 'Cancelado'
  and e.destino in ('Peru', 'Argentina', 'Chile', 'Japão', 'Egito')
  and not exists (
    select 1 from passageiro_requisitos r
    where r.passageiro_id = p.id
      and r.tipo = 'Voo Interno'
  );
