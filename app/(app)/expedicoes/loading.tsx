import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Estado de carregamento da lista de expedições.
 * Espelha o layout de ExpedicoesPageCliente: cabeçalho (título + busca + botão),
 * linha de filtros e uma seção de ano com linhas da tabela.
 */
export default function Loading() {
  return (
    <div className="p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-24" />
      </div>

      {/* Seção de ano + linhas da tabela */}
      <div className="space-y-2 pt-2">
        <div className="flex items-end justify-between border-b-2 border-foreground/80 pb-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
