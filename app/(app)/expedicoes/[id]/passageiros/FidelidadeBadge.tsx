import { Badge } from "@/components/ui/Badge";
import { ehMarco, ordinalFem } from "@/lib/fidelidade";
import { cn } from "@/lib/utils";

/**
 * Selo de fidelidade: mostra em que viagem (cronológica) desta pessoa esta
 * expedição entra. 1ª viagem não exibe nada (sem ruído); a partir da 2ª mostra
 * um "Nª" discreto; nos marcos (3ª/5ª/10ª) vira um selo comemorativo.
 */
export function FidelidadeBadge({
  posicao,
  className,
}: {
  posicao: number | null | undefined;
  className?: string;
}) {
  if (!posicao || posicao < 2) return null;

  const titulo = `${ordinalFem(posicao)} expedição desta pessoa com a agência`;

  if (ehMarco(posicao)) {
    return (
      <Badge variant="lista" className={cn("shrink-0", className)} title={titulo}>
        ★ {ordinalFem(posicao)} expedição
      </Badge>
    );
  }

  return (
    <span
      className={cn("shrink-0 text-[10px] text-muted-foreground tabular-nums", className)}
      title={titulo}
    >
      {ordinalFem(posicao)}
    </span>
  );
}
