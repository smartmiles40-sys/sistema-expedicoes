"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutGrid, List as ListIcon, Plus, ChevronRight, Sparkles, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { StatPill } from "@/components/ui/StatPill";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { EditableCell } from "@/components/tables/EditableCell";
import { EditableSelectCell, type SelectOption } from "@/components/tables/EditableSelectCell";
import {
  atualizarChecklistCampo,
  excluirChecklistItem,
  gerarChecklistPadrao,
} from "@/app/(app)/expedicoes/actions";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { ETAPA_CHECKLIST, FASES_CHECKLIST, STATUS_CHECKLIST, faseAtualChecklist } from "@/lib/constants";
import { NovoChecklistDrawer } from "./NovoChecklistDrawer";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import type {
  ChecklistItemRow,
  UsuarioRow,
  StatusChecklist,
  Prioridade,
  EtapaChecklist,
} from "@/types/database";

const STATUS_VARIANT: Record<StatusChecklist, "auto" | "lista" | "atencao" | "vinculado" | "critico"> = {
  Pendente: "auto",
  "Em andamento": "lista",
  Atenção: "atencao",
  Concluído: "vinculado",
  Bloqueado: "critico",
};

const STATUS_DOT: Record<StatusChecklist, string> = {
  Pendente: "bg-muted-foreground/40",
  "Em andamento": "bg-lista-500",
  Atenção: "bg-atencao-500",
  Concluído: "bg-vinculado-500",
  Bloqueado: "bg-critico-500",
};

const STATUS_OPTIONS: SelectOption[] = STATUS_CHECKLIST.map((s) => ({
  value: s,
  label: s,
  dotClassName: STATUS_DOT[s],
}));

const PRIORIDADE_VARIANT: Record<Prioridade, "auto" | "lista" | "atencao" | "critico"> = {
  Baixa: "auto",
  Média: "lista",
  Alta: "atencao",
  Crítica: "critico",
};

const KANBAN_COLUNAS: { titulo: string; statuses: StatusChecklist[] }[] = [
  { titulo: "Pendente", statuses: ["Pendente"] },
  { titulo: "Em andamento", statuses: ["Em andamento"] },
  { titulo: "Atenção", statuses: ["Atenção", "Bloqueado"] },
  { titulo: "Concluído", statuses: ["Concluído"] },
];

interface Props {
  expedicaoId: string;
  itens: ChecklistItemRow[];
  usuarios: UsuarioRow[];
  dataEmbarque: string | null;
}

