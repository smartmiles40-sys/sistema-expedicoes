# Sistema Operacional de Expedições

Web app interno da **Se Tu For, Eu Vou** pra gerenciar expedições (viagens em grupo). Substitui a planilha Excel.

## Setup rápido

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

> Em dev, o login é **pulado** (`NEXT_PUBLIC_DEV_AUTH_BYPASS=true`). O app roda com mock data até você plugar o Supabase.

## Stack

- Next.js 16 + TypeScript + App Router
- Tailwind CSS v4
- TanStack Table v8
- Supabase (Postgres + Auth + Realtime) — `@supabase/ssr`
- Zod, React Hook Form
- date-fns (pt-BR)
- lucide-react, cmdk, sonner, recharts, @dnd-kit

## Estrutura

Veja [`CLAUDE.md`](./CLAUDE.md) — é a fonte de verdade do projeto (negócio, glossário, schema, convenções).

## Conectar Supabase

1. Crie o projeto em [supabase.com](https://supabase.com).
2. Copie URL + anon key + service role pro `.env.local`.
3. Mude `NEXT_PUBLIC_DEV_AUTH_BYPASS=false`.
4. Rode as migrations: cole o SQL de `db/migrations/0001_initial_schema.sql` no editor SQL.
5. Rode `db/migrations/0002_seed.sql` pra popular dados de exemplo.
6. Gere os tipos: `supabase gen types typescript --project-id <id> > types/database.ts`.

## Integração Bitrix/n8n

Veja [`docs/N8N_INTEGRATION.md`](./docs/N8N_INTEGRATION.md).
