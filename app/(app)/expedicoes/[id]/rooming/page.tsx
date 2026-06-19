import { listPassageiros, listQuartos, listAlocacoes } from "@/lib/data/expedicoes";
import { RoomingBoard } from "./RoomingBoard";

export default async function RoomingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos, alocacoes] = await Promise.all([
    listPassageiros(id),
    listQuartos(id),
    listAlocacoes(id),
  ]);
  return (
    <div className="p-4">
      <RoomingBoard expedicaoId={id} passageiros={pax} quartos={quartos} alocacoes={alocacoes} />
    </div>
  );
}
