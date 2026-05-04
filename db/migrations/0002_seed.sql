-- =============================================================================
-- Seed inicial — dados de exemplo
-- Rode DEPOIS de 0001_initial_schema.sql
-- =============================================================================

-- Câmbios
insert into cambios (moeda, taxa_brl) values
  ('BRL', 1.0),
  ('USD', 5.20),
  ('EUR', 5.60),
  ('PEN', 1.40),
  ('GBP', 6.55),
  ('JPY', 0.035),
  ('ARS', 0.005),
  ('CLP', 0.0055)
on conflict (moeda) do update set
  taxa_brl = excluded.taxa_brl,
  atualizado_em = now();

-- Fornecedores
insert into fornecedores (id, nome, tipo, contato_nome, contato_email, contato_whatsapp, destino_cidade, servicos, moeda_padrao, politica_pagamento, status)
values
  ('f0000000-0000-0000-0000-000000000001','Andean DMC','DMC','Diego Quispe','diego@andeandmc.pe','+51 984 123 456','Cusco',array['Trekking','Hotelaria','Transfers'],'USD','30% sinal, 70% até 30 dias antes','Ativo'),
  ('f0000000-0000-0000-0000-000000000002','Patagonia Wild','DMC','Sofía Gómez','sofia@patagoniawild.ar','+54 9 11 6543 2100','El Calafate',array['Glaciar','Trekking','Hotelaria'],'USD','50% sinal, 50% no check-in','Ativo'),
  ('f0000000-0000-0000-0000-000000000003','Hotel Casa Andina','Hotel','Reservas','reservas@casaandina.com',null,'Cusco',array['Hospedagem'],'USD','Pré-pagamento 100% 7 dias antes','Ativo'),
  ('f0000000-0000-0000-0000-000000000004','LATAM Airlines','Aéreo','Conta corporativa','corporate@latam.com',null,null,array['Aéreo internacional'],'BRL','Faturamento 30 dias','Ativo'),
  ('f0000000-0000-0000-0000-000000000005','Travel Ace Seguros','Seguro','Atendimento corporativo','corp@travelace.com.br','+55 11 4002-8922',null,array['Seguro viagem'],'BRL','Faturado por embarque','Ativo')
on conflict (id) do nothing;

-- Expedições (datas relativas ao now)
insert into expedicoes (id, codigo, nome, destino, data_embarque, data_retorno, status, pax_planejados, pax_cortesia, preco_venda_brl, observacoes)
values
  ('e0000000-0000-0000-0000-000000000001','PERU-AGO2026','Peru – Caminho Inca Ago 2026','Peru', current_date + 95, current_date + 105, 'Vendas Abertas', 24, 2, 18900, 'Grupo + Trekking 4 dias.'),
  ('e0000000-0000-0000-0000-000000000002','PATAG-NOV2026','Patagônia – Glaciares Nov 2026','Argentina', current_date + 180, current_date + 189, 'Vendas Abertas', 20, 1, 22500, null),
  ('e0000000-0000-0000-0000-000000000003','JAPAO-MAR2027','Japão – Cerejeiras Mar 2027','Japão', current_date + 305, current_date + 320, 'Planejamento', 18, 1, 38900, null)
on conflict (id) do nothing;

-- Passageiros (10 distribuídos)
insert into passageiros (expedicao_id, nome_completo, tipo, status_reserva, cpf, passaporte, validade_passaporte, email)
values
  ('e0000000-0000-0000-0000-000000000001','Mariana Silva','Pagante','Confirmado','111.222.333-44','FA123456', current_date + 800,'mari@gmail.com'),
  ('e0000000-0000-0000-0000-000000000001','João Pereira','Pagante','Confirmado','222.333.444-55','FB234567', current_date + 120,'jp@gmail.com'),
  ('e0000000-0000-0000-0000-000000000001','Letícia Souza','Pagante','Pré-reserva','333.444.555-66',null,null,'le@gmail.com'),
  ('e0000000-0000-0000-0000-000000000001','Rafael Tonin','Pagante','Confirmado','444.555.666-77','FC345678', current_date + 60,'rafa@gmail.com'),
  ('e0000000-0000-0000-0000-000000000002','Camila Rocha','Pagante','Confirmado','666.777.888-99','FE567890', current_date + 700,'ca@gmail.com'),
  ('e0000000-0000-0000-0000-000000000002','Fernando Lima','Pagante','Lead','777.888.999-00','FF678901', current_date + 500,'fer@gmail.com'),
  ('e0000000-0000-0000-0000-000000000002','Patrícia Nunes','Pagante','Pré-reserva','888.999.000-11',null,null,'pa@gmail.com'),
  ('e0000000-0000-0000-0000-000000000003','Marcos Tavares','Pagante','Confirmado','999.000.111-22','FG789012', current_date + 1200,'ma@gmail.com'),
  ('e0000000-0000-0000-0000-000000000003','Bianca Andrade','Pagante','Lead','000.111.222-33',null,null,'bi@gmail.com'),
  ('e0000000-0000-0000-0000-000000000003','Lúcia Moreira','Pagante','Pré-reserva','999.888.777-66','FJ012345', current_date + 600,'lu@gmail.com');
