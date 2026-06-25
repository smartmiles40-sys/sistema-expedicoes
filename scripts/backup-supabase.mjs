// Backup do banco Supabase — SOMENTE LEITURA (nenhuma escrita no banco).
//
// Exporta TODAS as tabelas do schema public para JSON datado, MAIS as contas de
// login (auth.users) que foram criadas à mão no painel e não estão em migração.
// O schema (DDL, triggers, RLS) já está versionado em db/migrations — este backup
// cobre os DADOS, que é o que o plano Free não protege (sem backup diário).
//
// Onde grava: por padrão  <home>/Backups/sistema-expedicoes/<timestamp>/
//   (FORA do repositório — backup contém CPF + dados de saúde = PII, não vai pro git).
//   Sobrescreva com a env BACKUP_DIR=algum\caminho.
//
// Uso:  node scripts/backup-supabase.mjs
//       node scripts/backup-supabase.mjs --keep 30     (retenção: mantém os 30 mais novos)
//
// Bônus: rodar isto de tempos em tempos mantém o projeto Free ATIVO (ele pausa
// após ~1 semana de inatividade).
import { readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

// --- lê .env.local (KEY=VALUE) ------------------------------------------------
function lerEnv(caminho) {
  const env = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

// --- args ---------------------------------------------------------------------
const argv = process.argv.slice(2);
const keepIdx = argv.indexOf("--keep");
const KEEP = keepIdx >= 0 ? Math.max(1, Number(argv[keepIdx + 1]) || 30) : 30;

// --- config -------------------------------------------------------------------
const env = lerEnv(new URL("../.env.local", import.meta.url));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// timestamp legível e ordenável: 2026-06-25_14-03-07
const agora = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const stamp = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}_${p2(agora.getHours())}-${p2(agora.getMinutes())}-${p2(agora.getSeconds())}`;

const baseDir = process.env.BACKUP_DIR || join(homedir(), "Backups", "sistema-expedicoes");
const destino = join(baseDir, stamp);
mkdirSync(destino, { recursive: true });

const linha = "=".repeat(64);
console.log(linha);
console.log("BACKUP SUPABASE — sistema-expedicoes  (somente leitura)");
console.log(linha);
console.log(`Destino: ${destino}\n`);

// --- 1) descobre as tabelas via OpenAPI do PostgREST --------------------------
// O root do REST devolve um swagger com TODAS as tabelas/views expostas em public.
async function descobrirTabelas() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`OpenAPI HTTP ${res.status}`);
  const spec = await res.json();
  const nomes = Object.keys(spec.definitions ?? {});
  // pula views (derivadas, não são dados-fonte): vw_*
  return nomes.filter((n) => !n.startsWith("vw_")).sort();
}

// --- 2) baixa uma tabela inteira, paginando (PostgREST limita ~1000/req) ------
async function baixarTabela(tabela) {
  // descobre uma coluna estável p/ ordenar a paginação (id > created_at > 1ª col)
  const probe = await sb.from(tabela).select("*").limit(1);
  if (probe.error) throw new Error(probe.error.message);
  const cols = probe.data?.[0] ? Object.keys(probe.data[0]) : [];
  const ordem = cols.includes("id") ? "id" : cols.includes("created_at") ? "created_at" : cols[0];

  const pageSize = 1000;
  const linhas = [];
  for (let from = 0; ; from += pageSize) {
    let q = sb.from(tabela).select("*").range(from, from + pageSize - 1);
    if (ordem) q = q.order(ordem, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    linhas.push(...data);
    if (data.length < pageSize) break;
  }
  return linhas;
}

const manifest = { app: "sistema-expedicoes", timestamp: agora.toISOString(), tabelas: {}, auth_users: 0, erros: [] };

let tabelas = [];
try {
  tabelas = await descobrirTabelas();
} catch (e) {
  console.error("Falha ao descobrir tabelas via OpenAPI:", e.message);
  process.exit(1);
}
console.log(`Tabelas encontradas (${tabelas.length}): ${tabelas.join(", ")}\n`);

for (const t of tabelas) {
  try {
    const linhas = await baixarTabela(t);
    writeFileSync(join(destino, `${t}.json`), JSON.stringify(linhas, null, 2), "utf8");
    manifest.tabelas[t] = linhas.length;
    console.log(`  ✅ ${t.padEnd(28)} ${String(linhas.length).padStart(6)} linhas`);
  } catch (e) {
    manifest.erros.push(`tabela ${t}: ${e.message}`);
    console.log(`  ⛔ ${t.padEnd(28)} ERRO: ${e.message}`);
  }
}

// --- 3) contas de login (auth.users) — não estão em migração ------------------
try {
  const usuarios = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    usuarios.push(...data.users);
    if (data.users.length < 1000) break;
  }
  // guarda só o essencial p/ recriar contas (sem hashes de senha, que a admin API não expõe)
  const enxuto = usuarios.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    email_confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at,
    user_metadata: u.user_metadata,
    role: u.role,
  }));
  writeFileSync(join(destino, "_auth_users.json"), JSON.stringify(enxuto, null, 2), "utf8");
  manifest.auth_users = enxuto.length;
  console.log(`  ✅ ${"auth.users".padEnd(28)} ${String(enxuto.length).padStart(6)} contas`);
} catch (e) {
  manifest.erros.push(`auth.users: ${e.message}`);
  console.log(`  ⛔ auth.users  ERRO: ${e.message}`);
}

writeFileSync(join(destino, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

// --- 4) retenção: mantém os KEEP backups mais novos ---------------------------
let removidos = 0;
try {
  const pastas = readdirSync(baseDir)
    .map((nome) => ({ nome, full: join(baseDir, nome) }))
    .filter((p) => {
      try { return statSync(p.full).isDirectory(); } catch { return false; }
    })
    .sort((a, b) => b.nome.localeCompare(a.nome)); // timestamp ordena lexicograficamente
  for (const p of pastas.slice(KEEP)) {
    rmSync(p.full, { recursive: true, force: true });
    removidos++;
  }
} catch { /* retenção é best-effort */ }

const totalLinhas = Object.values(manifest.tabelas).reduce((a, b) => a + b, 0);
console.log("\n" + linha);
console.log(`Backup OK: ${Object.keys(manifest.tabelas).length} tabelas, ${totalLinhas} linhas, ${manifest.auth_users} contas.`);
if (manifest.erros.length) console.log(`⚠️  ${manifest.erros.length} erro(s) — ver _manifest.json`);
if (removidos) console.log(`Retenção: removidos ${removidos} backup(s) antigo(s) (mantendo ${KEEP}).`);
console.log(`Pasta: ${destino}`);
console.log(linha);
