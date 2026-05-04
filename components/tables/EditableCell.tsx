"use client";
import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string | number | null;
  onSave: (newValue: string | number | null) => Promise<{ ok: boolean; error?: string }>;
  type?: "text" | "number" | "date";
  placeholder?: string;
  className?: string;
}

export function EditableCell({
  value,
  onSave,
  type = "text",
  placeholder = "—",
  className,
}: EditableCellProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(value == null ? "" : String(value));
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (saving) return;
    let parsed: string | number | null = draft;
    if (type === "number") {
      parsed = draft.trim() === "" ? null : Number(draft);
      if (parsed != null && Number.isNaN(parsed)) {
        toast.error("Valor inválido");
        setDraft(value == null ? "" : String(value));
        setEditing(false);
        return;
      }
    } else if (type === "text") {
      parsed = draft.trim() === "" ? null : draft;
    } else if (type === "date") {
      parsed = draft.trim() === "" ? null : draft;
    }
    const original = value == null ? "" : String(value);
    if (String(parsed ?? "") === original) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await onSave(parsed);
    setSaving(false);
    if (!result.ok) {
      toast.error("Erro ao salvar", { description: result.error });
      setDraft(value == null ? "" : String(value));
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            cancel();
          } else if (e.key === "Tab") {
            commit();
          }
        }}
        disabled={saving}
        className={cn(
          "w-full h-7 px-1.5 rounded-sm border border-editavel-600 bg-background text-[13px] outline-none",
          "focus:ring-2 focus:ring-editavel-600 focus:ring-offset-0",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "w-full text-left px-1.5 py-0.5 rounded-sm hover:bg-editavel-50 dark:hover:bg-editavel-50/40 transition-colors min-h-[24px] tabular-nums",
        value == null && "text-muted-foreground italic",
        className,
      )}
    >
      {value == null || value === "" ? placeholder : String(value)}
    </button>
  );
}
