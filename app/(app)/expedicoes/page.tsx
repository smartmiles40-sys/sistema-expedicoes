import { listExpedicoesComAgregados } from "@/lib/data/expedicoes";
import { listUsuarios } from "@/lib/data/expedicoes";
import { ExpedicoesPageCliente } from "./ExpedicoesPageCliente";

export const metadata = { title: "Expedições" };

export default async function ExpedicoesPage() {
  const [expedicoes, usuarios] = await Promise.all([
    listExpedicoesComAgregados(),
    listUsuarios(),
  ]);
  return <ExpedicoesPageCliente expedicoes={expedicoes} usuarios={usuarios} />;
}
