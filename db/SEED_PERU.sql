-- =============================================================================
-- SEED — Expedição "Peru – Ago 2026" + 9 passageiros (dados reais)
-- -----------------------------------------------------------------------------
-- Rode DEPOIS do schema (0001 + demais migrations), NO LUGAR da seed de demo
-- (0002_seed.sql), se você não quer os dados fictícios.
-- Idempotente: pode rodar mais de uma vez sem duplicar.
-- =============================================================================

-- Expedição -------------------------------------------------------------------
insert into expedicoes
  (id, codigo, nome, destino, data_embarque, data_retorno, status,
   pax_planejados, pax_cortesia, preco_venda_brl, observacoes)
values
  ('e0000000-0000-0000-0000-000000000006', 'PERU-AGO26', 'Peru – Ago 2026', 'Peru',
   '2026-08-22', '2026-08-30', 'Em andamento',
   9, 0, 0,
   'Machu Picchu, cultura inca e gastronomia premiada. 9 dias · edição encerrada (vendas fechadas).')
on conflict (id) do nothing;

-- Passageiros — limpa e reinsere (idempotente). UUID/date com cast explícito.
delete from passageiros where expedicao_id = 'e0000000-0000-0000-0000-000000000006'::uuid;

insert into passageiros
  (expedicao_id, nome_completo, tipo, status_reserva, cpf, passaporte, validade_passaporte, data_nascimento)
values
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Alynne Moura Maglioni Monti','Pagante','Confirmado','103.640.356-41','FW614529','2028-07-31'::date,'1992-07-21'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Cristina Martini','Pagante','Confirmado','070.600.879-07','GM358823','2035-08-31'::date,'1989-11-14'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Eduardo Regis Coroa Vasconcelos','Pagante','Confirmado','022.060.842-36','GG280125','2033-02-23'::date,'1992-05-29'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Georgia Freitas Café','Pagante','Confirmado','058.459.213-25','FX579723','2028-11-29'::date,'1998-02-20'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Jéssica de Andrade Freitas','Pagante','Confirmado','117.627.436-80','GN029292','2035-11-25'::date,'1995-05-27'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Maria Aparecida Queirós de Sousa','Pagante','Confirmado','035.777.863-45',null,null,'1989-01-20'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Maria Tais Claudino de Almeida','Pagante','Confirmado','031.689.813-97','GF958696','2033-01-15'::date,'1992-05-29'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Matthäus Gondim Muniz','Pagante','Confirmado','008.937.093-79','FX579722','2028-11-29'::date,'1991-08-13'::date),
  ('e0000000-0000-0000-0000-000000000006'::uuid,'Paula Viana Egypto','Pagante','Confirmado','016.016.133-93','GJ716623','2034-07-09'::date,'1985-11-03'::date);
