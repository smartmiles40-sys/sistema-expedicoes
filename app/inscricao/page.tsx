import { listExpedicoesInscricao } from "./actions";
import { InscricaoForm } from "./InscricaoForm";

export const metadata = { title: "Inscrição · Se Tu For, Eu Vou" };
export const dynamic = "force-dynamic";

export default async function InscricaoPage() {
  const expedicoes = await listExpedicoesInscricao();
  return <InscricaoForm expedicoes={expedicoes} />;
}
