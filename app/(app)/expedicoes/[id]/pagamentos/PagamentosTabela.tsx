"use client";
import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatMoney, formatDate, daysUntil, cn } from "@/lib/utils";
import { STATUS_PAGAMENTO } from "@/lib/constants";
import type { PagamentoRow, CustoRow, FornecedorRow, StatusPagamento } from "@/types/database";

const STATUS_VARIANT: Record<StatusPagamento, "auto" | "lista" | "vinculado" | "atencao" | "critico"> = {
  Pendente: "auto",
  Programado: "lista",
  Pago: "vinculado",
  Parcial: "atencao",
  Vencido: "critico",
  Cancelado: "auto",
};

interface Props {
  pagamentos: PagamentoRow[];
  custos: CustoRow[];
  fornecedores: FornecedorRow[];
}

export function PagamentosTabela({ pagamentos, custos, fornecedores }: Props) {
  const [statusFiltro, setStatusFiltro] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");

  const fornecedoresById = new Map(fornecedores.map((f) => [f.id, f]));

  const filtrados = pagamentos.filter((p) => {
    if (statusFiltro && p.status !== statusFiltro) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const fornecedor = p.fornecedor_id ? fornecedoresById.get(p.fornecedor_id)?.nome ?? "" : "";
      const hay = `${p.servico} ${fornecedor}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totaisPorMoeda = React.useMemo(() => {
    const m = new Map<string, { total: number; saldo: number }>();
    for (const p of filtrados) {
      const cur = m.get(p.moeda) ?? { total: 0, saldo: 0 };
      cur.total += p.valor_total;
      cur.saldo += p.saldo;
      m.set(p.moeda, cur);
    }
    return Array.from(m.entries());
  }, [filtrados]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-56"
          />
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Status:</span>
            <FilterChip active={statusFiltro === null} onClick={() => setStatusFiltro(null)}>Todos</FilterChip>
            {STATUS_PAGAMENTO.map((s) => (
              <FilterChip key={s} active={statusFiltro === s} onClick={() => setStatusFiltro(statusFiltro === s ? null : s)}>
                {s}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {totaisPorMoeda.map(([moeda, t]) => (
            <div key={moeda} className="flex flex-col items-end">
              <span className="text-[10px] uppercase text-muted-foreground">{moeda}</span>
              <span className="tabular-nums">
                Saldo: <strong>{formatMoney(t.saldo, moeda)}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>Fornecedor</Th>
                <Th>Serviço</Th>
                <Th>Moeda</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Entrada</Th>
                <Th className="text-right">Saldo</Th>
                <Th>Vencimento</Th>
                <Th className="text-right">Dias</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-8">
                    Sem pagamentos nesse filtro.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const fornecedor = p.fornecedor_id ? fornecedoresById.get(p.fornecedor_id) : null;
                  const dias = daysUntil(p.vencimento_saldo);
                  const isVencido = p.status === "Vencido" || (dias != null && dias < 0 && p.status !== "Pago");
                  const isProximo = !isVencido && dias != null && dias < 7 && p.status !== "Pago";
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b border-border",
                        isVencido && "bg-critico-50 dark:bg-critico-50/30",
                        isProximo && "bg-atencao-50 dark:bg-atencao-50/30",
                      )}
                    >
                      <td className="px-2.5">{fornecedor?.nome ?? "—"}</td>
                      <td className="px-2.5">{p.servico}</td>
                      <td className="px-2.5 font-mono text-xs">{p.moeda}</td>
                      <td className="px-2.5 text-right tabular-nums">{formatMoney(p.valor_total, p.moeda)}</td>
                      <td className="px-2.5 text-right tabular-nums text-muted-foreground">
                        {formatMoney(p.entrada, p.moeda)}
                      </td>
                      <td className="px-2.5 text-right tabular-nums font-medium">
                        {formatMoney(p.saldo, p.moeda)}
                      </td>
                      <td className="px-2.5 tabular-nums">{formatDate(p.vencimento_saldo)}</td>
                      <td className="px-2.5 text-right tabular-nums">
                        {dias == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={cn(dias < 0 && "text-critico-600", dias >= 0 && dias < 7 && "text-atencao-600")}>
                            {dias < 0 ? `vencido ${-dias}d` : `${dias}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5">
                        <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5",
        className,
      )}
    >
      {children}
    </th>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
