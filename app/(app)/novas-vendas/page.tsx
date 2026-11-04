import { listNovasVendas } from "./actions";
import { NovasVendasTabela } from "./NovasVendasTabela";

export const metadata = { title: "Novas vendas" };
export const dynamic = "force-dynamic";

export default async function NovasVendasPage() {
  const itens = await listNovasVendas();
  return (
    <div className="p-4">
      <NovasVendasTabela itens={itens} />
    </div>
  );
}
