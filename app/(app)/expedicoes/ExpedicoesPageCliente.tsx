"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Compass, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState as EmptyStateUI } from "@/components/ui/EmptyState";
import { FilterPopover } from "@/components/ui/FilterPopover";
import { ExpedicoesTable } from "@/components/tables/ExpedicoesTable";
import { ExpedicaoCard } from "./ExpedicaoCard";
import { NovaExpedicaoDrawer } from "./NovaExpedicaoDrawer";
import { EditarExpedicaoDrawer } from "./EditarExpedicaoDrawer";
import { STATUS_EXPEDICAO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ExpedicaoComAgregados } from "@/types/database";
import type { Tables } from "@/types/database";
import { daysUntil } from "@/lib/utils";
import { reordenarExpedicoes } from "./actions";
import { toast } from "sonner";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { LiveBadge } from "@/components/ui/LiveBadge";

type PeriodoFiltro = "todos" | "30" | "60" | "90" | "ano";

const PERIODOS: { value: PeriodoFiltro; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "30", label: "Próx. 30d" },
  { value: "60", label: "Próx. 60d" },
  { value: "90", label: "Próx. 90d" },
  { value: "ano", label: "Este ano" },
];

interface Props {
  expedicoes: ExpedicaoComAgregados[];
  usuarios: Tables<"usuarios">[];
}

