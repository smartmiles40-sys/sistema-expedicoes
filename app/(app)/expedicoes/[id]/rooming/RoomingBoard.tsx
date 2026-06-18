"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building, Download, Pencil, Wand2, User, Plus, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { excluirQuarto, atualizarPassageiroCampo } from "@/app/(app)/expedicoes/actions";
import { formatDate, cn } from "@/lib/utils";
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
  Twin: 2,
  Duplo: 2,
  Triplo: 3,
  Compartilhado: 4,
  Líder: 2,
};

const SEM_QUARTO = "sem-quarto";

export function RoomingBoard({ expedicaoId, passageiros, quartos }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const quartoEditando = editandoId ? quartos.find((q) => q.id === editandoId) ?? null : null;

  // Cópia local pra atualização otimista do drag (re-sincroniza com o servidor).
  const [localPax, setLocalPax] = React.useState(passageiros);
  React.useEffect(() => setLocalPax(passageiros), [passageiros]);

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "quartos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiros", filter: `expedicao_id=eq.${expedicaoId}` },
    ],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const dndId = React.useId();

  const semQuarto = localPax.filter((p) => !p.quarto_id && p.status_reserva !== "Cancelado");
  const paxByQuarto = new Map<string, PassageiroRow[]>();
  for (const q of quartos) paxByQuarto.set(q.id, []);
  for (const p of localPax) {
    if (p.quarto_id) {
      const arr = paxByQuarto.get(p.quarto_id) ?? [];
      arr.push(p);
      paxByQuarto.set(p.quarto_id, arr);
    }
  }

  async function mover(passageiroId: string, novoQuartoId: string | null) {
    const atual = localPax.find((p) => p.id === passageiroId);
    if (!atual || (atual.quarto_id ?? null) === novoQuartoId) return;
    const anterior = atual.quarto_id ?? null;

    // Capacidade: cada tipo de quarto comporta um número fixo de pessoas.
    if (novoQuartoId) {
      const quarto = quartos.find((q) => q.id === novoQuartoId);
      const cap = quarto ? CAPACIDADE[quarto.tipo] ?? 1 : 1;
      const ocupantesAtuais = localPax.filter(
        (p) => p.quarto_id === novoQuartoId && p.id !== passageiroId,
      ).length;
      if (ocupantesAtuais >= cap) {
        toast.error("Quarto cheio", {
          description: `${quarto?.tipo ?? "Este quarto"} comporta no máximo ${cap} ${cap === 1 ? "pessoa" : "pessoas"}.`,
        });
        return;
      }
    }

    // Otimista
    setLocalPax((prev) =>
      prev.map((p) => (p.id === passageiroId ? { ...p, quarto_id: novoQuartoId } : p)),
    );
    const r = await atualizarPassageiroCampo(passageiroId, "quarto_id", novoQuartoId);
    if (!r.ok) {
      setLocalPax((prev) =>
        prev.map((p) => (p.id === passageiroId ? { ...p, quarto_id: anterior } : p)),
      );
      toast.error("Erro ao mover passageiro", { description: r.error });
      return;
    }
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const destino = over.id === SEM_QUARTO ? null : String(over.id);
    mover(String(active.id), destino);
  }

  function exportarExcel() {
    toast.info("Export pra Excel formatado pro hotel — implementação pendente.");
  }

  function gerarAutomaticamente() {
    toast.info("Heurística de geração automática — pares por preferência ou alfabético — pendente.");
  }

  return (
    <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Rooming list</h2>
              <LiveBadge status={realtimeStatus} />
            </div>
            <p className="text-xs text-muted-foreground">
              {semQuarto.length} sem quarto · {quartos.length} quartos · arraste para alocar
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
          <Dropzone id={SEM_QUARTO} className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Sem quarto</h3>
              <Badge variant="atencao">{semQuarto.length}</Badge>
            </div>
            <div className="space-y-1.5 min-h-[40px]">
              {semQuarto.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">Todos alocados 👌</p>
              ) : (
                semQuarto.map((p) => <PaxCard key={p.id} p={p} />)
              )}
            </div>
          </Dropzone>

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
                  <Dropzone key={q.id} id={q.id} className="rounded-md border border-border bg-background p-3">
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
                    <div className="space-y-1.5 min-h-[40px]">
                      {ocupantes.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic flex items-center gap-1 py-2">
                          <User className="h-3 w-3" /> Arraste passageiros aqui
                        </div>
                      ) : (
                        ocupantes.map((p) => <PaxCard key={p.id} p={p} />)
                      )}
                    </div>
                  </Dropzone>
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
    </DndContext>
  );
}

function Dropzone({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-editavel-600 ring-offset-1")}>
      {children}
    </div>
  );
}

function PaxCard({ p }: { p: PassageiroRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-background p-2 cursor-grab active:cursor-grabbing touch-none select-none",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Avatar nome={p.nome_completo} size={20} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium truncate">{p.nome_completo}</div>
        <div className="text-[10px] text-muted-foreground">{p.tipo}</div>
      </div>
    </div>
  );
}
