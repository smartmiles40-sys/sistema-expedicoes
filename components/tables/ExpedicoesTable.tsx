"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Star } from "lucide-react";
import { EditableSelectCell, type SelectOption } from "./EditableSelectCell";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatDate, formatPercent, daysUntil } from "@/lib/utils";
import { STATUS_EXPEDICAO } from "@/lib/constants";
import type { ExpedicaoComAgregados, StatusExpedicao } from "@/types/database";
import { cn } from "@/lib/utils";
import { atualizarExpedicaoCampo, excluirExpedicao } from "@/app/(app)/expedicoes/actions";

const STATUS_VARIANT: Record<StatusExpedicao, "lista" | "vinculado" | "atencao" | "auto" | "critico"> = {
  Planejamento: "lista",
  "Vendas Abertas": "vinculado",
  "Em andamento": "atencao",
  Concluída: "auto",
  Cancelada: "critico",
};

const STATUS_DOT: Record<StatusExpedicao, string> = {
  Planejamento: "bg-lista-500",
  "Vendas Abertas": "bg-vinculado-500",
  "Em andamento": "bg-atencao-500",
  Concluída: "bg-auto-500",
  Cancelada: "bg-critico-500",
};

const STATUS_OPTIONS: SelectOption[] = STATUS_EXPEDICAO.map((s) => ({
  value: s,
  label: s,
  dotClassName: STATUS_DOT[s],
}));

const HEADERS = [
  { key: "drag", label: "" },
  { key: "nome", label: "Nome" },
  { key: "destino", label: "Destino" },
  { key: "data_embarque", label: "Embarque" },
  { key: "data_retorno", label: "Retorno" },
  { key: "status", label: "Status" },
  { key: "pax", label: "Pax" },
  { key: "checklist", label: "Checklist" },
  { key: "prontidao", label: "Prontidão" },
  { key: "acoes", label: "" },
];

interface Props {
  expedicoes: ExpedicaoComAgregados[];
  selecionada?: number;
  onRowClick?: (e: ExpedicaoComAgregados) => void;
  onEdit?: (e: ExpedicaoComAgregados) => void;
  /** Chamado depois de cada reorder com a nova ordem de ids. */
  onReorder?: (ids: string[]) => void;
  /** id da expedição mais próxima a embarcar — recebe destaque visual. */
  destaqueId?: string | null;
}

export function ExpedicoesTable({ expedicoes, onRowClick, onEdit, onReorder, destaqueId }: Props) {
  const [items, setItems] = React.useState(expedicoes);

  React.useEffect(() => {
    setItems(expedicoes);
  }, [expedicoes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  // id estável (igual no servidor e no cliente) — evita o mismatch de hidratação
  // do @dnd-kit nos ids de acessibilidade (DndDescribedBy-N).
  const dndId = React.useId();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((e) => e.id === active.id);
    const newIdx = items.findIndex((e) => e.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    onReorder?.(next.map((e) => e.id));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background py-8 text-center text-muted-foreground text-sm">
        Nenhuma expedição encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full table-dense border-collapse">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                {HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground select-none whitespace-nowrap px-2"
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {items.map((e) => (
                  <SortableRow key={e.id} expedicao={e} onRowClick={onRowClick} onEdit={onEdit} destaque={e.id === destaqueId} />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  );
}

function SortableRow({
  expedicao,
  onRowClick,
  onEdit,
  destaque,
}: {
  expedicao: ExpedicaoComAgregados;
  onRowClick?: (e: ExpedicaoComAgregados) => void;
  onEdit?: (e: ExpedicaoComAgregados) => void;
  destaque?: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: expedicao.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const dias = daysUntil(expedicao.data_embarque);
  const prontTodos =
    expedicao.prontidao_total > 0 && expedicao.prontidao_aptos === expedicao.prontidao_total;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border transition-colors",
        onRowClick && "cursor-pointer hover:bg-accent/50",
        destaque && "bg-editavel-600/5 ring-1 ring-inset ring-editavel-600/40",
        isDragging && "bg-accent/70 shadow-lg",
      )}
      onClick={onRowClick ? () => onRowClick(expedicao) : undefined}
    >
      <td className="w-7 pl-1 pr-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>

      <td className="px-2 font-medium">
        <div className="flex items-center gap-1.5">
          <span>{expedicao.nome}</span>
          {destaque && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-editavel-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shrink-0">
              <Star className="h-2.5 w-2.5 fill-current" /> Próxima
            </span>
          )}
        </div>
      </td>

      <td className="px-2 text-muted-foreground">{expedicao.destino}</td>

      <td className="px-2">
        <div className="flex flex-col leading-tight">
          <span className="tabular-nums">{formatDate(expedicao.data_embarque)}</span>
          {dias != null && dias >= 0 && (
            <span
              className={cn(
                "text-[10px]",
                dias < 30 ? "text-atencao-600" : "text-muted-foreground",
              )}
            >
              em {dias}d
            </span>
          )}
        </div>
      </td>

      <td className="px-2 tabular-nums">{formatDate(expedicao.data_retorno)}</td>

      <td className="px-2">
        <EditableSelectCell
          value={expedicao.status}
          options={STATUS_OPTIONS}
          heading="Mudar status"
          renderValue={(opt) => (
            <Badge variant={STATUS_VARIANT[(opt?.value ?? expedicao.status) as StatusExpedicao]}>
              {opt?.label ?? expedicao.status}
            </Badge>
          )}
          onSave={async (v) => {
            const r = await atualizarExpedicaoCampo(expedicao.id, "status", v);
            router.refresh();
            return r;
          }}
        />
      </td>

      <td className="px-2 tabular-nums">
        <strong>{expedicao.pax_confirmados}</strong>
        <span className="text-muted-foreground">/{expedicao.pax_planejados}</span>
      </td>

      <td className="px-2">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-vinculado-600"
              style={{ width: `${Math.round(expedicao.checklist_pct * 100)}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatPercent(expedicao.checklist_pct, 0)}
          </span>
        </div>
      </td>

      <td className="px-2 tabular-nums">
        {expedicao.prontidao_total > 0 ? (
          <>
            <strong className={prontTodos ? "text-vinculado-600" : "text-atencao-600"}>
              {expedicao.prontidao_aptos}
            </strong>
            <span className="text-muted-foreground">/{expedicao.prontidao_total}</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="w-16 px-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(expedicao)}
              aria-label="Editar expedição"
              title="Editar"
              className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <ConfirmDeleteButton
            ariaLabel="Excluir expedição"
            title={`Excluir "${expedicao.nome}"?`}
            description="A expedição e todos os passageiros, custos, pagamentos e checklist serão removidos. Esta ação não pode ser desfeita."
            successMessage="Expedição excluída"
            onConfirm={() => excluirExpedicao(expedicao.id)}
          />
        </div>
      </td>
    </tr>
  );
}
