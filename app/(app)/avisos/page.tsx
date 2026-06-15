import { getAlertasOperacionais } from "@/lib/data/expedicoes";
import { AvisosLista } from "./AvisosLista";

export default async function AvisosPage() {
  const alertas = await getAlertasOperacionais();

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Avisos operacionais</h1>
        <p className="text-xs text-muted-foreground">
          Pendências por passageiro nas expedições que se aproximam do embarque.
          As janelas de cada tipo são configuráveis em <code>lib/alertas/regras.ts</code>.
        </p>
      </div>
      <AvisosLista alertas={alertas} />
    </div>
  );
}
