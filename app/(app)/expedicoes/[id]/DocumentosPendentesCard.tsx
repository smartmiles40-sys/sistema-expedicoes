"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle2, FileText, ChevronRight } from "lucide-react";
import { ProntidaoPaxDrawer } from "./passageiros/ProntidaoPaxDrawer";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";
import type { ArquivoRow, Tables } from "@/types/database";

interface Props {
  expedicaoId: string;
  destino: string;
  prontidao: ProntidaoPassageiro[];
  usuarios: Tables<"usuarios">[];
  arquivos: ArquivoRow[];
}

/**
 * Card "Documentos pendentes" da Visão Geral. Deriva as pendências do MOTOR DE
 * PRONTIDÃO (passageiro_requisitos) — a fonte de verdade — e não mais da tabela
 * antiga `documentos`. Cada passageiro é clicável e abre o ProntidaoPaxDrawer
 * pra concluir a pendência (status do seguro/visto/vacina, contrato, etc).
 */
export function DocumentosPendentesCard({
  expedicaoId,
  destino,
  prontidao,
  usuarios,
  arquivos,
}: Props) {
  // Guarda o ID e deriva o item da lista atual — assim, após router.refresh
  // (ex.: aprovar o seguro), o drawer mostra o estado já atualizado.
  const [abertoId, setAbertoId] = React.useState<string | null>(null);
  const aberto = abertoId
    ? prontidao.find((p) => p.passageiro.id === abertoId) ?? null
    : null;

  const pendentes = prontidao
    .map((item) => ({
      item,
      faltas: item.resultado.checagens.filter(
        (c) => c.semaforo === "atencao" || c.semaforo === "bloqueio",
      ),
    }))
    .filter((p) => p.faltas.length > 0)
    .sort((a, b) => {
      // bloqueios primeiro, depois por nome
      const ba = a.faltas.some((c) => c.semaforo === "bloqueio") ? 0 : 1;
      const bb = b.faltas.some((c) => c.semaforo === "bloqueio") ? 0 : 1;
      return (
        ba - bb ||
        a.item.passageiro.nome_completo.localeCompare(b.item.passageiro.nome_completo, "pt-BR")
      );
    });

  const top = pendentes.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Documentos pendentes (top 5)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-vinculado-600" /> Tudo OK.
          </p>
        ) : (
          top.map(({ item, faltas }) => {
            const temBloqueio = faltas.some((c) => c.semaforo === "bloqueio");
            return (
              <button
                key={item.passageiro.id}
                type="button"
                onClick={() => setAbertoId(item.passageiro.id)}
                title="Abrir pendências do passageiro"
                className="w-full flex items-center justify-between rounded-md p-2 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate text-editavel-700 hover:underline">
                    {item.passageiro.nome_completo}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {faltas.map((c) => c.tipo).join(" · ")}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={temBloqueio ? "critico" : "atencao"}>{faltas.length}</Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            );
          })
        )}
      </CardContent>

      {aberto && (
        <ProntidaoPaxDrawer
          expedicaoId={expedicaoId}
          destino={destino}
          item={aberto}
          usuarios={usuarios}
          arquivos={arquivos}
          onClose={() => setAbertoId(null)}
        />
      )}
    </Card>
  );
}
