-- Seed dos câmbios (taxas BRL de referência). Idempotente: re-rodar atualiza.
-- Rode no SQL Editor do Supabase. As taxas são editáveis depois na tela /cambios.
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
