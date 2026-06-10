import { listExpedicoesComAgregados, getResumoProcessos } from "@/lib/data/expedicoes";
import { DashboardCliente } from "./DashboardCliente";

export default async function DashboardPage() {
  const [expedicoes, processos] = await Promise.all([
    listExpedicoesComAgregados(),
    getResumoProcessos(),
  ]);
  return <DashboardCliente expedicoes={expedicoes} processos={processos} />;
}
