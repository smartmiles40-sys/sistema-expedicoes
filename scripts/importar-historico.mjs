// Importa expedições antigas (2023-2025) da planilha "Base final - clientes consolidados".
// DRY-RUN por padrão (não grava nada). Para gravar: node scripts/importar-historico.mjs --apply
// Lê scripts/_import_historico.json (gerado da aba Clientes).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

// --- env ---------------------------------------------------------------------
function lerEnv(caminho) {
  const env = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}
const env = lerEnv(new URL("../.env.local", import.meta.url));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- helpers -----------------------------------------------------------------
const soDig = (s) => (s ?? "").replace(/\D/g, "");
const cpf11 = (s) => (soDig(s).length === 11 ? s.trim() : null); // mantém formatado se 11 dígitos
function cpfValido(s) {
  const d = soDig(s);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (q) => { let t = 0; for (let i = 0; i < q; i++) t += Number(d[i]) * (q + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
function dataBRtoISO(s) {
  const m = (s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, a] = m;
  const dd = Number(d), mm = Number(mo);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${a}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
const normNome = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// datas placeholder da expedição (concluída; data exata desconhecida)
function datasExp(e) {
  if (e.mes) return { embarque: `${e.ano}-${String(e.mes).padStart(2, "0")}-01`, retorno: `${e.ano}-${String(e.mes).padStart(2, "0")}-11`, prov: "dia provisório" };
  return { embarque: `${e.ano}-07-01`, retorno: `${e.ano}-07-11`, prov: "só ano — provisória" };
}

// --- dados -------------------------------------------------------------------
const base = JSON.parse(readFileSync(new URL("./_import_historico.json", import.meta.url), "utf8"));
const expedicoes = base.expedicoes.map((e, i) => ({ ...e, codigo: `HIST-${String(i + 1).padStart(2, "0")}`, ...datasExp(e) }));
const clientes = base.clientes;

// --- estado atual no banco ---------------------------------------------------
const { data: expExist } = await sb.from("expedicoes").select("id,codigo,nome");
const codigoExist = new Map((expExist ?? []).map((e) => [e.codigo, e]));
const nomeExpExist = new Map((expExist ?? []).map((e) => [normNome(e.nome), e]));
const { data: paxExist } = await sb.from("passageiros").select("cpf,expedicao_id,nome_completo");
const cpfSistema = new Set((paxExist ?? []).map((p) => soDig(p.cpf)).filter((d) => d.length === 11));

// nome normalizado -> CPFs (11 díg.) já existentes no sistema, p/ casar quem vem sem CPF.
const nomeParaCpfs = new Map();
for (const p of paxExist ?? []) {
  const d = soDig(p.cpf);
  if (d.length !== 11) continue;
  const k = normNome(p.nome_completo);
  if (!k) continue;
  const m = nomeParaCpfs.get(k) ?? new Map();
  if (!m.has(d)) m.set(d, p.cpf.trim()); // guarda o CPF formatado do sistema
  nomeParaCpfs.set(k, m);
}

/** Resolve o CPF de um cliente: usa o da planilha; se faltar, casa por nome (1 só). */
function resolverCpf(c) {
  const direto = cpf11(c.cpf);
  if (direto) return { cpf: direto, origem: cpfSistema.has(soDig(direto)) ? "cpf-existe" : "planilha" };
  const m = nomeParaCpfs.get(normNome(c.nome));
  if (m && m.size === 1) return { cpf: [...m.values()][0], origem: "nome" };
  if (m && m.size > 1) return { cpf: null, origem: "ambiguo" };
  return { cpf: null, origem: "novo" };
}
const resolvidos = clientes.map((c) => ({ ...c, ...resolverCpf(c) }));

// --- preview -----------------------------------------------------------------
const L = "=".repeat(70);
console.log(L);
console.log(`IMPORTAÇÃO HISTÓRICO 2023-2025  —  ${APPLY ? "*** APLICANDO (grava no banco) ***" : "DRY-RUN (não grava nada)"}`);
console.log(L);

let semCpf = 0, comCpf = 0, cpfInval = 0, porCpfExiste = 0, porNome = 0, ambiguo = 0;
const matchNome = [], listaAmbiguo = [];
for (const c of resolvidos) {
  if (c.cpf) { comCpf += c.exps.length; if (!cpfValido(c.cpf)) cpfInval++; }
  else semCpf += c.exps.length;
  if (c.origem === "cpf-existe") porCpfExiste++;
  else if (c.origem === "nome") { porNome++; matchNome.push(c); }
  else if (c.origem === "ambiguo") { ambiguo++; listaAmbiguo.push(c); }
}
console.log(`Clientes na planilha (2023-2025) : ${clientes.length}`);
console.log(`Participações a inserir          : ${comCpf + semCpf}  (com CPF: ${comCpf} · sem CPF: ${semCpf})`);
console.log(`Reaproveitados como mesma identidade:`);
console.log(`  • por CPF (já no sistema)      : ${porCpfExiste}`);
console.log(`  • por NOME (sem CPF → adota o existente): ${porNome}`);
console.log(`Nomes AMBÍGUOS (vários CPFs, não casei): ${ambiguo}`);
console.log(`Clientes com CPF inválido (DV)   : ${cpfInval}  (entram mesmo assim, como no import do app)`);

if (matchNome.length) {
  console.log(`\n  --- CASADOS POR NOME (confira) (${matchNome.length}) ---`);
  matchNome.slice(0, 40).forEach((c) => console.log(`    ${c.nome}  →  CPF ${c.cpf}`));
  if (matchNome.length > 40) console.log(`    … e mais ${matchNome.length - 40}`);
}
if (listaAmbiguo.length) {
  console.log(`\n  --- AMBÍGUOS — mesmo nome com +1 CPF no sistema (entram SEM CPF) (${listaAmbiguo.length}) ---`);
  listaAmbiguo.slice(0, 40).forEach((c) => console.log(`    ${c.nome}`));
}

console.log("\nEXPEDIÇÕES A CRIAR (status Concluída):");
console.log("  " + "código".padEnd(9) + "embarque   retorno    destino".padEnd(34) + " nome  /  participações");
const contagem = {};
for (const c of clientes) for (const nome of c.exps) contagem[nome] = (contagem[nome] ?? 0) + 1;
for (const e of expedicoes) {
  const existe = codigoExist.has(e.codigo) || nomeExpExist.has(normNome(e.nome));
  const tag = existe ? "JÁ EXISTE → pula" : `(${e.prov})`;
  console.log(`  ${e.codigo.padEnd(9)}${e.embarque} ${e.retorno} ${e.destino.padEnd(20)} ${String(contagem[e.nome] ?? 0).padStart(3)}px  ${e.nome}  ${tag}`);
}

if (!APPLY) {
  console.log("\n" + L);
  console.log("DRY-RUN concluído. Nada foi gravado.");
  console.log("Para gravar de verdade: node scripts/importar-historico.mjs --apply");
  console.log(L);
  process.exit(0);
}

// --- APPLY -------------------------------------------------------------------
console.log("\n--- gravando expedições ---");
const expIdPorNome = new Map();
for (const e of expedicoes) {
  const existente = codigoExist.get(e.codigo) ?? nomeExpExist.get(normNome(e.nome));
  if (existente) { expIdPorNome.set(e.nome, existente.id); console.log(`  = ${e.nome} (já existia)`); continue; }
  const { data, error } = await sb.from("expedicoes").insert({
    codigo: e.codigo, nome: e.nome, destino: e.destino,
    data_embarque: e.embarque, data_retorno: e.retorno, status: "Concluída",
  }).select("id").single();
  if (error) { console.error(`  ! erro em ${e.nome}: ${error.message}`); continue; }
  expIdPorNome.set(e.nome, data.id);
  console.log(`  + ${e.nome}`);
}

// dedup de passageiros já existentes nessas expedições (idempotência em re-run)
const idsExp = [...expIdPorNome.values()];
const { data: paxNasExp } = await sb.from("passageiros").select("cpf,nome_completo,expedicao_id").in("expedicao_id", idsExp);
const chaveExist = new Set((paxNasExp ?? []).map((p) => `${p.expedicao_id}|${soDig(p.cpf) || "nome:" + normNome(p.nome_completo)}`));

const linhas = [];
for (const c of resolvidos) {
  for (const nome of c.exps) {
    const expId = expIdPorNome.get(nome);
    if (!expId) continue;
    const chave = `${expId}|${soDig(c.cpf) || "nome:" + normNome(c.nome)}`;
    if (chaveExist.has(chave)) continue;
    chaveExist.add(chave);
    linhas.push({
      expedicao_id: expId, nome_completo: c.nome, tipo: "Pagante", status_reserva: "Confirmado",
      cpf: c.cpf, data_nascimento: dataBRtoISO(c.nascimento),
      passaporte: c.passaporte || null, validade_passaporte: dataBRtoISO(c.validade),
    });
  }
}
console.log(`\n--- gravando ${linhas.length} passageiros (em lotes) ---`);
let ok = 0;
for (let i = 0; i < linhas.length; i += 200) {
  const lote = linhas.slice(i, i + 200);
  const { error } = await sb.from("passageiros").insert(lote);
  if (error) { console.error(`  ! erro lote ${i}: ${error.message}`); }
  else { ok += lote.length; console.log(`  + ${ok}/${linhas.length}`); }
}
console.log("\n" + L);
console.log(`Concluído. Expedições: ${expIdPorNome.size}. Passageiros inseridos: ${ok}.`);
console.log(L);
