import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Histórico de compras (negócios ganhos) puxado do Bitrix (tabela `compras_bitrix`,
 * alimentada pelo n8n em /api/bitrix/importar-compras). Aqui só LEITURA + agregação
 * por pessoa (casa por CPF → contato Bitrix → nome), pra montar a base de clientes.
 */
export type CompraBitrix = {
  id: string;
  bitrix_deal_id: string;
  bitrix_contact_id: string | null;
  cpf: string | null;
  nome_contato: string | null;
  titulo: string | null;
  data_compra: string | null;
  valor: number | null;
  moeda: string | null;
  funil: string | null;
  etapa: string | null;
};

export type ClienteCompras = {
  chave: string;
  nome: string;
  cpf: string | null;
  bitrix_contact_id: string | null;
  totalCompras: number;
  totalGasto: number;
  ticketMedio: number;
  moedas: string[];
  funis: string[];
  primeiraCompra: string | null;
  ultimaCompra: string | null;
  compras: CompraBitrix[];
};

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Chave de identidade: CPF → contato Bitrix → nome normalizado. */
function chave(c: CompraBitrix): string {
  if (c.cpf) return `cpf:${c.cpf}`;
  if (c.bitrix_contact_id) return `bx:${c.bitrix_contact_id}`;
  return `nome:${norm(c.nome_contato)}`;
}

async function fetchTodasCompras(): Promise<CompraBitrix[]> {
  const sb = createServiceRoleClient();
  const todas: CompraBitrix[] = [];
  const passo = 1000;
  for (let from = 0; ; from += passo) {
    const { data, error } = await sb
      .from("compras_bitrix")
      .select("*")
      .order("data_compra", { ascending: false })
      .range(from, from + passo - 1);
    if (error) break;
    const lote = (data ?? []) as CompraBitrix[];
    todas.push(...lote);
    if (lote.length < passo) break;
  }
  return todas;
}

export async function listClientesCompras(): Promise<ClienteCompras[]> {
  if (DEV_USE_MOCK_DATA) return [];
  const compras = await fetchTodasCompras();

  const porChave = new Map<string, ClienteCompras>();
  for (const c of compras) {
    const k = chave(c);
    let cli = porChave.get(k);
    if (!cli) {
      cli = {
        chave: k, nome: c.nome_contato ?? "Sem nome", cpf: c.cpf, bitrix_contact_id: c.bitrix_contact_id,
        totalCompras: 0, totalGasto: 0, ticketMedio: 0, moedas: [], funis: [],
        primeiraCompra: null, ultimaCompra: null, compras: [],
      };
      porChave.set(k, cli);
    }
    cli.compras.push(c);
    cli.totalCompras += 1;
    if (c.valor != null) cli.totalGasto += c.valor;
    if (c.moeda && !cli.moedas.includes(c.moeda)) cli.moedas.push(c.moeda);
    if (c.funil && !cli.funis.includes(c.funil)) cli.funis.push(c.funil);
    if (c.nome_contato && (cli.nome === "Sem nome")) cli.nome = c.nome_contato;
    if (!cli.cpf && c.cpf) cli.cpf = c.cpf;
    if (!cli.bitrix_contact_id && c.bitrix_contact_id) cli.bitrix_contact_id = c.bitrix_contact_id;
    if (c.data_compra && (!cli.ultimaCompra || c.data_compra > cli.ultimaCompra)) cli.ultimaCompra = c.data_compra;
    if (c.data_compra && (!cli.primeiraCompra || c.data_compra < cli.primeiraCompra)) cli.primeiraCompra = c.data_compra;
  }
  // Ordena as compras de cada cliente (mais recente primeiro), calcula ticket médio,
  // e ordena a lista por total gasto (padrão: quem mais gastou no topo).
  const lista = [...porChave.values()];
  for (const cli of lista) {
    cli.compras.sort((a, b) => (b.data_compra ?? "").localeCompare(a.data_compra ?? ""));
    cli.ticketMedio = cli.totalCompras > 0 ? cli.totalGasto / cli.totalCompras : 0;
  }
  lista.sort((a, b) => b.totalGasto - a.totalGasto || b.totalCompras - a.totalCompras);
  return lista;
}

/** Compras de UMA pessoa (pra mostrar no perfil global, casando por CPF/contato). */
export async function comprasDaPessoa(cpf: string | null, bitrixContactId: string | null): Promise<CompraBitrix[]> {
  if (DEV_USE_MOCK_DATA) return [];
  if (!cpf && !bitrixContactId) return [];
  const sb = createServiceRoleClient();
  const cpfDig = cpf ? cpf.replace(/\D/g, "") : null;
  let q = sb.from("compras_bitrix").select("*").order("data_compra", { ascending: false });
  if (cpfDig && bitrixContactId) q = q.or(`cpf.eq.${cpfDig},bitrix_contact_id.eq.${bitrixContactId}`);
  else if (cpfDig) q = q.eq("cpf", cpfDig);
  else if (bitrixContactId) q = q.eq("bitrix_contact_id", bitrixContactId);
  const { data } = await q;
  return (data ?? []) as CompraBitrix[];
}