export function ChecklistTabela({ expedicaoId, itens, usuarios, dataEmbarque }: Props) {
  const [view, setView] = React.useState<"tabela" | "kanban" | "grafico">("tabela");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const usuariosById = new Map(usuarios.map((u) => [u.id, u]));

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "checklist_itens", filter: `expedicao_id=eq.${expedicaoId}` },
    ],
  });

  const diasAteEmbarque = daysUntil(dataEmbarque);
  const faseAtual = faseAtualChecklist(diasAteEmbarque);

  const topLevel = itens.filter((i) => !i.parent_id);
  const concluidosTop = topLevel.filter((i) => i.status === "Concluído").length;

  if (itens.length === 0) {
    return (
      <ChecklistVazio
        expedicaoId={expedicaoId}
        temEmbarque={!!dataEmbarque}
        onNova={() => setDrawerOpen(true)}
        drawerSlot={
          <NovoChecklistDrawer
            expedicaoId={expedicaoId}
            usuarios={usuarios}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
          />
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Checklist de processos</h2>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {concluidosTop}/{topLevel.length} processos concluídos
            {faseAtual && (
              <> · fase atual: <span className="font-medium text-foreground">{faseAtual}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-border rounded-md overflow-hidden">
            <button
              className={cn(
                "px-2 py-1 text-xs inline-flex items-center gap-1 transition-colors",
                view === "tabela" ? "bg-foreground text-background" : "hover:bg-accent",
              )}
              onClick={() => setView("tabela")}
            >
              <ListIcon className="h-3 w-3" /> Timeline
            </button>
            <button
              className={cn(
                "px-2 py-1 text-xs inline-flex items-center gap-1 transition-colors",
                view === "grafico" ? "bg-foreground text-background" : "hover:bg-accent",
              )}
              onClick={() => setView("grafico")}
            >
              <BarChart3 className="h-3 w-3" /> Gráfico
            </button>
            <button
              className={cn(
                "px-2 py-1 text-xs inline-flex items-center gap-1 transition-colors",
                view === "kanban" ? "bg-foreground text-background" : "hover:bg-accent",
              )}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-3 w-3" /> Kanban
            </button>
          </div>
          <Button variant="brand" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-3 w-3" /> Nova tarefa
          </Button>
        </div>
      </div>

      <ChecklistTriagem itens={itens} usuariosById={usuariosById} />

      <FaseTimeline itens={topLevel} faseAtual={faseAtual} />

      {view === "tabela" ? (
        <ChecklistTable
          expedicaoId={expedicaoId}
          itens={itens}
          usuariosById={usuariosById}
          faseAtual={faseAtual}
        />
      ) : view === "grafico" ? (
        <ChecklistGrafico itens={topLevel} usuariosById={usuariosById} faseAtual={faseAtual} />
      ) : (
        <ChecklistKanban itens={topLevel} usuariosById={usuariosById} />
      )}

      <NovoChecklistDrawer
        expedicaoId={expedicaoId}
        usuarios={usuarios}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

/* ───────────────────────── Empty state ───────────────────────── */

function ChecklistVazio({
  expedicaoId,
  temEmbarque,
  onNova,
  drawerSlot,
}: {
  expedicaoId: string;
  temEmbarque: boolean;
  onNova: () => void;
  drawerSlot: React.ReactNode;
}) {
  const router = useRouter();
  const [gerando, setGerando] = React.useState(false);

  async function gerar() {
    setGerando(true);
    const r = await gerarChecklistPadrao(expedicaoId);
    setGerando(false);
    if (r.ok) {
      toast.success(`Checklist criado · ${r.total} itens`);
      router.refresh();
    } else {
      toast.error("Não foi possível gerar", { description: r.error });
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-editavel-50 text-editavel-600 dark:bg-editavel-600/15">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold">Nenhum processo cadastrado</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Gere o checklist padrão com os <strong>23 processos operacionais</strong> da expedição, organizados nas 5 fases
        de antecedência. Os prazos são calculados automaticamente a partir da data de embarque.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button size="sm" onClick={gerar} disabled={gerando}>
          <Sparkles className="h-3 w-3" /> {gerando ? "Gerando..." : "Gerar checklist padrão"}
        </Button>
        <Button size="sm" variant="outline" onClick={onNova}>
          <Plus className="h-3 w-3" /> Tarefa avulsa
        </Button>
      </div>
      {!temEmbarque && (
        <p className="mt-3 text-[11px] text-atencao-600">
          Defina a data de embarque da expedição para prazos precisos.
        </p>
      )}
      {drawerSlot}
    </div>
  );
}

/* ───────────────────────── Triagem de alertas ───────────────────────── */

function ChecklistTriagem({
  itens,
  usuariosById,
}: {
  itens: ChecklistItemRow[];
  usuariosById: Map<string, UsuarioRow>;
}) {
  const ativos = itens.filter((i) => i.status !== "Concluído");
  const comDias = ativos.map((i) => ({ it: i, dias: daysUntil(i.prazo) }));
  const atrasados = comDias.filter((a) => a.dias != null && a.dias < 0).sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  const venceBreve = comDias.filter((a) => a.dias != null && a.dias >= 0 && a.dias <= 3).sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  const bloqueados = ativos.filter((i) => i.status === "Bloqueado");
  const totalAlertas = atrasados.length + venceBreve.length + bloqueados.length;

  if (totalAlertas === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-vinculado-600/30 bg-vinculado-50 px-4 py-2.5 text-[13px] font-medium text-vinculado-700 dark:bg-vinculado-600/10 dark:text-vinculado-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Tudo em dia — nenhum processo atrasado ou vencendo nos próximos dias. 🎉
      </div>
    );
  }

  // Lista priorizada: atrasados (mais atrasado primeiro) → vencendo (mais perto primeiro).
  const urgentes = [...atrasados, ...venceBreve];
  const lista = urgentes.slice(0, 6);

  return (
    <div className="overflow-hidden rounded-2xl border border-critico-600/30 bg-gradient-to-br from-critico-50 to-atencao-50 shadow-sm dark:from-critico-600/10 dark:to-atencao-600/10">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-critico-100 text-critico-600">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <h3 className="text-[14px] font-semibold">Precisa de atenção</h3>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {atrasados.length > 0 && <StatPill value={atrasados.length} label="atrasados" variant="critico" />}
          {venceBreve.length > 0 && <StatPill value={venceBreve.length} label="vencendo" variant="atencao" />}
          {bloqueados.length > 0 && <StatPill value={bloqueados.length} label="bloqueados" variant="critico" />}
        </div>
      </div>
      <div className="mt-2.5 divide-y divide-border/50">
        {lista.map(({ it, dias }) => {
          const atrasado = dias != null && dias < 0;
          const resp = it.responsavel_id ? usuariosById.get(it.responsavel_id) : null;
          return (
            <div key={it.id} className="flex items-center gap-2.5 px-4 py-2 text-[12px]">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", atrasado ? "bg-critico-600" : "bg-atencao-500")} />
              <span className="min-w-0 flex-1 truncate font-medium">{it.tarefa}</span>
              <Badge variant="lista" className="hidden sm:inline-flex">{it.etapa}</Badge>
              {resp && <Avatar nome={resp.nome} size={20} className="hidden shrink-0 sm:flex" />}
              <span className={cn("shrink-0 font-semibold tabular-nums", atrasado ? "text-critico-600" : "text-atencao-600")}>
                {atrasado ? `${-(dias ?? 0)}d de atraso` : dias === 0 ? "vence hoje" : `vence em ${dias}d`}
              </span>
            </div>
          );
        })}
      </div>
      {urgentes.length > lista.length && (
        <div className="px-4 py-1.5 text-[11px] text-muted-foreground">
          + {urgentes.length - lista.length} outro(s) na lista abaixo
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Timeline de fases ───────────────────────── */

function FaseTimeline({
  itens,
  faseAtual,
}: {
  itens: ChecklistItemRow[];
  faseAtual: EtapaChecklist | null;
}) {
  const faseAtualIdx = faseAtual ? ETAPA_CHECKLIST.indexOf(faseAtual) : -1;
  const fasesComItens = FASES_CHECKLIST.filter((f) =>
    itens.some((i) => i.etapa === f.etapa),
  );
  if (fasesComItens.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {fasesComItens.map((f) => {
        const items = itens.filter((i) => i.etapa === f.etapa);
        const done = items.filter((i) => i.status === "Concluído").length;
        const idx = ETAPA_CHECKLIST.indexOf(f.etapa);
        const isAtual = f.etapa === faseAtual;
        const isPassada = faseAtualIdx >= 0 && idx < faseAtualIdx;
        const completa = done === items.length;
        return (
          <div
            key={f.etapa}
            title={f.descricao}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]",
              isAtual
                ? "border-editavel-600 bg-editavel-50 text-editavel-700 dark:bg-editavel-600/15 dark:text-editavel-300"
                : completa
                  ? "border-vinculado-500/40 bg-vinculado-50 text-vinculado-700 dark:bg-vinculado-600/10 dark:text-vinculado-300"
                  : isPassada
                    ? "border-border bg-muted/40 text-muted-foreground"
                    : "border-border text-muted-foreground",
            )}
          >
            {completa ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            ) : (
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isAtual ? "bg-editavel-600" : "bg-muted-foreground/40")} />
            )}
            <span className="font-medium">{f.etapa}</span>
            <span className="tabular-nums opacity-70">{done}/{items.length}</span>
            {isAtual && <span className="rounded bg-editavel-600 px-1 text-[9px] font-bold uppercase text-white">agora</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Tabela por fase ───────────────────────── */

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-vinculado-500" : "bg-editavel-600")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function ChecklistTable({
  expedicaoId,
  itens,
  usuariosById,
  faseAtual,
}: {
  expedicaoId: string;
  itens: ChecklistItemRow[];
  usuariosById: Map<string, UsuarioRow>;
  faseAtual: EtapaChecklist | null;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const childrenByParent = React.useMemo(() => {
    const m = new Map<string, ChecklistItemRow[]>();
    for (const it of itens) {
      if (it.parent_id) {
        const arr = m.get(it.parent_id) ?? [];
        arr.push(it);
        m.set(it.parent_id, arr);
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => a.ordem - b.ordem);
    return m;
  }, [itens]);

  const grupos = ETAPA_CHECKLIST.map((etapa) => ({
    etapa,
    descricao: FASES_CHECKLIST.find((f) => f.etapa === etapa)?.descricao ?? "",
    items: itens
      .filter((i) => !i.parent_id && i.etapa === etapa)
      .sort((a, b) => a.ordem - b.ordem),
  })).filter((g) => g.items.length > 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function salvarCampo(id: string, campo: string, valor: unknown) {
    const r = await atualizarChecklistCampo(id, campo, valor);
    if (!r.ok) toast.error("Erro ao salvar", { description: r.error });
    router.refresh();
    return r;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full table-dense">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <Th className="w-8"></Th>
              <Th>Processo</Th>
              <Th>Responsável</Th>
              <Th>Prazo</Th>
              <Th className="text-right">Dias</Th>
              <Th>Prioridade</Th>
              <Th>Status</Th>
              <Th>Observações</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ etapa, descricao, items }) => {
              const done = items.filter((i) => i.status === "Concluído").length;
              const isAtual = etapa === faseAtual;
              return (
                <React.Fragment key={etapa}>
                  <tr className={cn("border-y border-border", isAtual ? "bg-editavel-50/60 dark:bg-editavel-600/10" : "bg-muted/30")}>
                    <td colSpan={9} className="px-2.5 py-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-[12px]">{etapa}</span>
                          {isAtual && <Badge variant="editavel">fase atual</Badge>}
                          <span className="truncate text-[11px] text-muted-foreground font-normal">{descricao}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground tabular-nums">{done}/{items.length}</span>
                          <ProgressBar value={done} total={items.length} />
                        </div>
                      </div>
                    </td>
                  </tr>
                  {items.map((it) => {
                    const filhos = childrenByParent.get(it.id) ?? [];
                    const isOpen = expanded.has(it.id);
                    return (
                      <React.Fragment key={it.id}>
                        <ItemRow
                          it={it}
                          filhos={filhos}
                          isOpen={isOpen}
                          onToggle={() => toggle(it.id)}
                          usuariosById={usuariosById}
                          expedicaoId={expedicaoId}
                          salvarCampo={salvarCampo}
                        />
                        {isOpen &&
                          filhos.map((sub) => (
                            <ItemRow
                              key={sub.id}
                              it={sub}
                              filhos={[]}
                              isOpen={false}
                              onToggle={() => {}}
                              usuariosById={usuariosById}
                              expedicaoId={expedicaoId}
                              salvarCampo={salvarCampo}
                              isSub
                            />
                          ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemRow({
  it,
  filhos,
  isOpen,
  onToggle,
  usuariosById,
  expedicaoId,
  salvarCampo,
  isSub = false,
}: {
  it: ChecklistItemRow;
  filhos: ChecklistItemRow[];
  isOpen: boolean;
  onToggle: () => void;
  usuariosById: Map<string, UsuarioRow>;
  expedicaoId: string;
  salvarCampo: (id: string, campo: string, valor: unknown) => Promise<{ ok: boolean; error?: string }>;
  isSub?: boolean;
}) {
  const dias = daysUntil(it.prazo);
  const isVencido = dias != null && dias < 0 && it.status !== "Concluído";
  const concluido = it.status === "Concluído";
  const subDone = filhos.filter((f) => f.status === "Concluído").length;

  return (
    <tr className={cn("border-b border-border", isVencido && "bg-critico-50 dark:bg-critico-50/30", isSub && "bg-muted/10")}>
      <td className="px-2 align-middle">
        <div className={cn("flex items-center", isSub && "pl-4")}>
          {!isSub && filhos.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              className="mr-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label={isOpen ? "Recolher subtarefas" : "Expandir subtarefas"}
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : (
            <span className="w-[18px]" />
          )}
          <input
            type="checkbox"
            checked={concluido}
            onChange={(e) =>
              salvarCampo(it.id, "status", e.target.checked ? "Concluído" : "Pendente")
            }
            className="h-3.5 w-3.5 accent-vinculado-600 cursor-pointer"
            aria-label="Concluir"
          />
        </div>
      </td>
      <td className="px-2.5">
        <span className={cn(isSub && "text-[12px] text-muted-foreground", concluido && "line-through text-muted-foreground")}>
          {it.tarefa}
        </span>
        {!isSub && filhos.length > 0 && (
          <span className="ml-2 rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">
            {subDone}/{filhos.length}
          </span>
        )}
      </td>
      <td className="px-2.5 text-muted-foreground">
        {it.responsavel_id ? (
          <span className="inline-flex items-center gap-1.5">
            <Avatar nome={usuariosById.get(it.responsavel_id)?.nome ?? "?"} size={20} />
            <span className="text-[12px]">{usuariosById.get(it.responsavel_id)?.nome.split(" ")[0]}</span>
          </span>
        ) : "—"}
      </td>
      <td className="px-2.5 tabular-nums text-[12px]">{formatDate(it.prazo)}</td>
      <td className="px-2.5 text-right tabular-nums text-[12px]">
        {dias == null ? <span className="text-muted-foreground">—</span> : (
          <span className={cn(isVencido && "text-critico-600 font-medium", !isVencido && dias < 7 && "text-atencao-600")}>
            {dias < 0 ? `${-dias}d atraso` : `${dias}d`}
          </span>
        )}
      </td>
      <td className="px-2.5"><Badge variant={PRIORIDADE_VARIANT[it.prioridade]}>{it.prioridade}</Badge></td>
      <td className="px-2.5">
        <EditableSelectCell
          value={it.status}
          options={STATUS_OPTIONS}
          heading="Status"
          onSave={(v) => salvarCampo(it.id, "status", v)}
          renderValue={(opt) => (
            <Badge variant={STATUS_VARIANT[(opt?.value as StatusChecklist) ?? it.status]}>
              {opt?.label ?? it.status}
            </Badge>
          )}
        />
      </td>
      <td>
        <EditableCell
          value={it.observacoes}
          onSave={(v) => atualizarChecklistCampo(it.id, "observacoes", v)}
        />
      </td>
      <td className="w-9 px-1">
        <ConfirmDeleteButton
          ariaLabel="Excluir tarefa"
          title={`Excluir "${it.tarefa}"?`}
          description={filhos.length > 0 ? `Isto remove também ${filhos.length} subtarefa(s).` : "Esta ação não pode ser desfeita."}
          successMessage="Tarefa excluída"
          onConfirm={() => excluirChecklistItem(it.id, expedicaoId)}
        />
      </td>
    </tr>
  );
}

/* ───────────────────────── Gráfico (timeline: tarefas × fases) ───────────────────────── */

function ChecklistGrafico({
  itens,
  usuariosById,
  faseAtual,
}: {
  itens: ChecklistItemRow[];
  usuariosById: Map<string, UsuarioRow>;
  faseAtual: EtapaChecklist | null;
}) {
  const router = useRouter();

  async function salvarStatus(id: string, status: string) {
    const r = await atualizarChecklistCampo(id, "status", status);
    if (r.ok) router.refresh();
    return r;
  }

  const tarefasDaFase = (fase: EtapaChecklist) =>
    itens
      .filter((i) => i.etapa === fase)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || (a.prazo ?? "").localeCompare(b.prazo ?? ""));

  return (
    <div className="space-y-2">
      {/* Instrução + legenda de cores (anti-burro) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          Cada <strong className="text-foreground">coluna é um prazo</strong> (fase antes do embarque, da esquerda p/ a direita).
          As <strong className="text-foreground">tarefas daquele prazo</strong> ficam abaixo. Clique no status pra mudar.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {STATUS_CHECKLIST.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[s])} /> {s}
            </span>
          ))}
        </div>
      </div>

      {/* Quadro: uma coluna por prazo (fase); tarefas empilhadas embaixo */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3">
          {ETAPA_CHECKLIST.map((fase) => {
            const tarefas = tarefasDaFase(fase);
            const feitas = tarefas.filter((t) => t.status === "Concluído").length;
            const atual = fase === faseAtual;
            return (
              <div
                key={fase}
                className={cn(
                  "w-60 shrink-0 rounded-xl border bg-background",
                  atual ? "border-editavel-500 ring-2 ring-editavel-500/30" : "border-border",
                )}
              >
                <div className={cn("rounded-t-xl px-3 py-2", atual ? "bg-editavel-50" : "bg-muted/40")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold leading-tight">{fase}</span>
                    {atual && (
                      <span className="rounded-full bg-editavel-600 px-1.5 py-0.5 text-[9px] font-bold text-white">AGORA</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {feitas}/{tarefas.length} concluída{tarefas.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="min-h-[44px] space-y-1.5 p-2">
                  {tarefas.length === 0 ? (
                    <p className="py-2 text-center text-[10px] text-muted-foreground">Nada aqui</p>
                  ) : (
                    tarefas.map((it) => {
                      const dias = daysUntil(it.prazo);
                      const atrasada = it.status !== "Concluído" && dias != null && dias < 0;
                      const resp = it.responsavel_id ? usuariosById.get(it.responsavel_id) : null;
                      return (
                        <div
                          key={it.id}
                          className={cn(
                            "rounded-lg border bg-card p-2",
                            atrasada ? "border-critico-500/50 bg-critico-50/40" : "border-border",
                          )}
                        >
                          <div className="line-clamp-2 text-[12px] font-medium leading-tight">{it.tarefa}</div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              {it.prazo && (
                                <span className={cn(atrasada && "font-medium text-critico-600")}>{formatDate(it.prazo)}</span>
                              )}
                              {resp && <Avatar nome={resp.nome} size={14} />}
                            </span>
                            <EditableSelectCell
                              value={it.status}
                              options={STATUS_OPTIONS}
                              heading="Status"
                              onSave={(v) => salvarStatus(it.id, v)}
                              renderValue={(opt) => (
                                <span className="inline-flex items-center gap-1">
                                  <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[(opt?.value as StatusChecklist) ?? it.status])} />
                                  <span className="text-[10px] font-medium">{opt?.label ?? it.status}</span>
                                </span>
                              )}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Kanban ───────────────────────── */

function ChecklistKanban({
  itens,
  usuariosById,
}: {
  itens: ChecklistItemRow[];
  usuariosById: Map<string, UsuarioRow>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {KANBAN_COLUNAS.map((col) => {
        const itemsCol = itens.filter((i) => col.statuses.includes(i.status));
        return (
          <div key={col.titulo} className="rounded-md border border-border bg-muted/30 p-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{col.titulo}</h3>
              <Badge variant="auto">{itemsCol.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {itemsCol.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">Vazio</p>
              ) : (
                itemsCol.map((it) => {
                  const dias = daysUntil(it.prazo);
                  const isVencido = dias != null && dias < 0 && it.status !== "Concluído";
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "rounded-md border border-border bg-background p-2",
                        isVencido && "border-critico-600",
                      )}
                    >
                      <div className="text-[12px] font-medium leading-tight mb-1">{it.tarefa}</div>
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="lista">{it.etapa}</Badge>
                        <span className="text-[10px] text-muted-foreground">{formatDate(it.prazo)}</span>
                      </div>
                      {it.responsavel_id && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <Avatar nome={usuariosById.get(it.responsavel_id)?.nome ?? "?"} size={16} />
                          <span className="text-[10px] text-muted-foreground">
                            {usuariosById.get(it.responsavel_id)?.nome.split(" ")[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5", className)}>
      {children}
    </th>
  );
}
