import { listPassageiros, listQuartos, listAlocacoes, getExpedicao } from "@/lib/data/expedicoes";
import { listGruposExpedicao } from "@/lib/data/grupos";
import { RoomingBoard } from "./RoomingBoard";

export default async function RoomingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos, alocacoes, expedicao, grupos] = await Promise.all([
    listPassageiros(id),
    listQuartos(id),
    listAlocacoes(id),
    getExpedicao(id),
    listGruposExpedicao(id),
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
      />
    </div>
  );
}
