"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import type { CambioRow } from "@/types/database";
import { toast } from "sonner";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { sincronizarCambios } from "./actions";

interface Props { cambios: CambioRow[]; }

export function CambiosTabela({ cambios }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [{ table: "cambios" }],
  });

  async function sincronizar() {
    setLoading(true);
    try {
      const json = await sincronizarCambios();
      if (!json.ok) {
        toast.error(`Falha ao buscar taxas: ${json.error}`);
        return;
      }
      toast.success(`${json.atualizados} taxas atualizadas`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Câmbios</h1>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            Taxas em BRL — sincronizadas via open.er-api.com (cron de hora em hora)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={sincronizar} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          {loading ? "Buscando..." : "Atualizar agora"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cambios.map((c) => (
          <Card key={c.moeda}>
            <CardContent className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-semibold">{c.moeda}</span>
                <Badge variant="auto">BRL</Badge>
              </div>
              <div className="text-xl font-semibold tabular-nums">
                R$ {c.taxa_brl.toFixed(c.taxa_brl < 1 ? 4 : 2)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">
                  Atualizado {formatDateTime(c.atualizado_em)}
                </span>
                <button
                  className="text-[11px] text-editavel-600 hover:underline inline-flex items-center gap-0.5 disabled:opacity-50"
                  onClick={sincronizar}
                  disabled={loading}
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
