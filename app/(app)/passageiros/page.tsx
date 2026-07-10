import { listPessoas } from "@/lib/data/pessoas";
import { listExpedicoesComAgregados } from "@/lib/data/expedicoes";
import { listArquivosDePassageiros } from "@/lib/data/arquivos";
import { getCurrentUser } from "@/lib/supabase/auth";
import { PassageirosGlobalTabela } from "./PassageirosGlobalTabela";

// Base consolidada ao vivo — sempre fresca (evita lista estática desatualizada).
export const dynamic = "force-dynamic";

export default async function PassageirosGlobalPage() {
  const [pessoas, expedicoes, arquivos, currentUser] = await Promise.all([
    listPessoas(),
    listExpedicoesComAgregados(),
    listArquivosDePassageiros(),
    getCurrentUser(),
  ]);
  const expedicoesResumo = expedicoes.map((e) => ({ codigo: e.codigo, nome: e.nome }));
  const isAdmin = currentUser?.papel === "admin";

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Passageiros</h1>
        <p className="text-xs text-muted-foreground">
          Base consolidada de todos os passageiros — dados pessoais e histórico de expedições.
        </p>
      </div>
      <PassageirosGlobalTabela pessoas={pessoas} expedicoes={expedicoesResumo} arquivos={arquivos} isAdmin={isAdmin} />
    </div>
  );
}
