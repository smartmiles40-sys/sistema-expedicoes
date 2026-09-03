"use client";
import * as React from "react";
import { Route, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listExtensoesDoPax, marcarExtensao, type ExtensaoPax } from "./extensoes-actions";
import { useSomenteLeitura } from "@/components/layout/PermissoesContext";

/**
 * Seção do perfil do passageiro para o operacional marcar quem CONTRATOU cada
 * extensão da expedição (dias/voos extras). Auto-carrega ao montar. Migration 0052.
 * Mesmo padrão do PasseiosOpcionaisCompra (0044).
 */
export function ExtensoesCompra({
  expedicaoId, passageiroId,
}: {
  expedicaoId: string;
  passageiroId: string;
}) {
  const somenteLeitura = useSomenteLeitura();
  const [extensoes, setExtensoes] = React.useState<ExtensaoPax[] | null>(null);
  const [salvando, setSalvando] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    listExtensoesDoPax(expedicaoId, passageiroId).then((r) => {
      if (vivo) setExtensoes(r);
    });
    return () => { vivo = false; };
  }, [expedicaoId, passageiroId]);

  async function toggle(e: ExtensaoPax, contratou: boolean) {
    setSalvando(e.id);
    // Otimista.
    setExtensoes((s) => s?.map((x) => (x.id === e.id ? { ...x, contratou } : x)) ?? s);
    const r = await marcarExtensao(passageiroId, e.id, contratou, expedicaoId);
    setSalvando(null);
    if (!r.ok) {
      setExtensoes((s) => s?.map((x) => (x.id === e.id ? { ...x, contratou: !contratou } : x)) ?? s);
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  // Enquanto carrega, ou se a expedição não tem extensões → não mostra a seção.
  if (extensoes === null || extensoes.length === 0) return null;

  return (
    <div className="pt-4 border-t border-border space-y-2">
      <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
        <Route className="h-4 w-4 text-lista-600" /> Extensões da viagem
      </h3>
      <p className="text-[11px] text-muted-foreground">
        Marque as extensões que este passageiro contratou. Os dias e voos da extensão só aparecem no portal de quem contratou.
      </p>
      <ul className="space-y-1">
        {extensoes.map((e) => (
          <li key={e.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <input
              type="checkbox"
              checked={e.contratou}
              disabled={salvando === e.id || somenteLeitura}
              onChange={(ev) => toggle(e, ev.target.checked)}
              className={cn("h-4 w-4 rounded border-border", somenteLeitura && "opacity-60")}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{e.nome}</div>
              {e.descricao && <div className="truncate text-[11px] text-muted-foreground">{e.descricao}</div>}
            </div>
            {salvando === e.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {e.contratou && salvando !== e.id && (
              <span className="rounded bg-vinculado-50 px-1.5 py-0.5 text-[11px] font-medium text-vinculado-600">contratou ✓</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
