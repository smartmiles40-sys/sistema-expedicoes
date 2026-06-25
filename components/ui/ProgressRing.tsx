import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Anel de progresso (donut SVG) — leitura visual rápida de % (ocupação,
 * checklist, prontidão). Vibe "app", sem peso de gráfico.
 */
export function ProgressRing({
  value,
  size = 54,
  stroke = 5,
  color = "var(--brand-dark)",
  label,
  className,
}: {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  /** cor do arco (qualquer CSS color, ex.: var(--brand-lime-deep)) */
  color?: string;
  /** conteúdo central (ex.: "82%") */
  label?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const offset = circ * (1 - pct);
  const c = size / 2;

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ stroke: color, transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      {label != null && (
        <span className="absolute text-[12px] font-semibold tabular-nums">{label}</span>
      )}
    </div>
  );
}
