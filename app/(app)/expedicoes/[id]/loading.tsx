import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Estado de carregamento do conteúdo de uma expedição.
 * O cabeçalho (KPIs) e a navegação de abas vêm do layout e permanecem na tela;
 * este skeleton cobre só a área de conteúdo da aba (tabela densa).
 */
export default function Loading() {
  return (
    <div className="p-4 space-y-3">
      {/* Barra de ações da aba */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Cabeçalho da tabela */}
      <Skeleton className="h-9 w-full" />

      {/* Linhas */}
      <div className="space-y-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
