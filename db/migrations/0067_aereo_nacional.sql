-- 0067: novo tipo de requisito "Aéreo Nacional" (conexão brasileira até o embarque
-- internacional, ex.: Fortaleza→GRU). Obrigatório na prontidão de toda expedição, mas
-- só bloqueia quem precisa (quem NÃO é da cidade de São Paulo) — a regra fica no TS
-- (lib/prontidao/regras.ts). Aqui só adicionamos o valor ao enum pra permitir gravar
-- instâncias em passageiro_requisitos.
alter type tipo_requisito add value if not exists 'Aéreo Nacional';
