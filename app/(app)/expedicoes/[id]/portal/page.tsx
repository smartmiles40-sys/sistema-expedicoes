import {
  listRoteiro, listVoosExpedicao, listPasseios, listInfoDestino, listAvisos, listRoteiroFotos,
  listPasseiosOpcionais, listExtensoes,
} from "@/lib/data/expedicoes";
import { listGruposExpedicao } from "@/lib/data/grupos";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { getCurrentUser } from "@/lib/supabase/auth";
import { PortalEditor } from "./PortalEditor";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [roteiro, voos, passeios, info, avisos, fotos, passeiosOpcionais, extensoes, grupos] = await Promise.all([
    listRoteiro(id),
    listVoosExpedicao(id),
    listPasseios(id),
    listInfoDestino(id),
    listAvisos(id),
    listRoteiroFotos(id),
    listPasseiosOpcionais(id),
    listExtensoes(id),
    listGruposExpedicao(id),
  ]);

  const user = await getCurrentUser();
  const isAdmin = user?.papel === "admin";

  // Voucher único da hospedagem (coluna em expedicoes, migration 0030).
  let hospedagemVoucherArquivoId: string | null = null;
  if (!DEV_USE_MOCK_DATA) {
    const sb = await getServerClient();
    const { data } = await sb
      .from("expedicoes")
      .select("hospedagem_voucher_arquivo_id")
      .eq("id", id)
      .maybeSingle();
    hospedagemVoucherArquivoId =
      (data as { hospedagem_voucher_arquivo_id: string | null } | null)?.hospedagem_voucher_arquivo_id ?? null;
  }

  return (
    <PortalEditor
      expedicaoId={id}
      roteiro={roteiro}
      voos={voos}
      passeios={passeios}
      info={info}
      avisos={avisos}
      fotos={fotos}
      passeiosOpcionais={passeiosOpcionais}
      extensoes={extensoes}
      grupos={grupos.map((g) => ({ id: g.id, nome: g.nome }))}
      hospedagemVoucherArquivoId={hospedagemVoucherArquivoId}
      isAdmin={isAdmin}
    />
  );
}
