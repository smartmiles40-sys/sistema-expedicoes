import { listRoteiroLider } from "@/lib/data/expedicoes";
import { listArquivosExpedicao } from "@/lib/data/arquivos";
import { MARCADOR_DOC_LIDER } from "@/lib/constants";
import { RoteiroLiderEditor } from "./RoteiroLiderEditor";
import { DocsLiderPanel } from "./DocsLiderPanel";

export default async function RoteiroLiderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dias, arquivos] = await Promise.all([
    listRoteiroLider(id),
    listArquivosExpedicao(id),
  ]);
  const docs = arquivos
    .filter((a) => a.passageiro_id == null && (a.descricao ?? "") === MARCADOR_DOC_LIDER)
    .map((a) => ({ id: a.id, nome: a.nome, mime: a.mime }));
  return (
    <div className="space-y-4">
      <DocsLiderPanel expedicaoId={id} docs={docs} />
      <RoteiroLiderEditor expedicaoId={id} dias={dias} />
    </div>
  );
}
