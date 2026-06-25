import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

/**
 * Estado vazio acolhedor: ícone num chip lime, título em serifa, uma frase que
 * explica o que é, e um botão de ação claro. Serve pra guiar quem chega ("não
 * sei por onde começar").
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondary,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Conteúdo extra abaixo do botão (ex.: link secundário). */
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-lime)]/20 text-[var(--brand-dark)] ring-1 ring-[var(--brand-lime)]/50">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display mt-4 text-[19px] font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button variant="brand" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {secondary && <div className="mt-3 text-[12px] text-muted-foreground">{secondary}</div>}
    </div>
  );
}
