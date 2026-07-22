import { listPassageiros, listQuartos, listAlocacoes, getExpedicao } from "@/lib/data/expedicoes";
import { RoomingBoard } from "./RoomingBoard";

export default async function RoomingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos, alocacoes, expedicao] = await Promise.all([
    listPassageiros(id),
    listQuartos(id),
    listAlocacoes(id),
    getExpedicao(id),
  ]);
  return (
    <div className="p-4">
      <RoomingBoard expedicaoId={id} passageiros={pax} quartos={quartos} alocacoes={alocacoes} destino={expedicao?.destino} />
    </div>
  );
}
