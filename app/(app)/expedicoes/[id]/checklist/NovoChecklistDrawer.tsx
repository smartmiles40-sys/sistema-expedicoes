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
import { ETAPA_CHECKLIST, PRIORIDADE } from "@/lib/constants";
import { criarChecklistItem } from "@/app/(app)/expedicoes/actions";
import type { Tables } from "@/types/database";

const schema = z.object({
  etapa: z.enum([...ETAPA_CHECKLIST] as [(typeof ETAPA_CHECKLIST)[number], ...(typeof ETAPA_CHECKLIST)[number][]]),
  tarefa: z.string().min(2, "Mínimo 2 caracteres"),
  prazo: z.string().optional(),
  prioridade: z.enum(["Baixa", "Média", "Alta", "Crítica"]),
  responsavel_id: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;
const ETAPA_PADRAO: FormData["etapa"] = "6 a 2 meses";

interface Props {
  expedicaoId: string;
  usuarios: Tables<"usuarios">[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovoChecklistDrawer({ expedicaoId, usuarios, open, onOpenChange }: Props) {
  const router = useRouter();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { etapa: ETAPA_PADRAO, prioridade: "Média" },
    });

  React.useEffect(() => {
    if (open) reset({ etapa: ETAPA_PADRAO, prioridade: "Média" });
  }, [open, reset]);

  async function onSubmit(data: FormData) {
    const r = await criarChecklistItem({
      expedicao_id: expedicaoId,
      ...data,
      responsavel_id: data.responsavel_id === "_none" ? null : data.responsavel_id,
    });
    if (r.ok) {
      toast.success("Tarefa adicionada");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao adicionar", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>Nova tarefa</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="nck-tarefa">Tarefa</Label>
              <Input id="nck-tarefa" {...register("tarefa")} placeholder="Ex: Confirmar lista de pax com DMC" autoFocus />
              {errors.tarefa && <p className="text-[11px] text-critico-600">{errors.tarefa.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Etapa</Label>
                <Select value={watch("etapa")} onValueChange={(v) => setValue("etapa", v as FormData["etapa"], { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ETAPA_CHECKLIST.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={watch("prioridade")} onValueChange={(v) => setValue("prioridade", v as "Média", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="nck-prazo">Prazo</Label>
                <Input id="nck-prazo" type="date" {...register("prazo")} />
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select value={watch("responsavel_id") ?? "_none"} onValueChange={(v) => setValue("responsavel_id", v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem responsável —</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nck-obs">Observações</Label>
              <textarea
                id="nck-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adicionando..." : "Adicionar tarefa"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
