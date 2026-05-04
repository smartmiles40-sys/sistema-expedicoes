import { listChecklist } from "@/lib/data/expedicoes";
import { listUsuarios } from "@/lib/data/expedicoes";
import { ChecklistTabela } from "./ChecklistTabela";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [itens, usuarios] = await Promise.all([listChecklist(id), listUsuarios()]);
  return (
    <div className="p-4">
      <ChecklistTabela itens={itens} usuarios={usuarios} />
    </div>
  );
}
