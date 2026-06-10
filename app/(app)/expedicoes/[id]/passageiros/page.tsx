import { listPassageiros, listQuartos } from "@/lib/data/expedicoes";
import { getExpedicao } from "@/lib/data/expedicoes";
import { listArquivosExpedicao } from "@/lib/data/arquivos";
import { PassageirosTabela } from "./PassageirosTabela";
import { notFound } from "next/navigation";

export default async function PassageirosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos, expedicao, arquivos] = await Promise.all([
    listPassageiros(id),
    listQuartos(id),
    getExpedicao(id),
    listArquivosExpedicao(id),
  ]);
  if (!expedicao) notFound();

  return (
    <div className="p-4">
      <PassageirosTabela
        expedicaoId={id}
        passageiros={pax}
        quartos={quartos}
        arquivos={arquivos}
        dataEmbarque={expedicao.data_embarque}
      />
    </div>
  );
}
