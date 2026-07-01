import { listPassageiros, listQuartos, getProntidaoExpedicao, listUsuarios } from "@/lib/data/expedicoes";
import { getExpedicao } from "@/lib/data/expedicoes";
import { listArquivosExpedicao } from "@/lib/data/arquivos";
import { listPessoas } from "@/lib/data/pessoas";
import { construirPosicoesFidelidade } from "@/lib/fidelidade";
import { PassageirosTabela } from "./PassageirosTabela";
import { notFound } from "next/navigation";

export default async function PassageirosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos, expedicao, arquivos, prontidao, usuarios, pessoas] = await Promise.all([
    listPassageiros(id),
    listQuartos(id),
    getExpedicao(id),
    listArquivosExpedicao(id),
    getProntidaoExpedicao(id),
    listUsuarios(),
    listPessoas(),
  ]);
  if (!expedicao) notFound();

  const posicoesFidelidade = construirPosicoesFidelidade(pessoas, id);

  return (
    <div className="p-4">
      <PassageirosTabela
        expedicaoId={id}
        passageiros={pax}
        quartos={quartos}
        arquivos={arquivos}
        dataEmbarque={expedicao.data_embarque}
        dataRetorno={expedicao.data_retorno}
        destino={expedicao.destino}
        prontidao={prontidao}
        usuarios={usuarios}
        pessoas={pessoas}
        posicoesFidelidade={posicoesFidelidade}
      />
    </div>
  );
}
