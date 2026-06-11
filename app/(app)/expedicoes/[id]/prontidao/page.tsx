import { notFound } from "next/navigation";
import { getExpedicao, getProntidaoExpedicao, listUsuarios } from "@/lib/data/expedicoes";
import { ProntidaoTabela } from "./ProntidaoTabela";

export default async function ProntidaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expedicao, linhas, usuarios] = await Promise.all([
    getExpedicao(id),
    getProntidaoExpedicao(id),
    listUsuarios(),
  ]);
  if (!expedicao) notFound();

  return (
    <div className="p-4">
      <ProntidaoTabela
        expedicaoId={id}
        destino={expedicao.destino}
        dataEmbarque={expedicao.data_embarque}
        linhas={linhas}
        usuarios={usuarios}
      />
    </div>
  );
}
