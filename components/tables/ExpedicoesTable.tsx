"use client";
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";
import { Badge } from "@/components/ui/Badge";
import { formatBRL, formatDate, formatPercent, daysUntil } from "@/lib/utils";
import { MARGEM_MINIMA, MARGEM_IDEAL } from "@/lib/constants";
import type { ExpedicaoComAgregados, StatusExpedicao } from "@/types/database";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<StatusExpedicao, "lista" | "vinculado" | "atencao" | "auto" | "critico"> = {
  Planejamento: "lista",
  "Vendas Abertas": "vinculado",
  "Em andamento": "atencao",
  Concluída: "auto",
  Cancelada: "critico",
};

interface Props {
  expedicoes: ExpedicaoComAgregados[];
  selecionada?: number;
  onRowClick?: (e: ExpedicaoComAgregados) => void;
}

export function ExpedicoesTable({ expedicoes, selecionada = -1, onRowClick }: Props) {
  const columns = React.useMemo<ColumnDef<ExpedicaoComAgregados>[]>(
    () => [
      {
        accessorKey: "codigo",
        header: "Código",
        cell: ({ row }) => (
          <span className="font-mono text-[12px] tabular-nums">{row.original.codigo}</span>
        ),
      },
      {
        accessorKey: "nome",
        header: "Nome",
        cell: ({ row }) => <span className="font-medium">{row.original.nome}</span>,
      },
      { accessorKey: "destino", header: "Destino" },
      {
        accessorKey: "data_embarque",
        header: "Embarque",
        cell: ({ row }) => {
          const dias = daysUntil(row.original.data_embarque);
          return (
            <div className="flex flex-col leading-tight">
              <span className="tabular-nums">{formatDate(row.original.data_embarque)}</span>
              {dias != null && dias >= 0 && (
                <span className={cn("text-[10px]", dias < 30 ? "text-atencao-600" : "text-muted-foreground")}>
                  em {dias}d
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>
        ),
      },
      {
        id: "pax",
        header: "Pax",
        cell: ({ row }) => (
          <span className="tabular-nums">
            <strong>{row.original.pax_confirmados}</strong>/{row.original.pax_planejados}
          </span>
        ),
      },
      {
        id: "receita",
        header: "Receita prev.",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatBRL(row.original.receita_prevista_brl, 0)}</span>
        ),
      },
      {
        id: "margem",
        header: "Margem %",
        cell: ({ row }) => {
          const m = row.original.margem_prevista;
          const variant = m < MARGEM_MINIMA ? "critico" : m < MARGEM_IDEAL ? "atencao" : "vinculado";
          return <Badge variant={variant}>{formatPercent(m)}</Badge>;
        },
      },
      {
        id: "pagto_venc",
        header: "Pagto venc.",
        cell: ({ row }) => {
          const n = row.original.pagamentos_vencidos;
          if (n === 0) return <span className="text-muted-foreground">—</span>;
          return <Badge variant="critico">{n}</Badge>;
        },
      },
      {
        id: "docs_pend",
        header: "Docs pend.",
        cell: ({ row }) => {
          const n = row.original.docs_pendentes;
          if (n === 0) return <span className="text-muted-foreground">—</span>;
          return <Badge variant="atencao">{n}</Badge>;
        },
      },
      {
        id: "responsavel_op",
        header: "Resp. Op",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.responsavel_op_nome ?? "—"}</span>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={expedicoes} onRowClick={onRowClick} emptyMessage="Nenhuma expedição encontrada com os filtros atuais." />;
}
