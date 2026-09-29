import { listExpedicoesComAgregados, listUsuarios } from "@/lib/data/expedicoes";
import { ExpedicoesPageCliente } from "../expedicoes/ExpedicoesPageCliente";

// Dados operacionais ao vivo — sempre renderizar fresco no servidor.
export const dynamic = "force-dynamic";

export const metadata = { title: "Pacotes" };

export default async function PacotesPage() {
  const [pacotes, usuarios] = await Promise.all([
    listExpedicoesComAgregados("pacote"),
    listUsuarios(),
  ]);
  return <ExpedicoesPageCliente expedicoes={pacotes} usuarios={usuarios} tipo="pacote" />;
}
