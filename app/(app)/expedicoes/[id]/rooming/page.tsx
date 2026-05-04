import { listPassageiros, listQuartos } from "@/lib/data/expedicoes";
import { RoomingBoard } from "./RoomingBoard";

export default async function RoomingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, quartos] = await Promise.all([listPassageiros(id), listQuartos(id)]);
  return (
    <div className="p-4">
      <RoomingBoard expedicaoId={id} passageiros={pax} quartos={quartos} />
    </div>
  );
}
