-- 0049_passeio_tipo.sql
-- Diferencia dois tipos de passeio no dia do roteiro do ExpedAmigo:
--   'opcional'  → ao adquirir, SUBSTITUI o dia inteiro no roteiro (com WhatsApp "Contratar agora"). Comportamento original.
--   'adicional' → aparece APENAS como "adquirido" (sem WhatsApp e sem substituir o dia).
-- Default 'opcional' preserva o comportamento de todos os passeios já cadastrados.

alter table passeios_opcionais
  add column if not exists tipo text not null default 'opcional';
