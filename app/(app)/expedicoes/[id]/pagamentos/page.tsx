import { listPagamentos, listCustos } from "@/lib/data/expedicoes";
import { listFornecedores } from "@/lib/data/fornecedores";
import { PagamentosTabela } from "./PagamentosTabela";

export default async function PagamentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pagamentos, custos, fornecedores] = await Promise.all([
    listPagamentos(id),
    listCustos(id),
    listFornecedores(),
  ]);
  return (
    <div className="p-4">
      <PagamentosTabela
        expedicaoId={id}
        pagamentos={pagamentos}
        custos={custos}
        fornecedores={fornecedores}
      />
    </div>
  );
}
