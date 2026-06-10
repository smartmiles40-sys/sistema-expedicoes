import { listGruposExpedicao } from "@/lib/data/grupos";
import { GruposPageCliente } from "./GruposPageCliente";

export const metadata = { title: "Grupos" };

export default async function GruposPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const grupos = await listGruposExpedicao(id);
  return <GruposPageCliente expedicaoId={id} grupos={grupos} />;
}