export function ExpedicoesPageCliente({ expedicoes, usuarios }: Props) {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [statusSel, setStatusSel] = React.useState<Set<string>>(new Set());
  const [destinoSel, setDestinoSel] = React.useState<Set<string>>(new Set());
  const [periodo, setPeriodo] = React.useState<PeriodoFiltro>("todos");
  const [responsavelOp, setResponsavelOp] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [selecionada, setSelecionada] = React.useState<number>(-1);
  const buscaRef = React.useRef<HTMLInputElement>(null);

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [{ table: "expedicoes" }],
  });

  const destinos = React.useMemo(
    () => Array.from(new Set(expedicoes.map((e) => e.destino))).sort(),
    [expedicoes],
  );

  const [view, setView] = React.useState<"cards" | "tabela">("cards");

  const filtradas = React.useMemo(() => {
    return expedicoes.filter((e) => {
      if (statusSel.size > 0 && !statusSel.has(e.status)) return false;
      if (destinoSel.size > 0 && !destinoSel.has(e.destino)) return false;
      if (responsavelOp && e.responsavel_operacional_id !== responsavelOp) return false;
      if (periodo !== "todos") {
        const d = daysUntil(e.data_embarque);
        if (d == null) return false;
        if (periodo === "30" && (d < 0 || d > 30)) return false;
        if (periodo === "60" && (d < 0 || d > 60)) return false;
        if (periodo === "90" && (d < 0 || d > 90)) return false;
        if (periodo === "ano") {
          const thisYear = new Date().getFullYear();
          const yearOfEmbarque = new Date(e.data_embarque).getFullYear();
          if (yearOfEmbarque !== thisYear) return false;
        }
      }
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hay = `${e.codigo} ${e.nome} ${e.destino}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expedicoes, statusSel, destinoSel, periodo, responsavelOp, busca]);

  const limparFiltros = () => {
    setStatusSel(new Set());
    setDestinoSel(new Set());
    setPeriodo("todos");
    setResponsavelOp(null);
    setBusca("");
  };

  const ativaCount = statusSel.size + destinoSel.size + (periodo !== "todos" ? 1 : 0) + (responsavelOp ? 1 : 0);

  const agrupadoPorAno = React.useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const encerrada = (s: string) => s === "Concluída" || s === "Cancelada";
    const grupos = new Map<number | "sem-data", ExpedicaoComAgregados[]>();
    for (const e of filtradas) {
      const key: number | "sem-data" = e.data_embarque
        ? new Date(e.data_embarque).getFullYear()
        : "sem-data";
      const arr = grupos.get(key) ?? [];
      arr.push(e);
      grupos.set(key, arr);
    }
    // Dentro de cada ano: ativas no topo, concluídas/canceladas no rodapé (mantém ordem manual).
    for (const arr of grupos.values()) {
      arr.sort((a, b) => Number(encerrada(a.status)) - Number(encerrada(b.status)));
    }
    // Seções: ano atual/futuro primeiro (crescente), passado depois (decrescente), sem-data por último.
    return Array.from(grupos.entries()).sort(([a], [b]) => {
      const rank = (y: number | "sem-data") => (y === "sem-data" ? 2 : y >= anoAtual ? 0 : 1);
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (a === "sem-data" || b === "sem-data") return 0;
      return ra === 0 ? a - b : b - a;
    });
  }, [filtradas]);

  // Expedição mais próxima a embarcar (ativa, menor dias até o embarque) → ganha destaque.
  const proximaId = React.useMemo(() => {
    let best: string | null = null;
    let bestDias = Infinity;
    for (const e of filtradas) {
      if (e.status === "Concluída" || e.status === "Cancelada") continue;
      const d = daysUntil(e.data_embarque);
      if (d == null || d < 0) continue;
      if (d < bestDias) { bestDias = d; best = e.id; }
    }
    return best;
  }, [filtradas]);

  // Atalhos
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (isInput && e.key !== "Escape") return;
      if (e.key === "/") {
        e.preventDefault();
        buscaRef.current?.focus();
      } else if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDrawerOpen(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelecionada((s) => Math.min(s + 1, filtradas.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelecionada((s) => Math.max(s - 1, -1));
      } else if (e.key === "Enter" && selecionada >= 0 && filtradas[selecionada]) {
        e.preventDefault();
        router.push(`/expedicoes/${filtradas[selecionada].id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtradas, selecionada, router]);

  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const novo = new Set(set);
    if (novo.has(value)) novo.delete(value);
    else novo.add(value);
    return novo;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Expedições</h1>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {filtradas.length} de {expedicoes.length} {expedicoes.length === 1 ? "expedição" : "expedições"}
            {ativaCount > 0 && ` · ${ativaCount} filtro${ativaCount > 1 ? "s" : ""} ativo${ativaCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={buscaRef}
              placeholder="Buscar (código, nome, destino)... [/]"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-7 w-64"
            />
          </div>
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-label="Ver em cards"
              title="Cards"
              className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "cards" ? "bg-[var(--brand-dark)] text-[var(--brand-lime)]" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("tabela")}
              aria-label="Ver em tabela"
              title="Tabela"
              className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "tabela" ? "bg-[var(--brand-dark)] text-[var(--brand-lime)]" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button variant="brand" onClick={() => setDrawerOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova Expedição
            <kbd className="ml-1 hidden sm:inline-flex h-4 items-center rounded border border-[var(--brand-dark)]/30 bg-[var(--brand-dark)]/10 px-1 text-[10px] font-mono">
              n
            </kbd>
          </Button>
        </div>
      </div>

      {/* Filtros (popovers colapsáveis) */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPopover label="Status" count={statusSel.size} active={statusSel.size > 0}>
          <div className="flex flex-col gap-0.5">
            {STATUS_EXPEDICAO.map((s) => {
              const sel = statusSel.has(s);
              return (
                <button
                  key={s}
                  onClick={() => setStatusSel(toggle(statusSel, s))}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md text-left",
                    "hover:bg-muted transition-colors",
                  )}
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0",
                      sel ? "bg-foreground border-foreground" : "border-border",
                    )}
                  >
                    {sel && <X className="h-2.5 w-2.5 text-background rotate-45 -rotate-45" strokeWidth={3} />}
                  </span>
                  <span className={cn(sel && "font-semibold")}>{s}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

        {destinos.length > 0 && (
          <FilterPopover
            label="Destino"
            count={destinoSel.size}
            active={destinoSel.size > 0}
          >
            <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
              {destinos.map((d) => {
                const sel = destinoSel.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => setDestinoSel(toggle(destinoSel, d))}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md text-left",
                      "hover:bg-muted transition-colors",
                    )}
                  >
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded border-2 shrink-0",
                        sel ? "bg-foreground border-foreground" : "border-border",
                      )}
                    />
                    <span className={cn(sel && "font-semibold")}>{d}</span>
                  </button>
                );
              })}
            </div>
          </FilterPopover>
        )}

        <FilterPopover
          label="Período"
          count={periodo !== "todos" ? 1 : 0}
          active={periodo !== "todos"}
          preview={periodo !== "todos" ? PERIODOS.find((p) => p.value === periodo)?.label : undefined}
        >
          <div className="flex flex-col gap-0.5">
            {PERIODOS.map((p) => {
              const sel = periodo === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => setPeriodo(p.value)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md text-left",
                    "hover:bg-muted transition-colors",
                  )}
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                      sel ? "border-foreground" : "border-border",
                    )}
                  >
                    {sel && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                  </span>
                  <span className={cn(sel && "font-semibold")}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

        <FilterPopover
          label="Resp. Op"
          count={responsavelOp ? 1 : 0}
          active={!!responsavelOp}
          preview={
            responsavelOp
              ? usuarios.find((u) => u.id === responsavelOp)?.nome.split(" ")[0]
              : undefined
          }
        >
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setResponsavelOp(null)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md text-left",
                "hover:bg-muted transition-colors",
              )}
            >
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                  responsavelOp === null ? "border-foreground" : "border-border",
                )}
              >
                {responsavelOp === null && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
              </span>
              <span className={cn(responsavelOp === null && "font-semibold")}>Todos</span>
            </button>
            {usuarios
              .filter((u) => u.papel === "operacional" || u.papel === "admin")
              .map((u) => {
                const sel = responsavelOp === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setResponsavelOp(sel ? null : u.id)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md text-left",
                      "hover:bg-muted transition-colors",
                    )}
                  >
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                        sel ? "border-foreground" : "border-border",
                      )}
                    >
                      {sel && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                    </span>
                    <span className={cn(sel && "font-semibold")}>{u.nome}</span>
                  </button>
                );
              })}
          </div>
        </FilterPopover>

        {ativaCount > 0 && (
          <button
            onClick={limparFiltros}
            className="ml-1 text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 h-7 px-2"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela agrupada por ano */}
      {expedicoes.length === 0 ? (
        <EmptyState onCreate={() => setDrawerOpen(true)} />
      ) : filtradas.length === 0 ? (
        <div className="text-xs text-muted-foreground py-10 text-center border border-dashed border-border rounded-lg">
          Nenhuma expedição com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-8">
          {(() => {
            let offset = 0;
            return agrupadoPorAno.map(([ano, lista]) => {
              const offsetGrupo = offset;
              offset += lista.length;
              const statusCount = lista.reduce<Record<string, number>>((acc, e) => {
                acc[e.status] = (acc[e.status] ?? 0) + 1;
                return acc;
              }, {});
              return (
                <section key={String(ano)} className="space-y-2">
                  <header className="flex items-end justify-between gap-3 border-b-2 border-foreground/80 pb-2 sticky top-0 bg-background z-10">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-3xl font-bold tabular-nums tracking-tight">
                        {ano === "sem-data" ? "Sem data" : ano}
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {lista.length} {lista.length === 1 ? "expedição" : "expedições"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {Object.entries(statusCount).map(([s, n]) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 bg-muted/40"
                        >
                          <span className="text-muted-foreground">{s}</span>
                          <span className="font-semibold tabular-nums">{n}</span>
                        </span>
                      ))}
                    </div>
                  </header>
                  {view === "cards" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {lista.map((e) => (
                        <ExpedicaoCard
                          key={e.id}
                          expedicao={e}
                          destaque={e.id === proximaId}
                          onOpen={() => router.push(`/expedicoes/${e.id}`)}
                          onEdit={() => setEditandoId(e.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <ExpedicoesTable
                      expedicoes={lista}
                      destaqueId={proximaId}
                      selecionada={
                        selecionada >= offsetGrupo && selecionada < offsetGrupo + lista.length
                          ? selecionada - offsetGrupo
                          : -1
                      }
                      onRowClick={(e) => router.push(`/expedicoes/${e.id}`)}
                      onEdit={(e) => setEditandoId(e.id)}
                      onReorder={async (novaOrdemDoAno) => {
                        const ordemGlobal = agrupadoPorAno.flatMap(([anoG, listaG]) =>
                          anoG === ano ? novaOrdemDoAno : listaG.map((x) => x.id),
                        );
                        const r = await reordenarExpedicoes(ordemGlobal);
                        if (!r.ok) {
                          toast.error("Erro ao salvar nova ordem", { description: r.error });
                        } else {
                          router.refresh();
                        }
                      }}
                    />
                  )}
                </section>
              );
            });
          })()}
        </div>
      )}

      <NovaExpedicaoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        usuarios={usuarios}
      />

      <EditarExpedicaoDrawer
        expedicao={editandoId ? expedicoes.find((e) => e.id === editandoId) ?? null : null}
        onOpenChange={(open) => !open && setEditandoId(null)}
        usuarios={usuarios}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20">
      <EmptyStateUI
        icon={Compass}
        title="Nenhuma expedição ainda"
        description="Crie sua primeira viagem em grupo para começar a organizar passageiros, prazos, rooming e prontidão — tudo num lugar só."
        actionLabel="Criar primeira expedição"
        onAction={onCreate}
      />
    </div>
  );
}
