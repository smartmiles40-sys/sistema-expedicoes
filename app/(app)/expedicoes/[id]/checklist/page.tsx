import { listChecklist, listUsuarios, getExpedicao } from "@/lib/data/expedicoes";
import { ChecklistTabela } from "./ChecklistTabela";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [itens, usuarios, expedicao] = await Promise.all([
    listChecklist(id),
    listUsuarios(),
    getExpedicao(id),
  ]);
  return (
    <div className="p-4">
      <ChecklistTabela
        expedicaoId={id}
        itens={itens}
        usuarios={usuarios}
        dataEmbarque={expedicao?.data_embarque ?? null}
      />
    </div>
  );
}
