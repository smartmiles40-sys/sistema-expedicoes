import { listReceitasPendentes } from "./actions";
import { ReceitasTabela } from "./ReceitasTabela";

export const metadata = { title: "Receitas pendentes" };
export const dynamic = "force-dynamic";

export default async function ReceitasPage() {
  const itens = await listReceitasPendentes();
  return (
    <div className="p-4">
      <ReceitasTabela itens={itens} />
    </div>
  );
}
