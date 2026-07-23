import { listInscricoesPendentes, listInscricoesRecusadas } from "./actions";
import { InscricoesPendentes } from "./InscricoesPendentes";

export const metadata = { title: "Inscrições pendentes" };

export default async function InscricoesPage() {
  const [itens, recusadas] = await Promise.all([
    listInscricoesPendentes(),
    listInscricoesRecusadas(),
  ]);
  return (
    <div className="p-4">
      <InscricoesPendentes itens={itens} recusadas={recusadas} />
    </div>
  );
}
