import { listExpedicoesComAgregados } from "@/lib/data/expedicoes";
import { listUsuarios } from "@/lib/data/expedicoes";
import { ExpedicoesPageCliente } from "./ExpedicoesPageCliente";

// Dados operacionais ao vivo (prontidão, pax, checklist) — sempre renderizar
// fresco no servidor, senão a lista fica estática/desatualizada na Vercel.
export const dynamic = "force-dynamic";

export const metadata = { title: "Expedições" };

export default async function ExpedicoesPage() {
  const [expedicoes, usuarios] = await Promise.all([
    listExpedicoesComAgregados(),
    listUsuarios(),
  ]);
  return <ExpedicoesPageCliente expedicoes={expedicoes} usuarios={usuarios} />;
}
