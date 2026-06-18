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
  /(app)             — rotas autenticadas (entrada padrão: /expedicoes)
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
   │                                     │        ├──→ quartos (rooming)
   │                                     │        └──< passageiro_requisitos ──→ arquivos (evidência)
   │                                     │
   │                                     ├──< custos ──< pagamentos
   │                                     │
   │                                     └──< checklist_itens (self-FK: dependencia)
   │
   └────────── (FK em custos, pagamentos)

requisitos_destino (destino) — catálogo do que cada destino exige
cambios (moeda PK) — tabela de taxas BRL
audit_log — INSERT/UPDATE/DELETE em tabelas críticas
vw_prontidao_passageiro — VIEW: semáforo Apto/Atenção/Bloqueado por pax
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
| P8 | Motor de Processos (checklist = SOP real do ClickUp) | ✅ |
| P9 | Motor de Prontidão para Embarque (requisitos + semáforo + painel) | ✅ (mock; Supabase pendente) |

## ✅ Checklist = Motor de Processos (P8)

O checklist espelha o **SOP real da agência** (ClickUp "Processos - Expedição"):
**23 processos operacionais em 5 fases por ANTECEDÊNCIA ao embarque** (+ "Pós-viagem"
opcional). Não é mais uma lista genérica por categoria.

- **Fases** (`ETAPA_CHECKLIST` em `lib/constants.ts`, na ordem da timeline):
  `Após o fechamento` → `12 a 6 meses` → `6 a 2 meses` → `2 meses a 15 dias` →
  `Na semana` → `Pós-viagem`. Metadados (janela de dias, prazo de referência) em
  `FASES_CHECKLIST`; `faseAtualChecklist(diasAteEmbarque)` calcula a fase corrente.
- **Catálogo:** `lib/processos/template.ts` (`PROCESSOS_EXPEDICAO`, 23 itens operacionais verbatim
  do ClickUp + subtarefas) e o builder puro `construirChecklistPadrao()` que instancia
  os itens calculando `prazo = data_embarque − offset`.
- **Seeding:** server action `gerarChecklistPadrao(expedicaoId)` (em
  `app/(app)/expedicoes/actions.ts`). Disparada pelo empty-state da aba checklist e
  pelo toggle "Gerar checklist padrão" do `NovaExpedicaoDrawer`. No Supabase insere
  pais e depois filhos (FK `parent_id`).
- **Subtarefas:** coluna `parent_id` (self-FK) + `ordem` — migration
  `0009_checklist_processos.sql`. UI com linhas expansíveis e progresso por pai.
- **UI:** `ChecklistTabela.tsx` agrupa por fase, mostra timeline, barra de progresso por
  fase, destaque da fase atual, checkbox de conclusão e status editável inline.
- **Dashboard:** card "Processos das expedições" + KPI de atrasados/próximos
  (`getResumoProcessos()` em `lib/data/expedicoes.ts`).

⚠️ Ao mexer no checklist: as 4 etapas antigas (`Pós-venda/Pré-viagem/Operação/Pós-viagem`)
**não existem mais** — use os valores de `ETAPA_CHECKLIST`.

## 🚦 Prontidão para Embarque (P9)

Responde "este passageiro pode embarcar?" de forma **calculada**, espelhando o motor
de processos do P8 (catálogo + instâncias + status):

- **Catálogo:** `requisitos_destino` define o QUE cada destino exige (passaporte,
  visto, vacina, seguro, financeiro…). Fonte em `lib/prontidao/requisitos-destino.ts`.
- **Instâncias:** `passageiro_requisitos` = status de cada exigência por pax
  (status, validade, nº, evidência via `arquivo_id`, responsável). Unique `(passageiro_id, tipo)`.
- **Financeiro:** `passageiros` ganhou `valor_contratado_brl`, `valor_pago_brl`,
  `saldo_brl` (gerado) e `status_financeiro` — espelhados do Bitrix via n8n.
  Mais campos de embarque: contato de emergência, restrições, contrato, check-in.
- **Semáforo:** `vw_prontidao_passageiro` (SQL) e `lib/prontidao/regras.ts` (TS, usado
  no mock) implementam a MESMA lógica → `Apto` / `Atenção` / `Bloqueado`.
  Regras: passaporte válido ≥ 6m após retorno (`MESES_VALIDADE_PASSAPORTE_PADRAO`),
  requisito obrigatório-bloqueante resolvido, saldo zerado (vira bloqueio a ≤ 15 dias
  do embarque — `DIAS_BLOQUEIO_FINANCEIRO`).
- **Seeding:** `gerarRequisitosPadrao(expedicaoId)` instancia os requisitos do
  destino (idempotente por pax). Disparado **automaticamente ao incluir um
  passageiro** (`criarPassageiro`), no import CSV e no `passageiro-sync` do Bitrix.
- **UI:** **fundida na aba Passageiros** (não há mais aba "Prontidão" separada).
  A tabela de passageiros ganhou uma coluna **Prontidão** (badge Apto/Atenção/Bloqueado);
  clicar abre o `ProntidaoPaxDrawer` (`app/(app)/expedicoes/[id]/passageiros/`) com o
  semáforo por exigência + drawer de edição do requisito (status/validade/responsável)
  e o botão "Gerar requisitos de {destino}". `passageiros/page.tsx` carrega
  `getProntidaoExpedicao()` + `listUsuarios()`. Card no dashboard
  (`getResumoProntidao()`) e avisos linkam pra `/expedicoes/[id]/passageiros`.
