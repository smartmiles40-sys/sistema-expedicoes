import {
  listExpedicoesComAgregados,
  getResumoProcessos,
  getResumoProntidao,
} from "@/lib/data/expedicoes";
import { DashboardCliente } from "./DashboardCliente";

export default async function DashboardPage() {
  const [expedicoes, processos, prontidao] = await Promise.all([
    listExpedicoesComAgregados(),
    getResumoProcessos(),
    getResumoProntidao(),
  ]);
  return (
    <DashboardCliente expedicoes={expedicoes} processos={processos} prontidao={prontidao} />
  );
}
