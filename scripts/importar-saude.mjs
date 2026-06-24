// Cruza o CSV de saúde (Bitrix) com os passageiros do sistema e grava o jsonb `saude`.
// DRY-RUN por padrão. Aplicar: node scripts/importar-saude.mjs --apply
// Lê scripts/_saude_import.json (gerado do CSV, já sem as expedições de 2027).
// Casa por CPF exato e por nome exato único; fuzzy/ambíguo NÃO é aplicado (revisão manual).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue;
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const soDig = (s) => (s ?? "").replace(/\D/g, "");
const norm = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function lev(a, b) { const dp = Array.from({ length: a.length + 1 }, (_, i) => i); for (let j = 1; j <= b.length; j++) { let p = dp[0]; dp[0] = j; for (let i = 1; i <= a.length; i++) { const t = dp[i]; dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return dp[a.length]; }

// Casamentos confirmados manualmente por expedição (nome CSV normalizado -> CPF no sistema).
// Vazio no repositório: na carga de 2026-06-24 este mapa teve 8 entradas com CPFs
// reais (PII), preenchidas após conferência manual por expedição. Não versionar CPFs.
const OVERRIDES = {};

const linhas = JSON.parse(readFileSync(new URL("./_saude_import.json", import.meta.url), "utf8")).linhas;
const { data: pax } = await sb.from("passageiros").select("id,nome_completo,cpf,expedicao_id");

// agrupa passageiros do sistema por IDENTIDADE (cpf 11 díg., senão nome normalizado)
const grupos = new Map(); // chave -> { cpf, nome, ids:[] }
for (const p of pax) {
  const d = soDig(p.cpf);
  const chave = d.length === 11 ? "cpf:" + d : "nome:" + norm(p.nome_completo);
  const g = grupos.get(chave) ?? { cpf: d.length === 11 ? d : null, nome: p.nome_completo, ids: [] };
  g.ids.push(p.id);
  grupos.set(chave, g);
}
const porCpf = new Map(); for (const g of grupos.values()) if (g.cpf) porCpf.set(g.cpf, g);
const porNome = new Map(); // normNome -> set de grupos
for (const g of grupos.values()) { const k = norm(g.nome); const s = porNome.get(k) ?? new Set(); s.add(g); porNome.set(k, s); }

const matches = [], proxNome = [], ambiguos = [], naoAchados = [];
for (const row of linhas) {
  const ov = OVERRIDES[norm(row.nome)];
  if (ov && porCpf.has(soDig(ov))) { matches.push({ row, g: porCpf.get(soDig(ov)), via: "expedição" }); continue; }
  const d = soDig(row.cpf);
  if (d.length === 11 && porCpf.has(d)) { matches.push({ row, g: porCpf.get(d), via: "CPF" }); continue; }
  const gs = porNome.get(norm(row.nome));
  if (gs && gs.size === 1) { matches.push({ row, g: [...gs][0], via: "nome" }); continue; }
  if (gs && gs.size > 1) { ambiguos.push(row); continue; }
  // fuzzy: nome com distância <= 2
  let best = null, bestD = 99;
  for (const g of grupos.values()) { const dist = lev(norm(row.nome), norm(g.nome)); if (dist < bestD) { bestD = dist; best = g; } }
  if (best && bestD <= 2) proxNome.push({ row, g: best, dist: bestD });
  else naoAchados.push(row);
}

const L = "=".repeat(68);
console.log(L);
console.log(`IMPORTAR SAÚDE — ${APPLY ? "*** APLICANDO ***" : "DRY-RUN (não grava)"}`);
console.log(L);
console.log(`Linhas do CSV (sem 2027): ${linhas.length}`);
console.log(`  ✅ casados (CPF + nome único): ${matches.length}`);
console.log(`  ⚠️ provável (nome parecido, NÃO aplico): ${proxNome.length}`);
console.log(`  ⚠️ ambíguo (mesmo nome p/ +1 pessoa): ${ambiguos.length}`);
console.log(`  ⛔ não encontrados no sistema: ${naoAchados.length}`);

console.log(`\n--- CASADOS (${matches.length}) ---`);
matches.forEach((m) => console.log(`  + ${m.row.nome}  [${m.via}]  → ${m.g.ids.length} linha(s)  · ${Object.keys(m.row.saude).length} respostas`));
if (proxNome.length) { console.log(`\n--- PROVÁVEL — revisar (${proxNome.length}) ---`); proxNome.forEach((m) => console.log(`  ~ "${m.row.nome}"  ≈  "${m.g.nome}"  (dist ${m.dist})`)); }
if (ambiguos.length) { console.log(`\n--- AMBÍGUOS (${ambiguos.length}) ---`); ambiguos.forEach((r) => console.log(`  ? ${r.nome}`)); }
if (naoAchados.length) { console.log(`\n--- NÃO ENCONTRADOS (${naoAchados.length}) ---`); naoAchados.forEach((r) => console.log(`  - ${r.nome}  ${r.cpf ? "(CPF " + r.cpf + ")" : "(sem CPF)"}`)); }

if (!APPLY) {
  console.log(`\nDRY-RUN. Nada gravado. Para aplicar os ${matches.length} casados: node scripts/importar-saude.mjs --apply`);
  console.log(L); process.exit(0);
}

console.log("\n--- gravando (saude nas linhas de cada pessoa casada) ---");
let ok = 0;
for (const m of matches) {
  const { error } = await sb.from("passageiros").update({ saude: m.row.saude }).in("id", m.g.ids);
  if (error) console.error(`  ! ${m.row.nome}: ${error.message}`);
  else { ok++; console.log(`  + ${m.row.nome} (${m.g.ids.length} linha(s))`); }
}
console.log(`\nConcluído. Pessoas atualizadas: ${ok}/${matches.length}.`);
console.log(L);
