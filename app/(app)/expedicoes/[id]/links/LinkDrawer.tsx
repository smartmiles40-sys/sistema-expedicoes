"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { criarLink, atualizarLink } from "@/app/(app)/expedicoes/actions";
import type { LinkExpedicaoRow } from "@/types/database";

const schema = z.object({
  label: z.string().min(1, "Nome obrigatório").max(80),
  url: z.string().url("URL inválida (use https://...)"),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  /** Quando passado, o drawer abre em modo edição. */
  link: LinkExpedicaoRow | null;
  /** Quando true, drawer abre em modo criar. */
  novoOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGESTOES = [
  "Apresentação",
  "Landing page",
  "Planilha financeira",
  "Roteiro / Day-by-day",
  "Pasta no Drive",
  "Grupo do WhatsApp",
  "Vídeo de divulgação",
];

export function LinkDrawer({ expedicaoId, link, novoOpen, onOpenChange }: Props) {
  const router = useRouter();
  const editando = link !== null;
  const open = editando || novoOpen;

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!open) return;
    if (link) {
      reset({ label: link.label, url: link.url });
    } else {
      reset({ label: "", url: "" });
    }
  }, [open, link, reset]);

  async function onSubmit(data: FormData) {
    const r = editando
      ? await atualizarLink(link.id, expedicaoId, data)
      : await criarLink({ expedicao_id: expedicaoId, ...data });
    if (r.ok) {
      toast.success(editando ? "Link atualizado" : "Link adicionado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>{editando ? "Editar link" : "Novo link"}</DrawerTitle>
            <DrawerDescription>
              Cole qualquer URL — apresentação, landing page, planilha, drive, grupo etc.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="lk-label">Nome</Label>
              <Input
                id="lk-label"
                {...register("label")}
                placeholder="Ex: Apresentação"
                autoFocus
              />
              {errors.label && <p className="text-[11px] text-critico-600">{errors.label.message}</p>}
              {!editando && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setValue("label", s, { shouldDirty: true })}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="lk-url">URL</Label>
              <Input
                id="lk-url"
                type="url"
                {...register("url")}
                placeholder="https://..."
              />
              {errors.url && <p className="text-[11px] text-critico-600">{errors.url.message}</p>}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || (editando && !isDirty)}>
              {isSubmitting ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
