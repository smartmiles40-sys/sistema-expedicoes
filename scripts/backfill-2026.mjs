// Backfill das expedições de 2026 (completa o que faltou do import anterior).
// DRY-RUN por padrão. Aplicar: node scripts/backfill-2026.mjs --apply
// Regras definidas: descarta "Emilio de Lima Silva" (sem CPF; fica só o ...Lima com CPF).
// Tailândia: planilha "G1 e G2" -> sistema G1 (TAI1); "G3 e G4" -> sistema G2 (TAI2).
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
const cpf11 = (s) => (soDig(s).length === 11 ? s.trim() : null);
const norm = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const dataISO = (s) => { const m = (s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return null; const [, d, mo, a] = m; if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null; return `${a}-${String(+mo).padStart(2, "0")}-${String(+d).padStart(2, "0")}`; };

const EXCLUIR = new Set(["emilio de lima silva"]); // descartado por decisão (fica o ...Lima com CPF)
const MAP = {
  "Islândia Fev26": ["ISL-2026-02"], "Japão & China Março2026": ["JAPCHI-2026-03"],
  "Peru Maio26": ["PER-2026-05"], "Peru Agosto26": ["PER-2026-08"], "Egito Setembro26": ["EGI-2026-09"],
  "Japão Outubro26": ["JAPCHI-2026-10"], "Egito Outubro26": ["EGI-2026-10"],
};
const TAILANDIA_COLS = ["Tailândia Nov26 G1 e G2", "Tailândia Nov26 G3 e G4"];
const TAILANDIA_CODS = ["TAI1-2026-11", "TAI2-2026-11"];

const base = JSON.parse(readFileSync(new URL("./_full_matrix.json", import.meta.url), "utf8"));
const { data: exps } = await sb.from("expedicoes").select("id,codigo,nome");
const { data: pax } = await sb.from("passageiros").select("id,nome_completo,cpf,expedicao_id");
const idDe = new Map(exps.map((e) => [e.codigo, e.id]));
const paxDaExp = (ids) => pax.filter((p) => ids.includes(p.expedicao_id));

const nomeCpf = new Map();
for (const p of pax) { const d = soDig(p.cpf); if (d.length !== 11) continue; const k = norm(p.nome_completo); const mm = nomeCpf.get(k) ?? new Map(); if (!mm.has(d)) mm.set(d, p.cpf.trim()); nomeCpf.set(k, mm); }
const resolverCpf = (c) => { const dir = cpf11(c.cpf); if (dir) return dir; const mm = nomeCpf.get(norm(c.nome)); return mm && mm.size === 1 ? [...mm.values()][0] : null; };

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}
// Detecta grafia diferente da MESMA pessoa: igual, substring, mesmo 1º+último nome,
// ou distância de edição <= 2 (typos). Evita falso-positivo de sobrenome comum.
function grafiaSimilar(nome, existentes) {
  const a = norm(nome), t = a.split(" ").filter(Boolean);
  for (const e of existentes) {
    const b = norm(e), te = b.split(" ").filter(Boolean);
    if (a === b || a.includes(b) || b.includes(a)) return e;
    if (t.length && te.length && t[0] === te[0] && t[t.length - 1] === te[te.length - 1]) return e;
    if (lev(a, b) <= 2) return e;
  }
  return null;
}

const L = "=".repeat(70);
console.log(L);
console.log(`BACKFILL 2026 — ${APPLY ? "*** APLICANDO ***" : "DRY-RUN (não grava)"}`);
console.log(L);

const aInserir = [];
let totLimpo = 0, totGrafia = 0, totExcl = 0;

function processarColuna(colNomes, presenceCods, targetFn) {
  const ids = presenceCods.map((c) => idDe.get(c)).filter(Boolean);
  const naExp = paxDaExp(ids);
  const cpfSet = new Set(naExp.map((p) => soDig(p.cpf)).filter((d) => d.length === 11));
  const nomeSet = new Set(naExp.map((p) => norm(p.nome_completo)));
  const nomesExistentes = naExp.map((p) => p.nome_completo);
  const limpos = [], grafias = [];
  for (const c of base.clientes) {
    if (!c.exps.some((e) => colNomes.includes(e))) continue;
    if (EXCLUIR.has(norm(c.nome))) { totExcl++; continue; }
    const d = soDig(c.cpf);
    if ((d.length === 11 && cpfSet.has(d)) || nomeSet.has(norm(c.nome))) continue;
    const sim = grafiaSimilar(c.nome, nomesExistentes);
    if (sim) { grafias.push({ c, sim }); continue; }
    limpos.push(c);
    aInserir.push({ expId: targetFn(c), cliente: c });
  }
  console.log(`\n--- ${colNomes.join(" / ")}  [${presenceCods.join(",")}]  (já na exp: ${naExp.length}) ---`);
  console.log(`  Inserir: ${limpos.length}  |  possível grafia (pulo): ${grafias.length}`);
  limpos.forEach((c) => console.log(`    + ${c.nome}  ${cpf11(c.cpf) ? "(CPF planilha)" : resolverCpf(c) ? "(CPF p/ nome)" : "(sem CPF)"}`));
  grafias.forEach((g) => console.log(`    ~ ${g.c.nome}  ≈ "${g.sim}"`));
  totLimpo += limpos.length; totGrafia += grafias.length;
}

for (const [col, cods] of Object.entries(MAP)) processarColuna([col], cods, () => idDe.get(cods[0]));
processarColuna(TAILANDIA_COLS, TAILANDIA_CODS, (c) =>
  c.exps.includes("Tailândia Nov26 G1 e G2") ? idDe.get("TAI1-2026-11") : idDe.get("TAI2-2026-11"));

console.log("\n" + L);
console.log(`A inserir: ${totLimpo}  |  pulados (grafia, já no sistema): ${totGrafia}  |  descartados (Emilio sem CPF): ${totExcl}`);

if (!APPLY) {
  console.log("\nDRY-RUN. Nada gravado. Para aplicar: node scripts/backfill-2026.mjs --apply");
  console.log(L); process.exit(0);
}

console.log("\n--- gravando ---");
const linhas = aInserir.map(({ expId, cliente: c }) => ({
  expedicao_id: expId, nome_completo: c.nome, tipo: "Pagante", status_reserva: "Confirmado",
  cpf: resolverCpf(c), data_nascimento: dataISO(c.nascimento),
  passaporte: c.passaporte || null, validade_passaporte: dataISO(c.validade),
}));
let ok = 0;
for (let i = 0; i < linhas.length; i += 200) {
  const lote = linhas.slice(i, i + 200);
  const { error } = await sb.from("passageiros").insert(lote);
  if (error) console.error(`  ! erro lote ${i}: ${error.message}`); else { ok += lote.length; console.log(`  + ${ok}/${linhas.length}`); }
}
console.log(`\nConcluído. Inseridos: ${ok}.`);
console.log(L);
