import { listPassageiros, listQuartos, listAlocacoes, getExpedicao, listExtensoes, listContratacoesExtensao } from "@/lib/data/expedicoes";
import { listGruposExpedicao } from "@/lib/data/grupos";
import { RoomingBoard } from "./RoomingBoard";

export default async function RoomingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos, alocacoes, expedicao, grupos, extensoes, contratacoes] = await Promise.all([
    listPassageiros(id),
    listQuartos(id),
    listAlocacoes(id),
    getExpedicao(id),
    listGruposExpedicao(id),
    listExtensoes(id),
    listContratacoesExtensao(id),
  ]);
  return (
    <div className="p-4">
      <RoomingBoard
        expedicaoId={id}
        passageiros={pax}
        quartos={quartos}
        alocacoes={alocacoes}
        destino={expedicao?.destino}
        grupos={grupos.map((g) => ({ id: g.id, nome: g.nome }))}
        extensoes={extensoes.map((e) => ({ id: e.id, nome: e.nome }))}
        contratacoesExtensao={contratacoes}
      />
    </div>
  );
}
