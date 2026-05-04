# Sistema Operacional de Expedições — CLAUDE.md

Este arquivo é a memória persistente do projeto. **Leia antes de modificar qualquer código.**

## 🎯 Negócio

Web app interno para uma agência de turismo focada em **expedições** (viagens em grupo). Substitui uma planilha Excel atual usada pelo time de operações, comercial e financeiro.

- Agência: **Se Tu For, Eu Vou**
- 10+ expedições simultâneas (grupos de 15-30 pax pra Peru, Patagônia, Japão, Egito etc.)
- Cada expedição tem: dados gerais, lista de passageiros, custos com fornecedores em várias moedas, pagamentos, checklist operacional, controle de documentos/vistos, rooming list
- Origem dos passageiros: **Bitrix24 CRM** (deals = inscrições). Sincronização via **n8n**.
- Time vem de planilha. UX **precisa parecer "planilha turbinada"**, não SaaS genérico.

## 📖 Glossário (memorize)

| Termo | Definição |
|---|---|
| Expedição | Viagem em grupo organizada pela agência (ex: "Peru – Ago 2026") |
| Pax | Passageiro (jargão de turismo) |
| DMC | Destination Management Company (fornecedor local no destino) |
| Day-by-day | Roteiro detalhado dia a dia |
| Rooming list | Distribuição de quartos por hotel |
| Net | Preço de custo (do fornecedor) |
| Markup | Margem aplicada sobre o net |
| Líder | Pessoa da agência que viaja com o grupo (não-pagante) |
| Cortesia | Pax não-pagante (líder, brinde, parceria) |

## 🛠️ Stack

- **Next.js 16** (App Router, TypeScript, Server Components por padrão).
  - ⚠️ `params` e `searchParams` são `Promise` — sempre `await`.
  - ⚠️ `cookies()` e `headers()` são async.
- **Tailwind CSS v4** — paleta semântica em `app/globals.css` via `@theme`. **Não há `tailwind.config.ts`** (Tailwind v4 não usa).
- **TanStack Table v8** para tabelas densas com edição inline.
- **Supabase** (Postgres + Auth + Realtime) via `@supabase/ssr`.
  - **Status atual: não conectado.** Código pronto, mas `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` faz o app rodar com **mock data** (`lib/mock-data.ts`).
- **Zod** validação cliente + servidor.
- **React Hook Form** para forms.
- **date-fns** com locale `pt-BR`.
- **lucide-react** para ícones.
- **cmdk** command palette (P6).
- **sonner** toasts (P6).
- **recharts** para gráficos (P5).
- **@dnd-kit** para drag-and-drop (rooming).
- **shadcn-style** UI primitives (escritos manualmente em `components/ui/` — não tem CLI shadcn rodando porque a paleta é custom).

## 🎨 Princípios de UX (críticos)

- Tabela densa é a tela principal, **não** formulário.
- Edição inline (célula → digitar → Tab/Enter salva).
- Atalhos: `Tab` navega, `Enter` confirma, `Esc` cancela, `/` busca, `n` nova linha.
- Mínimo de modais — preferir **drawer lateral** (`components/ui/Drawer.tsx`).
- **Cores semânticas** (não decorativas):
  - 🔵 `editavel` (azul) — campo editável
  - ⚪ `auto` (cinza) — campo automático/calculado
  - 🟢 `vinculado` (verde) — vindo de outra fonte (ex: Bitrix)
  - 🟠 `atencao` (laranja) — prazo próximo
  - 🔴 `critico` (vermelho) — vencido / falta documento
  - 🟣 `lista` (roxo) — select / status
- Densidade alta: linhas 32px, fonte 13px, padding 6/12.
- Mobile-first **NÃO se aplica aqui** — esse é um app interno operacional, sempre desktop.

## 📁 Estrutura de pastas

