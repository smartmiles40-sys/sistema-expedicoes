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
import { atualizarQuarto } from "@/app/(app)/expedicoes/actions";
import type { QuartoRow } from "@/types/database";

const schema = z.object({
  numero: z.string().min(1, "Número obrigatório"),
  tipo: z.enum(["Single", "Duplo", "Twin", "Triplo", "Compartilhado", "Líder"]),
  hotel_cidade: z.string().optional(),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  status: z.string().min(1),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  quarto: QuartoRow | null;
  onOpenChange: (v: boolean) => void;
}

const STATUS_OPCOES = ["ativo", "cancelado"];

export function EditarQuartoDrawer({ expedicaoId, quarto, onOpenChange }: Props) {
  const router = useRouter();
  const open = quarto !== null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!quarto) return;
    reset({
      numero: quarto.numero,
      tipo: quarto.tipo,
      hotel_cidade: quarto.hotel_cidade ?? "",
      check_in: quarto.check_in?.slice(0, 10) ?? "",
      check_out: quarto.check_out?.slice(0, 10) ?? "",
      status: quarto.status || "ativo",
      observacoes: quarto.observacoes ?? "",
    });
  }, [quarto, reset]);

  async function onSubmit(data: FormData) {
    if (!quarto) return;
    const r = await atualizarQuarto(quarto.id, expedicaoId, {
      numero: data.numero,
      tipo: data.tipo,
      hotel_cidade: data.hotel_cidade?.trim() || null,
      check_in: data.check_in || null,
      check_out: data.check_out || null,
      status: data.status,
      observacoes: data.observacoes?.trim() || null,
    });
    if (r.ok) {
      toast.success("Quarto atualizado");
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
            <DrawerTitle>Editar quarto</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="eq-numero">Número/Identificador</Label>
                <Input id="eq-numero" {...register("numero")} />
                {errors.numero && <p className="text-[11px] text-critico-600">{errors.numero.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "Duplo", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_QUARTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="eq-hotel">Hotel / Cidade</Label>
              <Input id="eq-hotel" {...register("hotel_cidade")} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="eq-in">Check-in</Label>
                <Input id="eq-in" type="date" {...register("check_in")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq-out">Check-out</Label>
                <Input id="eq-out" type="date" {...register("check_out")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v, { shouldDirty: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="eq-obs">Observações</Label>
              <textarea
                id="eq-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
