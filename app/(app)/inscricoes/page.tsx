import { listInscricoesPendentes } from "./actions";
import { InscricoesPendentes } from "./InscricoesPendentes";

export const metadata = { title: "Inscrições pendentes" };

export default async function InscricoesPage() {
  const itens = await listInscricoesPendentes();
  return (
    <div className="p-4">
      <InscricoesPendentes itens={itens} />
    </div>
  );
}
