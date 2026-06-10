"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface Props {
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  title?: string;
  description?: React.ReactNode;
  successMessage?: string;
  /** Texto do botão de trigger. Se omitido, mostra só o ícone de lixeira. */
  triggerLabel?: string;
  /** Classe extra no botão de trigger. */
  triggerClassName?: string;
  /** Label de acessibilidade pro botão. */
  ariaLabel?: string;
  /** Callback após exclusão bem-sucedida. Recebe um router.refresh por padrão. */
  onDeleted?: () => void;
  /** Desabilita o botão de trigger. */
  disabled?: boolean;
}

export function ConfirmDeleteButton({
  onConfirm,
  title = "Excluir item?",
  description = "Esta ação não pode ser desfeita.",
  successMessage = "Item excluído",
  triggerLabel,
  triggerClassName,
  ariaLabel = "Excluir",
  onDeleted,
  disabled,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handle() {
    setLoading(true);
    try {
      const r = await onConfirm();
      if (r.ok) {
        toast.success(successMessage);
        setOpen(false);
        if (onDeleted) onDeleted();
        else router.refresh();
      } else {
        toast.error("Não foi possível excluir", { description: r.error });
      }
    } catch (e) {
      toast.error("Erro inesperado", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={cn(
          triggerLabel
            ? "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-muted-foreground hover:text-critico-600 hover:bg-critico-50 transition-colors"
            : "flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-critico-600 hover:bg-critico-50 transition-colors",
          disabled && "opacity-40 pointer-events-none",
          triggerClassName,
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handle}
              disabled={loading}
            >
              {loading ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
