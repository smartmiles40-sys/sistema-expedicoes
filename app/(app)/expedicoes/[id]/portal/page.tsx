import {
  listRoteiro, listVoosExpedicao, listPasseios, listInfoDestino, listAvisos, listRoteiroFotos,
} from "@/lib/data/expedicoes";
import { PortalEditor } from "./PortalEditor";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [roteiro, voos, passeios, info, avisos, fotos] = await Promise.all([
    listRoteiro(id),
    listVoosExpedicao(id),
    listPasseios(id),
    listInfoDestino(id),
    listAvisos(id),
    listRoteiroFotos(id),
  ]);
  return (
    <PortalEditor
      expedicaoId={id}
      roteiro={roteiro}
      voos={voos}
      passeios={passeios}
      info={info}
      avisos={avisos}
      fotos={fotos}
    />
  );
}
