import { listFornecedores } from "@/lib/data/fornecedores";
import { mockExpedicoes, mockCustos } from "@/lib/mock-data";
import { FornecedoresTabela } from "./FornecedoresTabela";

export const metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  const fornecedores = await listFornecedores();
  // Histórico (qtde de expedições por fornecedor) — mock
  const historicoPorFornecedor = new Map<string, number>();
  for (const c of mockCustos) {
    if (!c.fornecedor_id) continue;
    historicoPorFornecedor.set(c.fornecedor_id, (historicoPorFornecedor.get(c.fornecedor_id) ?? 0) + 1);
  }
  // mock_expedicoes used for typing context
  void mockExpedicoes;

  return (
    <div className="p-4">
      <FornecedoresTabela fornecedores={fornecedores} historico={Object.fromEntries(historicoPorFornecedor)} />
    </div>
  );
}
