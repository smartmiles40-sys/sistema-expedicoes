"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  count?: number;
  active?: boolean;
  preview?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

export function FilterPopover({
  label,
  count = 0,
  active = false,
  preview,
  children,
  className,
  align = "start",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] transition-all",
          active
            ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
            : "border-border text-foreground hover:border-foreground/40 hover:bg-muted/50",
          open && !active && "border-foreground/40 bg-muted/50",
        )}
      >
        <span className="font-medium">{label}</span>
        {count > 0 && (
          <span
            className={cn(
              "inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-semibold tabular-nums px-1",
              active ? "bg-background/20 text-background" : "bg-foreground text-background",
            )}
          >
            {count}
          </span>
        )}
        {preview && count === 0 && (
          <span className="text-muted-foreground truncate max-w-[120px]">{preview}</span>
        )}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-1.5 z-30 min-w-[220px] max-w-[320px]",
            "rounded-lg border border-border bg-card text-card-foreground",
            "shadow-2xl ring-1 ring-black/10 dark:ring-white/10",
            "p-1.5 animate-in fade-in zoom-in-95 duration-100",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
