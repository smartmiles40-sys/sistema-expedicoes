import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Estado de carregamento do dashboard.
 * Espelha o layout de DashboardCliente: título, 4 KPI cards, card do gráfico
 * (260px) e card de processos.
 */
export default function Loading() {
  return (
    <div className="p-4 space-y-4">
      {/* Título */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-52" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Gráfico Receita × Custo */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-[260px] w-full" />
      </div>

      {/* Processos das expedições */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-24" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
