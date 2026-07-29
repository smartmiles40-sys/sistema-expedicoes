"use client";
import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listPasseiosOpcionaisDoPax, marcarCompraPasseioOpcional, type PasseioOpcionalPax,
} from "./passeios-opcionais-actions";
import { useSomenteLeitura } from "@/components/layout/PermissoesContext";

/**
 * Seção do perfil do passageiro para o operacional marcar MANUALMENTE quais passeios
 * opcionais o passageiro comprou. Auto-carrega a lista da expedição ao montar.
 * Migration 0044.
 */
export function PasseiosOpcionaisCompra({
  expedicaoId, passageiroId,
}: {
  expedicaoId: string;
  passageiroId: string;
}) {
  const somenteLeitura = useSomenteLeitura();
  const [passeios, setPasseios] = React.useState<PasseioOpcionalPax[] | null>(null);
  const [salvando, setSalvando] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    listPasseiosOpcionaisDoPax(expedicaoId, passageiroId).then((r) => {
      if (vivo) setPasseios(r);
    });
    return () => { vivo = false; };
  }, [expedicaoId, passageiroId]);

  async function toggle(p: PasseioOpcionalPax, comprou: boolean) {
    setSalvando(p.id);
    // Otimista.
    setPasseios((s) => s?.map((x) => (x.id === p.id ? { ...x, comprou } : x)) ?? s);
    const r = await marcarCompraPasseioOpcional(passageiroId, p.id, comprou, expedicaoId);
    setSalvando(null);
    if (!r.ok) {
      setPasseios((s) => s?.map((x) => (x.id === p.id ? { ...x, comprou: !comprou } : x)) ?? s);
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  // Enquanto carrega, ou se a expedição não tem passeios opcionais → não mostra a seção.
  if (passeios === null || passeios.length === 0) return null;

  return (
    <div className="pt-4 border-t border-border space-y-2">
      <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-lista-600" /> Passeios opcionais
      </h3>
      <p className="text-[11px] text-muted-foreground">
        Marque o que o passageiro comprou. O passeio marcado aparece “confirmado” no portal dele (no lugar do dia livre).
      </p>
      <ul className="space-y-1">
        {passeios.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <input
              type="checkbox"
              checked={p.comprou}
              disabled={salvando === p.id || somenteLeitura}
              onChange={(e) => toggle(p, e.target.checked)}
              className={cn("h-4 w-4 rounded border-border", somenteLeitura && "opacity-60")}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{p.titulo || "Passeio opcional"}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                Dia {p.dia ?? "?"} · {p.dia_titulo}
              </div>
            </div>
            {salvando === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {p.comprou && salvando !== p.id && (
              <span className="rounded bg-vinculado-50 px-1.5 py-0.5 text-[11px] font-medium text-vinculado-600">comprou ✓</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