```
/app
  /(auth)
    /login           — magic link
  /(app)             — rotas autenticadas
    /dashboard       — KPIs cross-expedição
    /expedicoes      — lista
      /[id]          — detalhe (7 tabs)
        /passageiros
        /custos
        /pagamentos
        /checklist
        /documentos
        /rooming
    /fornecedores    — CRUD
    /cambios         — taxas BRL
    /configuracoes   — usuários, constantes
    layout.tsx       — shell autenticado
  /api
    /bitrix
      /passageiro-sync
      /expedicao-sync
    /health

/components
  /ui                — primitives (Button, Input, Drawer, Badge, Tabs...)
  /tables            — DataTable, EditableCell
  /forms             — campos reutilizáveis
  /layout            — Sidebar, Header, UserMenu, AppShell

/lib
  /supabase          — client.ts, server.ts, admin.ts, auth.ts
  /bitrix            — types, mapping, validators, stage-mapping
  /data              — funções de fetch (delegam pra Supabase ou mock)
  utils.ts           — cn(), formatters
  constants.ts       — MARGEM_MINIMA etc
  dev-mode.ts        — bypass de auth
  mock-data.ts       — fixtures pra rodar sem Supabase

/db
  /migrations
    0001_initial_schema.sql
    0002_seed.sql

/types
  database.ts        — tipos do schema (escritos à mão; gerar com supabase gen types depois)

/docs
  N8N_INTEGRATION.md
```

## 🗄️ Schema do Banco

Diagrama ASCII das relações (alto nível):

```
auth.users  ──1:1──  usuarios (papel)
                       │
                       ├── responsavel_op ─┐
                       └── responsavel_com ┤
                                           ▼
fornecedores ──── dmc_principal ──→  expedicoes
   │                                     │
   │                                     ├──< passageiros ──< documentos
   │                                     │        │
   │                                     │        └──→ quartos (rooming)
   │                                     │
   │                                     ├──< custos ──< pagamentos
   │                                     │
   │                                     └──< checklist_itens (self-FK: dependencia)
   │
   └────────── (FK em custos, pagamentos)

cambios (moeda PK) — tabela de taxas BRL
audit_log — INSERT/UPDATE/DELETE em tabelas críticas
```

Detalhes em `db/migrations/0001_initial_schema.sql`. Triggers: `set_updated_at`, `audit_*`.

RLS habilitado em todas as tabelas com políticas iniciais permissivas (autenticado → tudo). Refinar antes de prod.

## 🔌 Integração Bitrix (P7)

Eventos: `ONCRMDEALADD`, `ONCRMDEALUPDATE`, `ONCRMCONTACTUPDATE`.

Fluxo: Bitrix → n8n (transforma payload) → POST `/api/bitrix/passageiro-sync` (com header `x-webhook-secret`).

Mapeamento de estágios: `lib/bitrix/stage-mapping.ts`. Campos custom (UF_CRM_CPF, UF_CRM_PASSAPORTE) em `lib/bitrix/mapping.ts`.

Detalhes: `docs/N8N_INTEGRATION.md`.

## 🚦 Estado atual

| Prompt | O que entrega | Estado |
|---|---|---|
| P0 | Setup, deps, paleta, CLAUDE.md | ✅ |
| P1 | Schema SQL + tipos + helpers Supabase | ✅ (sem rodar; Supabase pendente) |
| P2 | Login + shell + dashboard placeholder | ✅ (auth bypass em dev) |
| P3 | Lista de Expedições | ✅ |
| P4 | Detalhe Expedição (7 tabs) | ✅ |
| P5 | Dashboard exec + Fornecedores + Câmbios + Config | ✅ |
| P6 | Command palette + atalhos + dark mode + realtime | ✅ |
| P7 | Webhooks Bitrix | ✅ |

## 🧪 Como rodar

```bash
npm install
cp .env.local.example .env.local   # se ainda não tiver
# (deixe NEXT_PUBLIC_DEV_AUTH_BYPASS=true se Supabase nao estiver configurado)
npm run dev
```

Abrir http://localhost:3000 → redireciona pra `/dashboard` (login pulado em dev).

## ⚠️ Convenções obrigatórias

1. **Server Components por padrão.** Adicione `"use client"` só quando precisar de hook/event.
2. **Server Actions** para mutations. Não use `fetch` pra rota interna.
3. **Zod em todo input externo** (forms, webhooks).
4. **pt-BR em tudo** (textos, comentários quando necessários, datas via `date-fns/locale/ptBR`).
5. **Não criar arquivos de doc/decisão fora de `/docs`** sem motivo.
6. **Edição inline > drawer > modal**. Evite modais.
7. **Ao adicionar tabela nova ao schema:** atualize `0001_initial_schema.sql`, `types/database.ts`, e este CLAUDE.md.
