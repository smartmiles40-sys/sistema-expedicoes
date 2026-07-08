import { listRoteiroLider } from "@/lib/data/expedicoes";
import { RoteiroLiderEditor } from "./RoteiroLiderEditor";

export default async function RoteiroLiderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dias = await listRoteiroLider(id);
  return <RoteiroLiderEditor expedicaoId={id} dias={dias} />;
}
