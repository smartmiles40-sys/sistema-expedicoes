-- 0011 — Seed do catálogo de requisitos por destino.
-- Espelha lib/prontidao/requisitos-destino.ts. Idempotente: unique (destino,tipo).
-- A base internacional vale para todos os destinos operados; extras por destino
-- (visto, vacina, RG, voo doméstico) são adicionados depois.

-- Base internacional aplicada a cada destino via cross join.
insert into requisitos_destino
  (destino, tipo, descricao, obrigatoriedade, bloqueia_embarque, meses_validade_minima, papel_responsavel, ordem)
select d.destino, b.tipo::tipo_requisito, b.descricao, b.obrig::obrigatoriedade,
       b.bloqueia, b.meses, b.papel::papel_usuario, b.ordem
from (values ('Peru'),('Argentina'),('Chile'),('Japão'),('Egito'),('Itália')) as d(destino)
cross join (values
  ('Passaporte',          'Passaporte válido por ao menos 6 meses após o retorno', 'Obrigatório', true,  6,           'operacional', 1),
  ('Dados Pessoais',      'Cadastro completo (CPF, nascimento, contato)',          'Obrigatório', true,  null::int,   'operacional', 2),
  ('Contrato',            'Contrato assinado',                                     'Obrigatório', true,  null::int,   'comercial',   3),
  ('Pagamento',           'Saldo quitado antes do embarque',                       'Obrigatório', true,  null::int,   'financeiro',  4),
  ('Seguro',              'Seguro viagem emitido cobrindo todo o período',         'Obrigatório', true,  null::int,   'comercial',   5),
  ('Aéreo Internacional', 'Bilhete internacional emitido (localizador)',           'Obrigatório', true,  null::int,   'operacional', 6)
) as b(tipo, descricao, obrig, bloqueia, meses, papel, ordem)
on conflict (destino, tipo) do nothing;

-- Extras por destino.
insert into requisitos_destino
  (destino, tipo, descricao, obrigatoriedade, bloqueia_embarque, meses_validade_minima, papel_responsavel, ordem, observacoes)
values
  -- Peru
  ('Peru','Vacina','Certificado Internacional de Vacinação (febre amarela)','Condicional',true,null,'operacional',7,'Recomendada para selva/Machu Picchu; conferir exigência.'),
  ('Peru','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Argentina
  ('Argentina','RG','RG válido (≤ 10 anos) — alternativa ao passaporte no Mercosul','Recomendado',false,null,'operacional',7,null),
  ('Argentina','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Chile
  ('Chile','RG','RG válido (≤ 10 anos) — alternativa ao passaporte no Mercosul','Recomendado',false,null,'operacional',7,null),
  ('Chile','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Japão
  ('Japão','Visto','Visto de turismo (confirmar isenção vigente para BR)','Condicional',true,null,'operacional',7,'Verificar regra de isenção atual antes de instanciar como obrigatório.'),
  ('Japão','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',8,null),
  -- Egito
  ('Egito','Visto','Visto do Egito (e-visa ou on arrival)','Obrigatório',true,null,'operacional',7,null),
  ('Egito','Vacina','Certificado Internacional de Vacinação (febre amarela)','Condicional',true,null,'operacional',8,'Exigível conforme regiões visitadas / país de origem.'),
  ('Egito','Aéreo Doméstico','Trecho doméstico no destino emitido','Condicional',false,null,'operacional',9,null),
  -- Itália / Schengen
  ('Itália','Visto','Autorização ETIAS (quando exigível) — Schengen','Recomendado',false,null,'operacional',7,'ETIAS para isentos de visto; confirmar data de entrada em vigor.')
on conflict (destino, tipo) do nothing;
