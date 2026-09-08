"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { TIPO_QUARTO } from "@/lib/constants";
import { criarQuarto } from "@/app/(app)/expedicoes/actions";

const schema = z.object({
  tipo: z.enum(["Single", "Duplo", "Twin", "Triplo", "Compartilhado", "Líder"]),
  hotel_cidade: z.string().optional(),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  observacoes: z.string().optional(),
  extensao_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  extensoes?: { id: string; nome: string }[];
}

export function NovoQuartoDrawer({ expedicaoId, open, onOpenChange, extensoes }: Props) {
  const router = useRouter();
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { tipo: "Duplo" },
    });

  React.useEffect(() => {
    if (open) reset({ tipo: "Duplo" });
  }, [open, reset]);

  async function onSubmit(data: FormData) {
    const r = await criarQuarto({ expedicao_id: expedicaoId, ...data, extensao_id: data.extensao_id || null });
    if (r.ok) {
      toast.success("Quarto criado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao criar quarto", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>Novo quarto</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "Duplo", { shouldDirty: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_QUARTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                O número do quarto é atribuído automaticamente, em ordem, dentro de cada hotel.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nq-hotel">Hotel / Cidade</Label>
              <Input id="nq-hotel" {...register("hotel_cidade")} placeholder="Hotel Casa Andina — Cusco" />
            </div>

            {extensoes && extensoes.length > 0 && (
              <div className="space-y-1">
                <Label>Faz parte de</Label>
                <Select value={watch("extensao_id") ?? ""} onValueChange={(v) => setValue("extensao_id", v === "__base__" ? "" : v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Grupo principal (todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__base__">Grupo principal (todos)</SelectItem>
                    {extensoes.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Hotel de extensão: só quem contratou entra na alocação.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="nq-in">Check-in</Label>
                <Input id="nq-in" type="date" {...register("check_in")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nq-out">Check-out</Label>
                <Input id="nq-out" type="date" {...register("check_out")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nq-obs">Observações</Label>
              <textarea
                id="nq-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar quarto"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
