"use client";
import * as React from "react";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { EditableCell } from "@/components/tables/EditableCell";
import { atualizarCustoCampo, excluirCusto } from "@/app/(app)/expedicoes/actions";
import { formatBRL, formatMoney, formatDate, cn } from "@/lib/utils";
import { CATEGORIA_CUSTO, type CategoriaCusto } from "@/lib/constants";
import type { CustoRow, FornecedorRow, CambioRow, StatusCusto } from "@/types/database";
import { NovoCustoDrawer } from "./NovoCustoDrawer";
import { EditarCustoDrawer } from "./EditarCustoDrawer";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

const STATUS_VARIANT: Record<StatusCusto, "auto" | "lista" | "vinculado" | "atencao" | "critico"> = {
  "A programar": "auto",
  Programado: "lista",
  Pago: "vinculado",
  Parcial: "atencao",
  Vencido: "critico",
};

interface Props {
  expedicaoId: string;
  custos: CustoRow[];
  fornecedores: FornecedorRow[];
  cambios: CambioRow[];
}

export function CustosTabela({ expedicaoId, custos, fornecedores, cambios }: Props) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const custoEditando = editandoId ? custos.find((c) => c.id === editandoId) ?? null : null;
  const fornecedoresById = new Map(fornecedores.map((f) => [f.id, f]));

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "custos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "cambios" },
    ],
  });

  const grupos = React.useMemo(() => {
    const m = new Map<CategoriaCusto, CustoRow[]>();
    for (const c of CATEGORIA_CUSTO) m.set(c, []);
    for (const c of custos) {
      const arr = m.get(c.categoria) ?? [];
      arr.push(c);
      m.set(c.categoria, arr);
    }
    return Array.from(m.entries()).filter(([, arr]) => arr.length > 0);
  }, [custos]);

  const totalGeral = custos.reduce((s, c) => s + c.valor_planejado_brl, 0);
  const totalRealizado = custos.reduce((s, c) => s + (c.valor_realizado_brl ?? 0), 0);

  function toggle(cat: string) {
    const novo = new Set(collapsed);
    if (novo.has(cat)) novo.delete(cat);
    else novo.add(cat);
    setCollapsed(novo);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Custos</h2>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-xs text-muted-foreground">{custos.length} itens lançados</p>
        </div>
        <Button size="sm" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-3 w-3" /> Novo Custo
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>Serviço</Th>
                <Th>Fornecedor</Th>
                <Th>Cidade / Data</Th>
                <Th>Moeda</Th>
                <Th className="text-right">Plan.</Th>
                <Th className="text-right">BRL Plan.</Th>
                <Th className="text-right">Real.</Th>
                <Th className="text-right">BRL Real.</Th>
                <Th className="text-right">Diferença</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(([cat, items]) => {
                const isCollapsed = collapsed.has(cat);
                const subtotalPlan = items.reduce((s, c) => s + c.valor_planejado_brl, 0);
                const subtotalReal = items.reduce((s, c) => s + (c.valor_realizado_brl ?? 0), 0);
                return (
                  <React.Fragment key={cat}>
                    <tr
                      className="bg-muted/30 border-b border-border cursor-pointer hover:bg-muted/50"
                      onClick={() => toggle(cat)}
                    >
                      <td colSpan={5} className="px-2.5 font-semibold">
                        <div className="flex items-center gap-1">
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          {cat}
                          <Badge variant="auto" className="ml-1.5">{items.length}</Badge>
                        </div>
                      </td>
                      <td className="text-right tabular-nums px-2.5">{formatBRL(subtotalPlan, 0)}</td>
                      <td colSpan={2} className="text-right tabular-nums px-2.5">{formatBRL(subtotalReal, 0)}</td>
                      <td className="px-2.5 text-right tabular-nums">
                        {subtotalReal > 0 && (
                          <span className={cn(subtotalReal > subtotalPlan ? "text-critico-600" : "text-vinculado-600")}>
                            {formatBRL(subtotalReal - subtotalPlan, 0)}
                          </span>
                        )}
                      </td>
                      <td />
                      <td />
                    </tr>
                    {!isCollapsed &&
                      items.map((c) => {
                        const fornecedor = c.fornecedor_id ? fornecedoresById.get(c.fornecedor_id) : null;
                        const diff =
                          c.valor_realizado_brl != null ? c.valor_realizado_brl - c.valor_planejado_brl : null;
                        return (
                          <tr key={c.id} className="border-b border-border hover:bg-accent/30">
                            <td className="px-2.5">
                              <EditableCell
                                value={c.servico}
                                onSave={(v) => atualizarCustoCampo(c.id, "servico", v)}
                              />
                            </td>
                            <td className="px-2.5 text-muted-foreground">{fornecedor?.nome ?? "—"}</td>
                            <td className="px-2.5 text-muted-foreground text-[12px]">
                              {c.cidade ?? "—"}
                              {c.data_servico && <span className="block text-[11px]">{formatDate(c.data_servico)}</span>}
                            </td>
                            <td className="px-2.5 font-mono text-xs">{c.moeda}</td>
                            <td className="text-right">
                              <EditableCell
                                value={c.valor_planejado}
                                onSave={(v) => atualizarCustoCampo(c.id, "valor_planejado", v)}
                                type="number"
                                className="text-right"
                              />
                            </td>
                            <td className="text-right tabular-nums px-2.5 text-muted-foreground">
                              {formatBRL(c.valor_planejado_brl, 0)}
                            </td>
                            <td className="text-right">
                              <EditableCell
                                value={c.valor_realizado}
                                onSave={(v) => atualizarCustoCampo(c.id, "valor_realizado", v)}
                                type="number"
                                className="text-right"
                              />
                            </td>
                            <td className="text-right tabular-nums px-2.5 text-muted-foreground">
                              {c.valor_realizado_brl != null ? formatBRL(c.valor_realizado_brl, 0) : "—"}
                            </td>
                            <td className="text-right tabular-nums px-2.5">
                              {diff != null ? (
                                <span className={cn(diff > 0 ? "text-critico-600" : diff < 0 ? "text-vinculado-600" : "text-muted-foreground")}>
                                  {diff > 0 ? "+" : ""}{formatMoney(diff, "BRL")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2.5">
                              <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                            </td>
                            <td className="w-16 px-1">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditandoId(c.id)}
                                  aria-label="Editar custo"
                                  title="Editar"
                                  className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <ConfirmDeleteButton
                                  ariaLabel="Excluir custo"
                                  title={`Excluir "${c.servico}"?`}
                                  description="Esta ação não pode ser desfeita. Se houver pagamento vinculado, a exclusão será bloqueada."
                                  successMessage="Custo excluído"
                                  onConfirm={() => excluirCusto(c.id, expedicaoId)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              <tr className="bg-muted/50 border-t-2 border-border font-semibold">
                <td colSpan={5} className="px-2.5">Total geral</td>
                <td className="text-right tabular-nums px-2.5">{formatBRL(totalGeral, 0)}</td>
                <td colSpan={2} className="text-right tabular-nums px-2.5">{formatBRL(totalRealizado, 0)}</td>
                <td className="text-right tabular-nums px-2.5">
                  {totalRealizado > 0 && (
                    <span className={cn(totalRealizado > totalGeral ? "text-critico-600" : "text-vinculado-600")}>
                      {formatBRL(totalRealizado - totalGeral, 0)}
                    </span>
                  )}
                </td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <NovoCustoDrawer
        expedicaoId={expedicaoId}
        fornecedores={fornecedores}
        cambios={cambios}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <EditarCustoDrawer
        expedicaoId={expedicaoId}
        custo={custoEditando}
        fornecedores={fornecedores}
        cambios={cambios}
        onOpenChange={(open) => !open && setEditandoId(null)}
      />
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
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
