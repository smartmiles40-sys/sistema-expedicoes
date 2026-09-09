import { listExpedicoesInscricao } from "./actions";
import { InscricaoForm } from "./InscricaoForm";

export const metadata = { title: "Inscrição · Se Tu For, Eu Vou" };
export const dynamic = "force-dynamic";

export default async function InscricaoPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const [expedicoes, sp] = await Promise.all([listExpedicoesInscricao(), searchParams]);
  return <InscricaoForm expedicoes={expedicoes} token={sp.t ?? null} />;
}
