import { cn } from "@/lib/utils";

const TINT: Record<string, string> = {
  vinculado: "bg-vinculado-100 text-vinculado-600",
  atencao: "bg-atencao-100 text-atencao-600",
  critico: "bg-critico-100 text-critico-600",
  lista: "bg-lista-100 text-lista-600",
  editavel: "bg-editavel-100 text-editavel-600",
  default: "bg-muted text-foreground",
};

/** Chip de estatística: número colorido + rótulo. Pulso visual rápido. */
export function StatPill({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number | string;
  variant?: keyof typeof TINT;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] shadow-sm">
      <span className={cn("inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums", TINT[variant])}>
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
