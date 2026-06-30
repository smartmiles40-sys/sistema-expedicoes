-- 0023 — Passaporte: validade (colunas) + anexo foto/PDF (instância) obrigatórios.
--
-- O item "Passaporte" deixou de ser só "de coluna" (validade) e passou a HÍBRIDO:
-- continua checando a validade pelos campos do passageiro E agora exige um arquivo
-- (foto/PDF) anexado à instância (arquivo_id). Só fica "Apto" com os DOIS ok.
-- Espelha lib/prontidao/regras.ts (ramo "Passaporte" em avaliarProntidao) e
-- lib/prontidao/requisitos-destino.ts.
--
-- O valor 'Passaporte' JÁ EXISTE no enum tipo_requisito (requisito original), então
-- NÃO há ALTER TYPE aqui — basta o backfill abaixo.
--
-- Passageiros NOVOS recebem a instância automaticamente (gerarRequisitosPadrao, agora
-- que "Passaporte" saiu de REQUISITOS_DE_COLUNA). Os EXISTENTES precisam do backfill
-- (rodar uma única vez no SQL Editor do Supabase).

-- Backfill: cria a instância "Passaporte" p/ todo passageiro de expedição ativo que
-- ainda não a tenha (idempotente via unique (passageiro_id, tipo)).
insert into passageiro_requisitos
  (passageiro_id, tipo, descricao, status, obrigatoriedade, bloqueia_embarque)
select
  p.id,
  'Passaporte'::tipo_requisito,
  'Passaporte válido + foto/PDF anexado',
  'Pendente'::status_requisito,
  'Obrigatório'::obrigatoriedade,
  true
from passageiros p
where p.expedicao_id is not null
  and p.status_reserva <> 'Cancelado'
  and not exists (
    select 1 from passageiro_requisitos r
    where r.passageiro_id = p.id
      and r.tipo = 'Passaporte'
  );
