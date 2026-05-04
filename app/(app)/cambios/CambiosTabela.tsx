"use client";
import * as React from "react";
import { RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { CambioRow } from "@/types/database";
import { toast } from "sonner";

interface Props { cambios: CambioRow[]; }

export function CambiosTabela({ cambios }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Câmbios</h1>
          <p className="text-xs text-muted-foreground">Taxas em BRL — atualizadas manualmente ou via BCB</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Endpoint BCB pendente")}>
          <Globe className="h-3.5 w-3.5" /> Buscar BCB
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
                  className="text-[11px] text-editavel-600 hover:underline inline-flex items-center gap-0.5"
                  onClick={() => toast.info(`Editar taxa ${c.moeda} — drawer pendente`)}
                >
                  <RefreshCw className="h-2.5 w-2.5" /> Atualizar
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
