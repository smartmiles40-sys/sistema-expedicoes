-- 0045_papel_relacionamento.sql
-- Novo papel de usuário: "relacionamento" — perfil SOMENTE LEITURA do sistema
-- operacional, com a exceção de poder APROVAR/RECUSAR inscrições (fila /inscricoes).
-- A trava de escrita em si vem na migration 0046 (RLS) + guardas no app.
--
-- ⚠️ Rode ESTA migration ANTES da 0046. `alter type ... add value` precisa estar
-- commitado antes de ser usado; por isso fica num arquivo separado.
alter type papel_usuario add value if not exists 'relacionamento';
