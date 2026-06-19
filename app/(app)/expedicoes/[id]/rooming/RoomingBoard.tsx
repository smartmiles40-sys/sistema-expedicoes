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
import { Building, Download, Pencil, User, Plus, GripVertical, AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { excluirQuarto, alocarPassageiro, desalocarPassageiro } from "@/app/(app)/expedicoes/actions";
import { formatDate, cn } from "@/lib/utils";
import type { PassageiroRow, QuartoRow, AlocacaoQuartoRow } from "@/types/database";
import { toast } from "sonner";
import { NovoQuartoDrawer } from "./NovoQuartoDrawer";
import { QuartosAutomaticosDrawer } from "./QuartosAutomaticosDrawer";
import { EditarQuartoDrawer } from "./EditarQuartoDrawer";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

interface Props {
  expedicaoId: string;
  passageiros: PassageiroRow[];
  quartos: QuartoRow[];
  alocacoes: AlocacaoQuartoRow[];
}

const CAPACIDADE: Record<string, number> = {
  Single: 1,
  Twin: 2,
  Duplo: 2,
  Triplo: 3,
  Compartilhado: 4,
  Líder: 2,
};

/** Chave do hotel/trecho: mesmo hotel/cidade + mesmas datas de check-in/out. */
function trechoKey(q: { hotel_cidade: string | null; check_in: string | null; check_out: string | null }): string {
  return `${q.hotel_cidade ?? ""}|${q.check_in ?? ""}|${q.check_out ?? ""}`;
}

type Trecho = {
  key: string;
  hotel_cidade: string | null;
  check_in: string | null;
  check_out: string | null;
  quartos: QuartoRow[];
};

export function RoomingBoard({ expedicaoId, passageiros, quartos, alocacoes }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [autoOpen, setAutoOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const quartoEditando = editandoId ? quartos.find((q) => q.id === editandoId) ?? null : null;

  // Cópia local das alocações pra atualização otimista do drag.
  const [localAloc, setLocalAloc] = React.useState(alocacoes);
  React.useEffect(() => setLocalAloc(alocacoes), [alocacoes]);

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "quartos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiros", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiro_quarto" },
    ],
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const dndId = React.useId();

  const paxAtivos = React.useMemo(
    () => passageiros.filter((p) => p.status_reserva !== "Cancelado"),
    [passageiros],
  );
  const paxById = React.useMemo(() => new Map(passageiros.map((p) => [p.id, p])), [passageiros]);

  // Trechos (hotéis) ordenados por check-in.
  const trechos: Trecho[] = React.useMemo(() => {
    const map = new Map<string, Trecho>();
    for (const q of quartos) {
      const k = trechoKey(q);
      if (!map.has(k)) {
        map.set(k, { key: k, hotel_cidade: q.hotel_cidade, check_in: q.check_in, check_out: q.check_out, quartos: [] });
      }
      map.get(k)!.quartos.push(q);
    }
    return Array.from(map.values()).sort((a, b) => (a.check_in ?? "").localeCompare(b.check_in ?? ""));
  }, [quartos]);

  // quarto_id -> paxIds alocados
  const ocupantesPorQuarto = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const q of quartos) m.set(q.id, []);
    for (const a of localAloc) {
      const arr = m.get(a.quarto_id);
      if (arr && paxById.has(a.passageiro_id)) arr.push(a.passageiro_id);
    }
    return m;
  }, [quartos, localAloc, paxById]);

  /** Quarto em que o pax está dentro de um trecho (ou null). */
  function quartoDoPaxNoTrecho(paxId: string, trecho: Trecho): string | null {
    const ids = new Set(trecho.quartos.map((q) => q.id));
    return localAloc.find((a) => a.passageiro_id === paxId && ids.has(a.quarto_id))?.quarto_id ?? null;
  }

  /** Pax sem quarto num trecho (não-cancelados, sem alocação naquele hotel). */
  function semQuartoNoTrecho(trecho: Trecho): PassageiroRow[] {
    return paxAtivos.filter((p) => !quartoDoPaxNoTrecho(p.id, trecho));
  }

  async function alocar(paxId: string, quartoId: string) {
    const quarto = quartos.find((q) => q.id === quartoId);
    if (!quarto) return;
    const cap = CAPACIDADE[quarto.tipo] ?? 1;
    const ocupAtuais = (ocupantesPorQuarto.get(quartoId) ?? []).filter((id) => id !== paxId).length;
    if (ocupAtuais >= cap) {
      toast.error("Quarto cheio", {
        description: `${quarto.tipo} comporta no máximo ${cap} ${cap === 1 ? "pessoa" : "pessoas"}.`,
      });
      return;
    }
    const trecho = trechos.find((t) => t.quartos.some((q) => q.id === quartoId));
    const idsTrecho = new Set(trecho ? trecho.quartos.map((q) => q.id) : [quartoId]);
    const anterior = localAloc;
    setLocalAloc((prev) => [
      ...prev.filter((a) => !(a.passageiro_id === paxId && idsTrecho.has(a.quarto_id))),
      { id: `tmp-${paxId}-${quartoId}`, passageiro_id: paxId, quarto_id: quartoId, created_at: "" },
    ]);
    const r = await alocarPassageiro(paxId, quartoId, expedicaoId);
    if (!r.ok) {
      setLocalAloc(anterior);
      toast.error("Erro ao alocar", { description: r.error });
      return;
    }
    router.refresh();
  }

  async function desalocar(paxId: string, quartoId: string) {
    const anterior = localAloc;
    setLocalAloc((prev) => prev.filter((a) => !(a.passageiro_id === paxId && a.quarto_id === quartoId)));
    const r = await desalocarPassageiro(paxId, quartoId, expedicaoId);
    if (!r.ok) {
      setLocalAloc(anterior);
      toast.error("Erro ao remover do quarto", { description: r.error });
      return;
    }
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const paxId = String(active.id).split("::")[1];
    const overId = String(over.id);
    if (overId.startsWith("sem::")) {
      const trecho = trechos.find((t) => t.key === overId.slice(5));
      const atual = trecho ? quartoDoPaxNoTrecho(paxId, trecho) : null;
      if (atual) desalocar(paxId, atual);
    } else {
      alocar(paxId, overId);
    }
  }

  // Obrigatoriedade: todo pax deve ter quarto em TODOS os hotéis.
  const pendencias = React.useMemo(
    () => trechos.map((t) => ({ trecho: t, faltam: semQuartoNoTrecho(t).length })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trechos, localAloc, paxAtivos],
  );
  const totalFaltam = pendencias.reduce((s, p) => s + p.faltam, 0);
  const completo = trechos.length > 0 && totalFaltam === 0 && paxAtivos.length > 0;

  async function exportarExcel() {
    if (!completo) {
      toast.error("Rooming incompleto", {
        description: "Aloque todos os passageiros em todos os hotéis antes de exportar.",
      });
      return;
    }
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sistema de Expedições";

    const AZUL = "FF2563EB";
    const borda = { style: "thin" as const, color: { argb: "FFE2E8F0" } };
    const todasBordas = { top: borda, left: borda, bottom: borda, right: borda };
    // Separador entre quartos: linha dupla (mais grossa) na base do último ocupante.
    const separador = { style: "double" as const, color: { argb: "FF334155" } };

    // Nome de aba: <=31 chars, sem caracteres proibidos, sem duplicar.
    const usados = new Set<string>();
    const nomeAba = (base: string) => {
      const limpo = (base || "Hotel").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Hotel";
      let cand = limpo;
      let i = 2;
      while (usados.has(cand.toLowerCase())) cand = `${limpo} ${i++}`.slice(0, 31);
      usados.add(cand.toLowerCase());
      return cand;
    };

    for (const t of trechos) {
      const ws = wb.addWorksheet(nomeAba(t.hotel_cidade ?? "Hotel"));
      ws.columns = [{ width: 16 }, { width: 16 }, { width: 34 }, { width: 12 }];

      ws.mergeCells("A1:D1");
      const titulo = ws.getCell("A1");
      titulo.value = `Rooming — ${t.hotel_cidade ?? "Hotel"}`;
      titulo.font = { bold: true, size: 14 };

      ws.mergeCells("A2:D2");
      const sub = ws.getCell("A2");
      sub.value = `Check-in: ${t.check_in ? formatDate(t.check_in) : "—"}    •    Check-out: ${t.check_out ? formatDate(t.check_out) : "—"}`;
      sub.font = { italic: true, color: { argb: "FF64748B" } };

      const head = ws.getRow(4);
      head.values = ["Quarto", "Tipo do quarto", "Passageiro", "Tipo"];
      head.height = 18;
      for (let col = 1; col <= 4; col++) {
        const c = head.getCell(col);
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
        c.alignment = { vertical: "middle" };
        c.border = todasBordas;
      }

      let r = 5;
      for (const q of t.quartos) {
        const ocup = (ocupantesPorQuarto.get(q.id) ?? []).map((id) => paxById.get(id)).filter(Boolean) as PassageiroRow[];
        const linhas: (PassageiroRow | null)[] = ocup.length ? ocup : [null];
        linhas.forEach((p, i) => {
          const ultima = i === linhas.length - 1;
          const row = ws.getRow(r);
          row.getCell(1).value = i === 0 ? `Quarto ${q.numero}` : "";
          row.getCell(2).value = i === 0 ? q.tipo : "";
          row.getCell(3).value = p ? p.nome_completo : "(vazio)";
          row.getCell(4).value = p ? p.tipo : "";
          for (let col = 1; col <= 4; col++) {
            const c = row.getCell(col);
            c.border = { top: borda, left: borda, bottom: ultima ? separador : borda, right: borda };
            if (col <= 2 && i === 0) c.font = { bold: true };
            if (!p) c.font = { italic: true, color: { argb: "FF94A3B8" } };
          }
          r++;
        });
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rooming.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rooming exportado (.xlsx)");
  }

  return (
    <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Rooming list</h2>
              <LiveBadge status={realtimeStatus} />
            </div>
            <p className="text-xs text-muted-foreground">
              {trechos.length} hotel(éis) · {quartos.length} quartos · {paxAtivos.length} passageiros · arraste para alocar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportarExcel}
              disabled={!completo}
              title={completo ? "Exportar rooming" : "Aloque todos em todos os hotéis para liberar a exportação"}
            >
              <Download className="h-3 w-3" /> Exportar Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAutoOpen(true)}>
              <Wand2 className="h-3 w-3" /> Criar quartos automáticos
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="h-3 w-3" /> Novo quarto
            </Button>
          </div>
        </div>

        {/* Faixa de status da obrigatoriedade */}
        {trechos.length > 0 && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border p-2.5 text-[12px]",
              completo
                ? "border-vinculado-600/40 bg-vinculado-100/40 text-vinculado-700"
                : "border-atencao-600/40 bg-atencao-100/40 text-atencao-700",
            )}
          >
            {completo ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
            {completo ? (
              <span>Todos os passageiros estão alocados em todos os hotéis. Exportação liberada. ✅</span>
            ) : (
              <div>
                <strong>Faltam alocar {totalFaltam} no total.</strong> A exportação fica bloqueada até todos terem quarto em cada hotel:
                <ul className="mt-1 list-disc list-inside">
                  {pendencias.filter((p) => p.faltam > 0).map((p) => (
                    <li key={p.trecho.key}>{p.trecho.hotel_cidade ?? "—"}: {p.faltam} sem quarto</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {trechos.length === 0 ? (
          <div className="text-xs text-muted-foreground py-10 text-center border border-dashed border-border rounded-md">
            Nenhum quarto cadastrado. Crie quartos (com hotel e datas) para montar o rooming por hotel.
          </div>
        ) : (
          trechos.map((t) => {
            const sem = semQuartoNoTrecho(t);
            return (
              <section key={t.key} className="rounded-md border border-border">
                <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-[13px] truncate">{t.hotel_cidade ?? "Hotel"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.check_in ? formatDate(t.check_in) : "?"} → {t.check_out ? formatDate(t.check_out) : "?"}
                    </span>
                  </div>
                  <Badge variant={sem.length === 0 ? "vinculado" : "atencao"}>
                    {paxAtivos.length - sem.length}/{paxAtivos.length} alocados
                  </Badge>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
                  {/* Sem quarto neste hotel */}
                  <Dropzone id={`sem::${t.key}`} className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sem quarto</h3>
                      <Badge variant={sem.length === 0 ? "vinculado" : "atencao"}>{sem.length}</Badge>
                    </div>
                    <div className="space-y-1.5 min-h-[40px]">
                      {sem.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-2">Todos alocados neste hotel 👌</p>
                      ) : (
                        sem.map((p) => <PaxCard key={p.id} p={p} trechoKey={t.key} />)
                      )}
                    </div>
                  </Dropzone>

                  {/* Quartos do hotel */}
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {t.quartos.map((q) => {
                      const ocupIds = ocupantesPorQuarto.get(q.id) ?? [];
                      const cap = CAPACIDADE[q.tipo] ?? 1;
                      const cheio = ocupIds.length >= cap;
                      return (
                        <Dropzone key={q.id} id={q.id} className="rounded-md border border-border bg-background p-3">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-[13px] truncate">Quarto {q.numero}</span>
                              <Badge variant="lista">{q.tipo}</Badge>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Badge variant={cheio ? "vinculado" : ocupIds.length > 0 ? "atencao" : "auto"}>
                                {ocupIds.length}/{cap}
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
                                  ocupIds.length > 0
                                    ? `Há ${ocupIds.length} passageiro(s) alocado(s). Eles serão desvinculados deste quarto.`
                                    : "Esta ação não pode ser desfeita."
                                }
                                successMessage="Quarto excluído"
                                onConfirm={() => excluirQuarto(q.id, expedicaoId)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 min-h-[40px]">
                            {ocupIds.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground italic flex items-center gap-1 py-2">
                                <User className="h-3 w-3" /> Arraste passageiros aqui
                              </div>
                            ) : (
                              ocupIds.map((id) => {
                                const p = paxById.get(id);
                                return p ? <PaxCard key={id} p={p} trechoKey={t.key} /> : null;
                              })
                            )}
                          </div>
                        </Dropzone>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })
        )}

        <NovoQuartoDrawer expedicaoId={expedicaoId} open={drawerOpen} onOpenChange={setDrawerOpen} />
        <QuartosAutomaticosDrawer expedicaoId={expedicaoId} open={autoOpen} onOpenChange={setAutoOpen} />
        <EditarQuartoDrawer
          expedicaoId={expedicaoId}
          quarto={quartoEditando}
          onOpenChange={(open) => !open && setEditandoId(null)}
        />
      </div>
    </DndContext>
  );
}

function Dropzone({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-editavel-600 ring-offset-1")}>
      {children}
    </div>
  );
}

function PaxCard({ p, trechoKey }: { p: PassageiroRow; trechoKey: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${trechoKey}::${p.id}` });
  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 50 } : undefined;
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
