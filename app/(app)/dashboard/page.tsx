import { listExpedicoesComAgregados } from "@/lib/data/expedicoes";
import { DashboardCliente } from "./DashboardCliente";

export default async function DashboardPage() {
  const expedicoes = await listExpedicoesComAgregados();
  return <DashboardCliente expedicoes={expedicoes} />;
}
