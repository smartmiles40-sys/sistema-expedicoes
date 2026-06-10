"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { TIPO_PASSAGEIRO, STATUS_RESERVA } from "@/lib/constants";
import { criarPassageiro } from "@/app/(app)/expedicoes/actions";

const schema = z.object({
  nome_completo: z.string().min(2, "Mínimo 2 caracteres"),
  tipo: z.enum(["Pagante", "Cortesia", "Líder"]),
  status_reserva: z.enum(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]),
  cpf: z.string().optional(),
  passaporte: z.string().optional(),
  validade_passaporte: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovoPassageiroDrawer({ expedicaoId, open, onOpenChange }: Props) {
  const router = useRouter();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { tipo: "Pagante", status_reserva: "Lead" },
    });

  React.useEffect(() => {
    if (open) reset({ tipo: "Pagante", status_reserva: "Lead" });
  }, [open, reset]);

  async function onSubmit(data: FormData) {
    const r = await criarPassageiro({ expedicao_id: expedicaoId, ...data });
    if (r.ok) {
      toast.success("Passageiro adicionado");
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
            <DrawerTitle>Novo passageiro</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="np-nome">Nome completo</Label>
              <Input id="np-nome" {...register("nome_completo")} autoFocus />
              {errors.nome_completo && <p className="text-[11px] text-critico-600">{errors.nome_completo.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "Pagante", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_PASSAGEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={watch("status_reserva")} onValueChange={(v) => setValue("status_reserva", v as "Lead", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_RESERVA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="np-cpf">CPF</Label>
                <Input id="np-cpf" {...register("cpf")} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="np-tel">Telefone</Label>
                <Input id="np-tel" {...register("telefone")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="np-pass">Passaporte</Label>
                <Input id="np-pass" {...register("passaporte")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="np-val">Validade</Label>
                <Input id="np-val" type="date" {...register("validade_passaporte")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="np-email">Email</Label>
              <Input id="np-email" type="email" {...register("email")} />
              {errors.email && <p className="text-[11px] text-critico-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="np-obs">Observações</Label>
              <textarea
                id="np-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adicionando..." : "Adicionar passageiro"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
