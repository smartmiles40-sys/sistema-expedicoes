import { listCustos } from "@/lib/data/expedicoes";
import { listFornecedores } from "@/lib/data/fornecedores";
import { listCambios } from "@/lib/data/cambios";
import { CustosTabela } from "./CustosTabela";

export default async function CustosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [custos, fornecedores, cambios] = await Promise.all([
    listCustos(id),
    listFornecedores(),
    listCambios(),
  ]);
  return (
    <div className="p-4">
      <CustosTabela expedicaoId={id} custos={custos} fornecedores={fornecedores} cambios={cambios} />
    </div>
  );
}
