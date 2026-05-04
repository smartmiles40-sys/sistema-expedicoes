"use client";
import * as React from "react";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EditableCell } from "@/components/tables/EditableCell";
import { atualizarChecklistCampo } from "@/app/(app)/expedicoes/actions";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { ETAPA_CHECKLIST } from "@/lib/constants";
import type {
  ChecklistItemRow,
  UsuarioRow,
  StatusChecklist,
  Prioridade,
} from "@/types/database";

const STATUS_VARIANT: Record<StatusChecklist, "auto" | "lista" | "atencao" | "vinculado" | "critico"> = {
  Pendente: "auto",
  "Em andamento": "lista",
  Atenção: "atencao",
  Concluído: "vinculado",
  Bloqueado: "critico",
};

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
  itens: ChecklistItemRow[];
  usuarios: UsuarioRow[];
}

export function ChecklistTabela({ itens, usuarios }: Props) {
  const [view, setView] = React.useState<"tabela" | "kanban">("tabela");
  const usuariosById = new Map(usuarios.map((u) => [u.id, u]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Checklist</h2>
          <p className="text-xs text-muted-foreground">
            {itens.filter((i) => i.status === "Concluído").length}/{itens.length} concluídos
          </p>
        </div>
        <div className="inline-flex border border-border rounded-md overflow-hidden">
          <button
            className={cn(
              "px-2 py-1 text-xs inline-flex items-center gap-1 transition-colors",
              view === "tabela" ? "bg-foreground text-background" : "hover:bg-accent",
            )}
            onClick={() => setView("tabela")}
          >
            <ListIcon className="h-3 w-3" /> Tabela
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
      </div>

      {view === "tabela" ? (
        <ChecklistTable itens={itens} usuariosById={usuariosById} />
      ) : (
        <ChecklistKanban itens={itens} usuariosById={usuariosById} />
      )}
    </div>
  );
}

function ChecklistTable({
  itens,
  usuariosById,
}: {
  itens: ChecklistItemRow[];
  usuariosById: Map<string, UsuarioRow>;
}) {
  const grupos = ETAPA_CHECKLIST.map((e) => ({
    etapa: e,
    items: itens.filter((i) => i.etapa === e),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rounded-md border border-border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full table-dense">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <Th>Tarefa</Th>
              <Th>Responsável</Th>
              <Th>Prazo</Th>
              <Th className="text-right">Dias</Th>
              <Th>Prioridade</Th>
              <Th>Status</Th>
              <Th>Observações</Th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ etapa, items }) => (
              <React.Fragment key={etapa}>
                <tr className="bg-muted/30">
                  <td colSpan={7} className="px-2.5 font-semibold text-[12px]">
                    {etapa} <span className="text-muted-foreground font-normal">({items.length})</span>
                  </td>
                </tr>
                {items.map((it) => {
                  const dias = daysUntil(it.prazo);
                  const isVencido = dias != null && dias < 0 && it.status !== "Concluído";
                  return (
                    <tr key={it.id} className={cn("border-b border-border", isVencido && "bg-critico-50 dark:bg-critico-50/30")}>
                      <td className="px-2.5">{it.tarefa}</td>
                      <td className="px-2.5 text-muted-foreground">
                        {it.responsavel_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar nome={usuariosById.get(it.responsavel_id)?.nome ?? "?"} size={20} />
                            {usuariosById.get(it.responsavel_id)?.nome.split(" ")[0]}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2.5 tabular-nums">{formatDate(it.prazo)}</td>
                      <td className="px-2.5 text-right tabular-nums">
                        {dias == null ? <span className="text-muted-foreground">—</span> :
                          <span className={cn(isVencido && "text-critico-600", !isVencido && dias < 7 && "text-atencao-600")}>
                            {dias < 0 ? `${-dias}d atraso` : `${dias}d`}
                          </span>
                        }
                      </td>
                      <td className="px-2.5"><Badge variant={PRIORIDADE_VARIANT[it.prioridade]}>{it.prioridade}</Badge></td>
                      <td className="px-2.5"><Badge variant={STATUS_VARIANT[it.status]}>{it.status}</Badge></td>
                      <td>
                        <EditableCell
                          value={it.observacoes}
                          onSave={(v) => atualizarChecklistCampo(it.id, "observacoes", v)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
                        <Badge variant={PRIORIDADE_VARIANT[it.prioridade]}>{it.prioridade}</Badge>
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

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5", className)}>
      {children}
    </th>
  );
}
