"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { RealtimeStatus } from "@/lib/hooks/useRealtimeRefresh";

interface Props {
  status: RealtimeStatus;
  className?: string;
  /** Compacto (só o dot, sem texto). Default: false. */
  compact?: boolean;
}

const COR: Record<RealtimeStatus, string> = {
  live: "bg-vinculado-500",
  connecting: "bg-atencao-500",
  error: "bg-critico-500",
  offline: "bg-auto-400",
  idle: "bg-auto-400",
};

const LABEL: Record<RealtimeStatus, string> = {
  live: "Ao vivo",
  connecting: "Conectando...",
  error: "Sem conexão",
  offline: "Offline (mock)",
  idle: "—",
};

const TOOLTIP: Record<RealtimeStatus, string> = {
  live: "Atualização em tempo real ativa. Mudanças de outros usuários aparecem automaticamente.",
  connecting: "Conectando ao servidor de tempo real...",
  error: "Sem atualização automática. Recarregue a página pra ver mudanças recentes.",
  offline: "Modo desenvolvimento com dados mock. Realtime desabilitado.",
  idle: "Aguardando inicialização.",
};

export function LiveBadge({ status, className, compact = false }: Props) {
  const cor = COR[status];
  const label = LABEL[status];
  const tooltip = TOOLTIP[status];

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] text-muted-foreground select-none",
        className,
      )}
    >
      <span className="relative inline-flex h-2 w-2">
        {status === "live" && (
          <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", cor)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", cor)} />
      </span>
      {!compact && <span>{label}</span>}
    </span>
  );
}
