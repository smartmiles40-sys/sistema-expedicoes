"use client";
import * as React from "react";
import Link from "next/link";
import { Search, BellOff, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDate } from "@/lib/utils";
import type { AlertaOperacional } from "@/lib/data/expedicoes";

type Filtro = "todos" | "critico" | "atencao";

const DOT: Record<"critico" | "atencao", string> = {
  critico: "bg-critico-600",
  atencao: "bg-atencao-600",
};

export function AvisosLista({ alertas }: { alertas: AlertaOperacional[] }) {
  const [filtro, setFiltro] = React.useState<Filtro>("todos");
  const [busca, setBusca] = React.useState("");

  const criticos = alertas.filter((a) => a.severidade === "critico").length;
  const atencoes = alertas.filter((a) => a.severidade === "atencao").length;

  const termo = busca.trim().toLowerCase();
  const filtrados = alertas.filter((a) => {
    if (filtro !== "todos" && a.severidade !== filtro) return false;
    if (termo && !`${a.passageiro_nome} ${a.expedicao_nome} ${a.rotulo}`.toLowerCase().includes(termo))
      return false;
    return true;
  });

  // Agrupa por expedição preservando a ordem (já vem ordenado por urgência).
  const grupos: { expedicao_id: string; expedicao_nome: string; data_embarque: string; dias: number; itens: AlertaOperacional[] }[] = [];
  const idx = new Map<string, number>();
  for (const a of filtrados) {
    let i = idx.get(a.expedicao_id);
    if (i == null) {
      i = grupos.length;
      idx.set(a.expedicao_id, i);
      grupos.push({ expedicao_id: a.expedicao_id, expedicao_nome: a.expedicao_nome, data_embarque: a.data_embarque, dias: a.dias_ate_embarque, itens: [] });
    }
    grupos[i].itens.push(a);
  }

  return (
    <div className="space-y-4">
      {/* Resumo + filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(["todos", "critico", "atencao"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors",
                filtro === f
                  ? "border-[var(--brand-dark)] bg-[var(--brand-dark)] text-[var(--brand-lime)]"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {f === "todos" ? `Todos (${alertas.length})` : f === "critico" ? `Críticos (${criticos})` : `Atenção (${atencoes})`}
            </button>
          ))}
        </div>
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar passageiro/expedição…" className="pl-7" />
        </div>
      </div>

      {grupos.length === 0 ? (
        alertas.length === 0 ? (
          <div className="rounded-2xl border border-vinculado-600/30 bg-vinculado-50 dark:bg-vinculado-600/10">
            <EmptyState
              icon={BellOff}
              title="Tudo dentro do prazo"
              description="Nenhum aviso no momento — passaportes, vistos, documentos e prazos das expedições estão em dia. 🎉"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-background p-10 text-center text-muted-foreground">
            <BellOff className="mx-auto mb-2 h-6 w-6 opacity-60" />
            Nenhum aviso para o filtro/busca atual.
          </div>
        )
      ) : (
        grupos.map((g) => (
          <div key={g.expedicao_id} className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <Link href={`/expedicoes/${g.expedicao_id}/passageiros`} className="text-[13px] font-semibold hover:underline truncate">
                  {g.expedicao_nome}
                </Link>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  embarque {formatDate(g.data_embarque)} · faltam {g.dias} dia(s)
                </span>
              </div>
              <Badge variant={g.dias <= 30 ? "critico" : "atencao"}>{g.itens.length} aviso(s)</Badge>
            </div>
            <ul>
              {g.itens.map((a, i) => (
                <li key={`${a.passageiro_id}-${a.tipo}-${i}`}>
                  <Link
                    href={`/expedicoes/${a.expedicao_id}/passageiros?editar=${a.passageiro_id}`}
                    className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-0 hover:bg-accent/30 transition-colors group"
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT[a.severidade])} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{a.passageiro_nome}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.rotulo}{a.detalhe ? ` — ${a.detalhe}` : ""}
                      </div>
                    </div>
                    <Badge variant={a.severidade === "critico" ? "critico" : "atencao"}>{a.tipo}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
