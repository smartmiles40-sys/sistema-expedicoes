"use client";
import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** classes Tailwind aplicadas ao "dot" (ex: "bg-vinculado-500") */
  dotClassName?: string;
  /** classes Tailwind aplicadas ao item inteiro quando ativo */
  className?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onSave: (newValue: string) => Promise<{ ok: boolean; error?: string }>;
  className?: string;
  renderValue?: (opt: SelectOption | undefined) => React.ReactNode;
  /** Texto opcional acima das opções */
  heading?: string;
}

export function EditableSelectCell({
  value,
  options,
  onSave,
  className,
  renderValue,
  heading,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, options, value]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        pick(options[active]?.value);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, options]);

  async function pick(v: string | undefined) {
    if (!v || v === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const r = await onSave(v);
    setSaving(false);
    setOpen(false);
    if (!r.ok) toast.error("Erro ao salvar", { description: r.error });
  }

  return (
    <div
      ref={ref}
      className={cn("relative inline-block", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={saving}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-all",
          "hover:bg-muted/70 hover:ring-1 hover:ring-border",
          open && "bg-muted ring-1 ring-foreground/30",
          saving && "opacity-50",
        )}
      >
        {renderValue ? renderValue(current) : <span>{current?.label ?? value}</span>}
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full mt-1 z-30 min-w-[220px]",
            "rounded-lg border border-border bg-card text-card-foreground",
            "shadow-2xl ring-1 ring-black/10 dark:ring-white/10",
            "py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left",
          )}
        >
          {heading && (
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {heading}
            </div>
          )}
          <div className="px-1 pb-1">
            {options.map((opt, i) => {
              const isActive = i === active;
              const isCurrent = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(opt.value)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-[12px] rounded-md flex items-center gap-2",
                    "transition-colors",
                    isActive && "bg-muted",
                    opt.className,
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      opt.dotClassName ?? "bg-muted-foreground/40",
                    )}
                  />
                  <span className={cn("flex-1 truncate", isCurrent && "font-semibold")}>
                    {opt.label}
                  </span>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-foreground" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
