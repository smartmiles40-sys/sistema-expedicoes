import { listPessoas } from "@/lib/data/pessoas";
import { PassageirosGlobalTabela } from "./PassageirosGlobalTabela";

export default async function PassageirosGlobalPage() {
  const pessoas = await listPessoas();

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Passageiros</h1>
        <p className="text-xs text-muted-foreground">
          Base consolidada de todos os passageiros — dados pessoais e histórico de expedições.
        </p>
      </div>
      <PassageirosGlobalTabela pessoas={pessoas} />
    </div>
  );
}
