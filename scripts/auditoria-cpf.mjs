// Auditoria de CPF dos passageiros — SOMENTE LEITURA (nenhuma escrita no banco).
// Replica a regra de lib/cpf.ts (cpfValido) para bater 100% com o app.
// Uso: node scripts/auditoria-cpf.mjs
import { readFileSync } from "node:fs";
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

// --- regra de CPF (cópia fiel de lib/cpf.ts) ----------------------------------
const soDigitos = (cpf) => (cpf ?? "").replace(/\D/g, "");
function cpfValido(cpf) {
  const d = soDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const dv = (qtd) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(d[i]) * (qtd + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
const normalizarNome = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// --- main ---------------------------------------------------------------------
const env = lerEnv(new URL("../.env.local", import.meta.url));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: exps, error: e1 } = await sb.from("expedicoes").select("id,codigo,nome,destino,status");
if (e1) { console.error("Erro lendo expedicoes:", e1.message); process.exit(1); }
const expById = new Map(exps.map((e) => [e.id, e]));

const { data: pax, error: e2 } = await sb
  .from("passageiros")
  .select("id,nome_completo,cpf,expedicao_id,status_reserva,tipo");
if (e2) { console.error("Erro lendo passageiros:", e2.message); process.exit(1); }

const labelExp = (id) => {
  if (!id) return "(avulso / sem expedição)";
  const e = expById.get(id);
  return e ? `${e.nome} [${e.destino}]` : `(expedição ${id})`;
};

// classificação
const semCpf = [];
const malFormado = [];   // tem algo, mas != 11 dígitos
const dvInvalido = [];   // 11 dígitos mas reprova dígito verificador (inclui todos iguais)
const validos = [];      // cpf ok
for (const p of pax) {
  const d = soDigitos(p.cpf);
  if (!d) semCpf.push(p);
  else if (d.length !== 11) malFormado.push(p);
  else if (!cpfValido(d)) dvInvalido.push(p);
  else validos.push({ ...p, _d: d });
}

const ativos = (arr) => arr.filter((p) => p.status_reserva !== "Cancelado");

// duplicados por CPF válido (mesma pessoa)
const porCpf = new Map();
for (const p of validos) {
  const arr = porCpf.get(p._d) ?? [];
  arr.push(p);
  porCpf.set(p._d, arr);
}
const cpfMultiplos = [...porCpf.entries()].filter(([, arr]) => arr.length > 1);
const cpfMesmaExp = cpfMultiplos.filter(([, arr]) => {
  const exps = arr.map((p) => p.expedicao_id);
  return new Set(exps).size !== exps.length; // mesmo CPF 2x na mesma expedição
});

// possíveis duplicados SEM cpf — mesmo nome normalizado
const porNomeSemCpf = new Map();
for (const p of semCpf) {
  const n = normalizarNome(p.nome_completo);
  if (!n) continue;
  const arr = porNomeSemCpf.get(n) ?? [];
  arr.push(p);
  porNomeSemCpf.set(n, arr);
}
const nomeSemCpfDup = [...porNomeSemCpf.entries()].filter(([, arr]) => arr.length > 1);

// --- saída --------------------------------------------------------------------
const linha = "=".repeat(64);
console.log(linha);
console.log("AUDITORIA DE CPF DOS PASSAGEIROS  (somente leitura)");
console.log(linha);
console.log(`Total de linhas de passageiro : ${pax.length}`);
console.log(`  não-cancelados              : ${ativos(pax).length}`);
console.log("");
console.log("RESUMO POR QUALIDADE DO CPF (todos | não-cancelados)");
console.log(`  ✅ CPF válido        : ${validos.length}\t| ${ativos(validos).length}`);
console.log(`  ⛔ Sem CPF           : ${semCpf.length}\t| ${ativos(semCpf).length}`);
console.log(`  ⚠️  Formato inválido  : ${malFormado.length}\t| ${ativos(malFormado).length}  (≠ 11 dígitos)`);
console.log(`  ⚠️  Dígito verificador: ${dvInvalido.length}\t| ${ativos(dvInvalido).length}  (11 díg., mas DV/0000 inválido)`);
console.log("");
console.log(`Identidades distintas com CPF válido : ${porCpf.size}`);
console.log(`CPFs em +1 expedição (mesma pessoa)  : ${cpfMultiplos.length}`);
console.log(`⚠️  CPF repetido na MESMA expedição   : ${cpfMesmaExp.length}  (não deveria ocorrer)`);
console.log(`⚠️  Nomes repetidos entre os SEM CPF  : ${nomeSemCpfDup.length} grupos`);

function bloco(titulo, itens, fmt, max = 100) {
  console.log("\n" + "-".repeat(64));
  console.log(`${titulo}  (${itens.length})`);
  console.log("-".repeat(64));
  if (itens.length === 0) { console.log("  (nenhum)"); return; }
  itens.slice(0, max).forEach((x) => console.log("  " + fmt(x)));
  if (itens.length > max) console.log(`  … e mais ${itens.length - max}`);
}

const fmtPax = (p) =>
  `${(p.cpf ?? "").padEnd(16)} ${p.nome_completo}  ·  ${p.status_reserva}/${p.tipo}  ·  ${labelExp(p.expedicao_id)}`;

bloco("⚠️ CPF COM FORMATO INVÁLIDO (≠ 11 dígitos)", malFormado, fmtPax);
bloco("⚠️ CPF COM DÍGITO VERIFICADOR INVÁLIDO", dvInvalido, fmtPax);

console.log("\n" + "-".repeat(64));
console.log(`⛔ SEM CPF — por expedição  (${semCpf.length})`);
console.log("-".repeat(64));
const semCpfPorExp = new Map();
for (const p of semCpf) {
  const k = labelExp(p.expedicao_id);
  semCpfPorExp.set(k, (semCpfPorExp.get(k) ?? 0) + 1);
}
[...semCpfPorExp.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));

console.log("\n" + "-".repeat(64));
console.log(`⚠️ NOMES IGUAIS ENTRE OS SEM CPF (possíveis duplicados)  (${nomeSemCpfDup.length} grupos)`);
console.log("-".repeat(64));
if (nomeSemCpfDup.length === 0) console.log("  (nenhum)");
nomeSemCpfDup.slice(0, 50).forEach(([nome, arr]) => {
  console.log(`  • ${arr[0].nome_completo}  (${arr.length}×)`);
  arr.forEach((p) => console.log(`      - ${p.status_reserva}/${p.tipo} · ${labelExp(p.expedicao_id)}`));
});

if (cpfMesmaExp.length) {
  console.log("\n" + "-".repeat(64));
  console.log(`⚠️ CPF REPETIDO NA MESMA EXPEDIÇÃO  (${cpfMesmaExp.length})`);
  console.log("-".repeat(64));
  cpfMesmaExp.forEach(([d, arr]) => {
    console.log(`  • CPF ${d}:`);
    arr.forEach((p) => console.log(`      - ${p.nome_completo} · ${labelExp(p.expedicao_id)}`));
  });
}

console.log("\n" + linha);
console.log("Fim do relatório. Nada foi alterado no banco.");
console.log(linha);
