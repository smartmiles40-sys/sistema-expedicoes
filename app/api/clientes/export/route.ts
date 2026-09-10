import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/supabase/auth";
import { listClientesCompras, nomeCompra } from "@/lib/data/compras";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dig = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const maskCpf = (v: string | null) => {
  const d = dig(v);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (v ?? "");
};
const norm = (x: string | null | undefined) =>
  (x ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const brDate = (iso: string | null) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/**
 * Exporta a base de Clientes & Compras (já limpa: sem vendas zeradas e sem
 * negócios duplicados por "#") em Excel. Duas abas: Clientes (agregado) e Compras
 * (detalhado). Enriquece com telefone/e-mail e as expedições da pessoa no sistema
 * (casando por CPF). Só para usuário logado.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const clientes = await listClientesCompras();

  // Enriquecimento por CPF: contato (telefone/e-mail) + expedições no sistema.
  const sb = createServiceRoleClient();
  const expNome = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("expedicoes").select("id,nome").range(from, from + 999);
    for (const e of (data ?? []) as { id: string; nome: string }[]) expNome.set(e.id, e.nome);
    if (!data || data.length < 1000) break;
  }
  type Ct = { email: string | null; telefone: string | null; exps: Set<string> };
  const contatoPorCpf = new Map<string, Ct>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("passageiros")
      .select("cpf,email,telefone,expedicao_id,status_reserva")
      .range(from, from + 999);
    const rows = (data ?? []) as { cpf: string | null; email: string | null; telefone: string | null; expedicao_id: string | null; status_reserva: string | null }[];
    if (!rows.length) break;
    for (const p of rows) {
      const cpf = dig(p.cpf);
      if (cpf.length !== 11) continue;
      let e = contatoPorCpf.get(cpf);
      if (!e) { e = { email: null, telefone: null, exps: new Set() }; contatoPorCpf.set(cpf, e); }
      if (!e.email && p.email) e.email = p.email;
      if (!e.telefone && p.telefone) e.telefone = p.telefone;
      if (p.expedicao_id && (p.status_reserva ?? "").toLowerCase() !== "cancelado") {
        const nome = expNome.get(p.expedicao_id);
        if (nome) e.exps.add(nome);
      }
    }
    if (rows.length < 1000) break;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Se Tu For, Eu Vou";
  wb.created = new Date();
  const AZUL = "FF1F4E79";
  const CINZA = "FFF2F2F2";
  const headerStyle = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    row.alignment = { vertical: "middle" };
    row.height = 20;
  };

  // Aba Clientes
  const wsC = wb.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 1 }] });
  wsC.columns = [
    { header: "Nome", key: "nome", width: 34 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Telefone", key: "tel", width: 18 },
    { header: "E-mail", key: "email", width: 30 },
    { header: "Nº de compras", key: "n", width: 14 },
    { header: "Total gasto (R$)", key: "total", width: 18 },
    { header: "Ticket médio (R$)", key: "ticket", width: 18 },
    { header: "1ª compra", key: "primeira", width: 13 },
    { header: "Última compra", key: "ultima", width: 14 },
    { header: "Funis", key: "funis", width: 34 },
    { header: "Expedições no sistema", key: "exps", width: 50 },
  ];
  headerStyle(wsC.getRow(1));
  for (const cli of clientes) {
    const ct = cli.cpf ? contatoPorCpf.get(dig(cli.cpf)) : null;
    wsC.addRow({
      nome: cli.nome,
      cpf: cli.cpf ? maskCpf(cli.cpf) : "",
      tel: ct?.telefone ?? "",
      email: ct?.email ?? "",
      n: cli.totalCompras,
      total: Math.round(cli.totalGasto * 100) / 100,
      ticket: Math.round(cli.ticketMedio * 100) / 100,
      primeira: brDate(cli.primeiraCompra),
      ultima: brDate(cli.ultimaCompra),
      funis: cli.funis.join(" | "),
      exps: ct ? [...ct.exps].join(" | ") : "",
    });
  }
  wsC.getColumn("total").numFmt = "#,##0.00";
  wsC.getColumn("ticket").numFmt = "#,##0.00";
  wsC.autoFilter = { from: "A1", to: "K1" };
  wsC.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } }; });
  });

  // Aba Compras (detalhado) — achatada da base já limpa.
  const wsD = wb.addWorksheet("Compras (detalhado)", { views: [{ state: "frozen", ySplit: 1 }] });
  wsD.columns = [
    { header: "Nome", key: "nome", width: 34 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Produto (expedição)", key: "produto", width: 36 },
    { header: "Data", key: "data", width: 13 },
    { header: "Valor", key: "valor", width: 15 },
    { header: "Moeda", key: "moeda", width: 9 },
    { header: "Funil", key: "funil", width: 30 },
    { header: "Etapa", key: "etapa", width: 18 },
    { header: "Título (Bitrix)", key: "titulo", width: 34 },
    { header: "Deal ID", key: "deal", width: 12 },
  ];
  headerStyle(wsD.getRow(1));
  const linhas = clientes
    .flatMap((cli) => cli.compras.map((c) => ({ cli, c })))
    .sort((a, b) => norm(a.c.nome_contato).localeCompare(norm(b.c.nome_contato)) || (b.c.data_compra ?? "").localeCompare(a.c.data_compra ?? ""));
  for (const { c } of linhas) {
    wsD.addRow({
      nome: c.nome_contato ?? "",
      cpf: c.cpf ? maskCpf(c.cpf) : "",
      produto: nomeCompra(c),
      data: brDate(c.data_compra),
      valor: c.valor != null ? Math.round(Number(c.valor) * 100) / 100 : null,
      moeda: c.moeda ?? "",
      funil: c.funil ?? "",
      etapa: c.etapa ?? "",
      titulo: c.titulo ?? "",
      deal: c.bitrix_deal_id ?? "",
    });
  }
  wsD.getColumn("valor").numFmt = "#,##0.00";
  wsD.autoFilter = { from: "A1", to: "J1" };

  const buf = await wb.xlsx.writeBuffer();
  const hoje = new Date().toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Clientes_e_Compras_${hoje}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
