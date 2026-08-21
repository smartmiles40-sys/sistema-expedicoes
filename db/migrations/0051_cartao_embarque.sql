-- 0051_cartao_embarque.sql
-- Nova categoria de arquivo "Cartão de embarque": o operacional faz o check-in e
-- anexa o cartão de embarque de cada passageiro; aparece no portal do ExpedAmigo.
-- Só amplia o enum categoria_arquivo (como a 0035 fez com "Contrato").

alter type categoria_arquivo add value if not exists 'Cartão de embarque';
