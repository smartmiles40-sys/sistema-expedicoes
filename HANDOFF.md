# HANDOFF — Publicação do Sistema Operacional de Expedições

Checklist técnico para colocar o sistema em produção. O sistema está **funcional**;
o que falta é essencialmente **segurança (login + RLS)**, **build de produção** e
**hospedagem** — não é refazer nada, é configurar.

## Contexto

- **Stack:** Next.js 16 (App Router, TypeScript) + Supabase (Postgres + Auth + Realtime + Storage).
- **Projeto Supabase:** `bnbpsuenlokhljrkvlke` — já tem schema, dados reais (21 expedições) e realtime habilitado.
- **Código:** commits locais no branch `master`. **Ainda não há remoto** (precisa criar, ex.: GitHub, e dar `git push`).
- **Hoje roda em modo dev** com **login DESLIGADO** (`DEV_AUTH_BYPASS=true`) e policies `anon_read_dev` que **expõem todos os dados a qualquer um** — por isso só deve rodar em `localhost`/rede confiável até a segurança ser fechada.

---

## 🔴 CRÍTICO — segurança (sem isso, NÃO publicar)

1. **Ativar login real**
   - Setar `NEXT_PUBLIC_DEV_AUTH_BYPASS=false` em produção.
   - Login por magic-link já existe (`app/(auth)/login`) — estava apenas desligado.
   - Cadastrar os **usuários reais** no Supabase Auth + tabela `usuarios` (com o papel: `admin` / `operacional` / `comercial` / `financeiro`).

2. **Blindar o banco (RLS)**
   - Rodar o **bloco final do `db/REALTIME_SETUP.sql`** que remove as policies `anon_read_dev` (elas eram só pra dev).
   - Conferir que as policies `authenticated` (`auth_all_*`, já criadas nas migrations) cobrem todas as tabelas, inclusive as do realtime.
   - Com login ligado, o client do navegador passa a usar o JWT do usuário (não mais `anon`), então o realtime respeita o RLS autenticado.

3. **Rotacionar as chaves do Supabase** (Settings → API) — as chaves atuais foram compartilhadas durante o desenvolvimento; gerar novas antes do go-live e atualizar as variáveis de ambiente.

---

## 🟡 NECESSÁRIO — deploy

4. **Repositório**
   - Criar um remoto (ex.: GitHub) e `git push` do branch `master`.

5. **Variáveis de ambiente** (configurar **no host de produção**, NÃO commitar):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # SEGREDO
   NEXT_PUBLIC_DEV_USE_MOCK_DATA=false
   NEXT_PUBLIC_DEV_AUTH_BYPASS=false    # produção: login obrigatório
   WEBHOOK_SECRET=...
   ```
   Modelo em `.env.local.example`.

6. **Banco**
   - Migrations aplicadas: `0001`–`0010` + `0013` ✅ e o enum `categoria_arquivo` com `'Contrato'`.
   - Opcionais (ver `db/migrations/0011_*` e `0012_*`): catálogo de requisitos e job de "marcar vencidos".
   - Bucket de Storage **`arquivos-expedicoes`** ✅ criado.
   - Ativar **backup** (planos pagos do Supabase).

7. **Build + hospedagem**
   - Recomendado: **Vercel** (nativo pra Next.js) → conectar o repo, colar as env vars, deploy com HTTPS.
   - Alternativa: `npm run build` + `npm start` num servidor Node.
   - Configurar **domínio próprio**.

8. **Verificação pós-deploy**
   - Testar: login, leitura/escrita, **realtime entre dois usuários**, upload de documento.
   - Confirmar realtime funcionando já autenticado (não mais anon).

---

## 🟢 OPCIONAL — polimento (não bloqueia)

- Finalizar botões placeholder: **"Importar Bitrix"**, **"Gerar automaticamente"** e **"Exportar Excel"** (rooming).
- Limpar código órfão: `getResumoProntidao` / `getResumoProcessos` em `lib/data/expedicoes.ts` (o dashboard que os usava foi removido).
- Decidir visibilidade de **receita/margem** por papel (hoje aparecem pra todos).

---

## Referências no repositório

| Arquivo | O que é |
|---|---|
| `.env.local.example` | Modelo das variáveis de ambiente |
| `db/migrations/0001..0013` | Schema do banco |
| `db/REALTIME_SETUP.sql` | Habilita realtime + (no fim) bloco pra **remover `anon_read_dev`** em produção |
| `db/SEED_PERU.sql` | Seed da expedição Peru – Ago 2026 |
| `CLAUDE.md` | Documentação viva do projeto (negócio, stack, convenções) |

## Notas de arquitetura relevantes

- **Sem controle de pagamento de passageiro** (decisão de produto): só **pagamento de fornecedor** (aba Pagamentos da expedição). Colunas financeiras do passageiro existem no schema mas estão dormentes.
- **Prontidão de embarque**: requisitos são gerados pelo template em código (`lib/prontidao/`), não pela tabela `requisitos_destino` (que é só catálogo). Geração automática ao incluir passageiro, no import CSV e no webhook do Bitrix.
- **Realtime** é por *refresh*: quando o banco muda, os clients conectados dão `router.refresh()` (~300ms). Não é co-edição de cursor.
