import { listInscricoesPendentes, listInscricoesRecusadas } from "./actions";
import { InscricoesPendentes } from "./InscricoesPendentes";
import { listDecisoesInscricao } from "./decisoes";
import { DecisoesLog } from "./DecisoesLog";
import { getCurrentUser } from "@/lib/supabase/auth";

export const metadata = { title: "Inscrições pendentes" };

export default async function InscricoesPage() {
  const [itens, recusadas, user] = await Promise.all([
    listInscricoesPendentes(),
    listInscricoesRecusadas(),
    getCurrentUser(),
  ]);
  // Log de decisões: só admin vê quem aprovou/recusou.
  const isAdmin = user?.papel === "admin";
  const decisoes = isAdmin ? await listDecisoesInscricao() : [];
  return (
    <div className="p-4">
      <InscricoesPendentes itens={itens} recusadas={recusadas} />
      {isAdmin && <DecisoesLog decisoes={decisoes} />}
    </div>
  );
}