- **Enums:** `TIPO_REQUISITO`, `OBRIGATORIEDADE`, `STATUS_REQUISITO`, `PRONTIDAO`,
  `COR_PRONTIDAO` em `lib/constants.ts`.

## 👤 Perfil global do passageiro + retroalimentação

Não existe tabela `pessoas`: uma "pessoa" é a **agregação** de várias linhas
`passageiros` (uma por expedição), agrupadas por identidade em
`chaveIdentidade()` (CPF → Bitrix → e-mail → nome) — `lib/data/pessoas.ts`,
`PessoaAgregada`. A aba global `/passageiros` lista essas pessoas.

- **Passageiro avulso (sem expedição):** `passageiros.expedicao_id` é **anulável**
  (migration `0014`). Uma pessoa pode existir na base operacional sem estar em
  nenhuma expedição — criada pelo botão "Novo passageiro" da `/passageiros`
  (action `criarPassageiroAvulso`, `expedicao_id = null`). A agregação a inclui
  (aparece com 0 expedições) e ela pode ser alocada depois via
  `adicionarPassageiroExistente` (cria uma nova linha vinculada). Avulsos não
  entram em listas de expedição nem em prontidão (sem `expedicao_id`).
- **Dados PESSOAIS** (`CAMPOS_PESSOAIS` em `actions.ts`: nome, cpf, passaporte,
  validade, nascimento, e-mail, telefone, contato de emergência, restrições,
  condições médicas) pertencem à PESSOA. **Dados da RESERVA** (tipo, status,
  quarto, voo, financeiro, observações) ficam na linha da expedição.
- **Retroalimentação:** editar um campo pessoal — seja no perfil global
  (`atualizarDadosPessoais`) ou no drawer dentro da expedição
  (`atualizarPassageiroLote`) — propaga para TODAS as linhas da mesma identidade
  via `propagarDadosPessoais()`, e revalida `/passageiros` + cada expedição
  afetada. Editar dado de reserva NÃO propaga.
- **Documentos:** o perfil global mostra os arquivos de todas as linhas da pessoa
  (`listArquivosDePassageiros` + filtro por `idsPassageiros`); novos uploads
  ancoram na expedição mais recente (`expedicaoIdAncora`/`passageiroIdAncora`).
- **Arquivos no modo mock:** as rotas `/api/arquivos/{upload,[id],[id]/download}`
  têm branch `DEV_USE_MOCK_DATA` que persiste em disco sob `.dev-uploads/`
  (`lib/data/arquivos-mock.ts`: `index.json` + um `.blob` por id). As funções de
  leitura (`lib/data/arquivos.ts`) também leem desse store. Assim upload/preview/
  delete de documentos funcionam localmente sem Supabase; com Supabase conectado,
  o branch real assume e o store fica inerte. `.dev-uploads/` é gitignorado.

## 🧪 Como rodar

```bash
npm install
cp .env.local.example .env.local   # se ainda não tiver
# (deixe NEXT_PUBLIC_DEV_AUTH_BYPASS=true se Supabase nao estiver configurado)
npm run dev
```

Abrir http://localhost:3000 → redireciona pra `/expedicoes` (login pulado em dev).

## 💸 Pagamento: só fornecedor (passageiro removido)

O sistema controla **apenas o pagamento de fornecedores** — a aba **Pagamentos**
dentro da expedição (`custos ──< pagamentos`, ligados a `fornecedores`). O
controle de **pagamento de passageiro foi removido** (funcional):

- Sem seção "Financeiro" no perfil global; `PessoaAgregada` não soma contratado/pago.
- Sem requisito **"Pagamento"** na prontidão: removido de `BASE_INTERNACIONAL`
  (`requisitos-destino.ts`), de `REQUISITOS_DE_COLUNA`/`checarFinanceiro`
  (`prontidao/regras.ts`) e das regras de aviso (`alertas/regras.ts`). Saldo em
  aberto **não bloqueia mais embarque**.
- As colunas `valor_contratado_brl`/`valor_pago_brl`/`saldo_brl`/`status_financeiro`
  continuam no schema/tipos como **dormentes** (não exibidas/usadas). A seed
  `0011` ainda traz a linha `Pagamento` em `requisitos_destino`, mas o builder
  (`construirRequisitosPadrao`) usa o template TS, então nada instancia "Pagamento".
- **Não há Dashboard.** A entrada padrão é `/expedicoes`.

## ⚠️ Convenções obrigatórias

1. **Server Components por padrão.** Adicione `"use client"` só quando precisar de hook/event.
2. **Server Actions** para mutations. Não use `fetch` pra rota interna.
3. **Zod em todo input externo** (forms, webhooks).
4. **pt-BR em tudo** (textos, comentários quando necessários, datas via `date-fns/locale/ptBR`).
5. **Não criar arquivos de doc/decisão fora de `/docs`** sem motivo.
6. **Edição inline > drawer > modal**. Evite modais.
7. **Ao adicionar tabela nova ao schema:** atualize `0001_initial_schema.sql`, `types/database.ts`, e este CLAUDE.md.
