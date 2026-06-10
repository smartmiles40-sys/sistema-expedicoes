"use client";
import * as React from "react";
import { Building, Download, Pencil, Wand2, User, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { excluirQuarto } from "@/app/(app)/expedicoes/actions";
import { formatDate } from "@/lib/utils";
import type { PassageiroRow, QuartoRow } from "@/types/database";
import { toast } from "sonner";
import { NovoQuartoDrawer } from "./NovoQuartoDrawer";
import { EditarQuartoDrawer } from "./EditarQuartoDrawer";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

interface Props {
  expedicaoId: string;
  passageiros: PassageiroRow[];
  quartos: QuartoRow[];
}

const CAPACIDADE: Record<string, number> = {
  Single: 1,
  Duplo: 2,
  Twin: 2,
  Triplo: 3,
  Compartilhado: 4,
  Líder: 1,
};

export function RoomingBoard({ expedicaoId, passageiros, quartos }: Props) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const quartoEditando = editandoId ? quartos.find((q) => q.id === editandoId) ?? null : null;

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "quartos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiros", filter: `expedicao_id=eq.${expedicaoId}` },
    ],
  });
  const semQuarto = passageiros.filter((p) => !p.quarto_id && p.status_reserva !== "Cancelado");
  const paxByQuarto = new Map<string, PassageiroRow[]>();
  for (const q of quartos) paxByQuarto.set(q.id, []);
  for (const p of passageiros) {
    if (p.quarto_id) {
      const arr = paxByQuarto.get(p.quarto_id) ?? [];
      arr.push(p);
      paxByQuarto.set(p.quarto_id, arr);
    }
  }

  function exportarExcel() {
    toast.info("Export pra Excel formatado pro hotel — implementação pendente.");
  }

  function gerarAutomaticamente() {
    toast.info("Heurística de geração automática — pares por preferência ou alfabético — pendente.");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Rooming list</h2>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {semQuarto.length} sem quarto · {quartos.length} quartos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={gerarAutomaticamente}>
            <Wand2 className="h-3 w-3" /> Gerar automaticamente
          </Button>
          <Button variant="outline" size="sm" onClick={exportarExcel}>
            <Download className="h-3 w-3" /> Exportar Excel
          </Button>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-3 w-3" /> Novo quarto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Sem quarto */}
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Sem quarto</h3>
            <Badge variant="atencao">{semQuarto.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {semQuarto.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">Todos alocados 👌</p>
            ) : (
              semQuarto.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background p-2 cursor-grab"
                  draggable
                >
                  <Avatar nome={p.nome_completo} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{p.nome_completo}</div>
                    <div className="text-[10px] text-muted-foreground">{p.tipo}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Drag-and-drop para alocar (visual; persistência implementa em rodada futura).
          </p>
        </div>

        {/* Quartos */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quartos.length === 0 ? (
            <div className="col-span-full text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
              Nenhum quarto cadastrado.
            </div>
          ) : (
            quartos.map((q) => {
              const ocupantes = paxByQuarto.get(q.id) ?? [];
              const cap = CAPACIDADE[q.tipo] ?? 1;
              const cheio = ocupantes.length >= cap;
              return (
                <div key={q.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-[13px] truncate">Quarto {q.numero}</span>
                      <Badge variant="lista">{q.tipo}</Badge>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Badge variant={cheio ? "vinculado" : ocupantes.length > 0 ? "atencao" : "auto"}>
                        {ocupantes.length}/{cap}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => setEditandoId(q.id)}
                        aria-label="Editar quarto"
                        title="Editar"
                        className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <ConfirmDeleteButton
                        ariaLabel="Excluir quarto"
                        title={`Excluir quarto ${q.numero}?`}
                        description={
                          ocupantes.length > 0
                            ? `Há ${ocupantes.length} passageiro(s) alocado(s). Eles serão desvinculados.`
                            : "Esta ação não pode ser desfeita."
                        }
                        successMessage="Quarto excluído"
                        onConfirm={() => excluirQuarto(q.id, expedicaoId)}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2">
                    {q.hotel_cidade} · {formatDate(q.check_in)} → {formatDate(q.check_out)}
                  </div>
                  <div className="space-y-1">
                    {ocupantes.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic flex items-center gap-1 py-2">
                        <User className="h-3 w-3" /> Vazio
                      </div>
                    ) : (
                      ocupantes.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5 text-[12px]">
                          <Avatar nome={p.nome_completo} size={16} />
                          {p.nome_completo}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <NovoQuartoDrawer
        expedicaoId={expedicaoId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <EditarQuartoDrawer
        expedicaoId={expedicaoId}
        quarto={quartoEditando}
        onOpenChange={(open) => !open && setEditandoId(null)}
      />
    </div>
  );
}
