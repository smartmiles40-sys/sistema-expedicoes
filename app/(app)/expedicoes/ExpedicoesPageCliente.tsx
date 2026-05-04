"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ExpedicoesTable } from "@/components/tables/ExpedicoesTable";
import { NovaExpedicaoDrawer } from "./NovaExpedicaoDrawer";
import { STATUS_EXPEDICAO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ExpedicaoComAgregados } from "@/types/database";
import type { Tables } from "@/types/database";
import { daysUntil } from "@/lib/utils";

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
  const [selecionada, setSelecionada] = React.useState<number>(-1);
  const buscaRef = React.useRef<HTMLInputElement>(null);

  const destinos = React.useMemo(
    () => Array.from(new Set(expedicoes.map((e) => e.destino))).sort(),
    [expedicoes],
  );

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
          <h1 className="text-lg font-semibold">Expedições</h1>
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
          <Button onClick={() => setDrawerOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova Expedição
            <kbd className="ml-1 hidden sm:inline-flex h-4 items-center rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 text-[10px] font-mono">
              n
            </kbd>
          </Button>
        </div>
      </div>

      {/* Filtros chips */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterGroup label="Status">
          {STATUS_EXPEDICAO.map((s) => (
            <FilterChip
              key={s}
              active={statusSel.has(s)}
              onClick={() => setStatusSel(toggle(statusSel, s))}
            >
              {s}
            </FilterChip>
          ))}
        </FilterGroup>

        {destinos.length > 0 && (
          <FilterGroup label="Destino">
            {destinos.map((d) => (
              <FilterChip
                key={d}
                active={destinoSel.has(d)}
                onClick={() => setDestinoSel(toggle(destinoSel, d))}
              >
                {d}
              </FilterChip>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="Período">
          {PERIODOS.map((p) => (
            <FilterChip
              key={p.value}
              active={periodo === p.value}
              onClick={() => setPeriodo(p.value)}
            >
              {p.label}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="Resp. Op">
          <FilterChip
            active={responsavelOp === null}
            onClick={() => setResponsavelOp(null)}
          >
            Todos
          </FilterChip>
          {usuarios.filter((u) => u.papel === "operacional" || u.papel === "admin").map((u) => (
            <FilterChip
              key={u.id}
              active={responsavelOp === u.id}
              onClick={() => setResponsavelOp(responsavelOp === u.id ? null : u.id)}
            >
              {u.nome.split(" ")[0]}
            </FilterChip>
          ))}
        </FilterGroup>

        {ativaCount > 0 && (
          <button
            onClick={limparFiltros}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      {expedicoes.length === 0 ? (
        <EmptyState onCreate={() => setDrawerOpen(true)} />
      ) : (
        <ExpedicoesTable
          expedicoes={filtradas}
          selecionada={selecionada}
          onRowClick={(e) => router.push(`/expedicoes/${e.id}`)}
        />
      )}

      <NovaExpedicaoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        usuarios={usuarios}
      />
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
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
        "px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg bg-muted/20">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nenhuma expedição ainda</p>
      <p className="text-xs text-muted-foreground mt-0.5">Crie a primeira pra começar.</p>
      <Button onClick={onCreate} className="mt-4">
        Criar primeira expedição
      </Button>
    </div>
  );
}
