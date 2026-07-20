-- 0039_acompanhante_vinculo.sql
-- Mais detalhes do acompanhante no formulário de inscrição:
-- - `acompanhante_vinculo`: vínculo entre a pessoa e o(s) acompanhante(s) (texto livre).
-- - `acompanhante_dividir_com`: quando vai com mais de um, com qual deles quer dividir o quarto.
alter table passageiros
  add column if not exists acompanhante_vinculo text,
  add column if not exists acompanhante_dividir_com text;
