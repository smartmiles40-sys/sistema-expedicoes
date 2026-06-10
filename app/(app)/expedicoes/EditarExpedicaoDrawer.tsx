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
  DrawerDescription,
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
import { STATUS_EXPEDICAO } from "@/lib/constants";
import { atualizarExpedicaoLote } from "./actions";
import type { ExpedicaoComAgregados, StatusExpedicao, Tables } from "@/types/database";

const schema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  destino: z.string().min(2, "Obrigatório"),
  data_embarque: z.string().min(1, "Obrigatório"),
  data_retorno: z.string().min(1, "Obrigatório"),
  status: z.enum(["Planejamento", "Vendas Abertas", "Em andamento", "Concluída", "Cancelada"]),
  pax_planejados: z.number().int().min(0),
  pax_cortesia: z.number().int().min(0),
  preco_venda_brl: z.number().min(0),
  observacoes: z.string().nullable().optional(),
  responsavel_operacional_id: z.string().optional(),
  responsavel_comercial_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  expedicao: ExpedicaoComAgregados | null;
  onOpenChange: (open: boolean) => void;
  usuarios: Tables<"usuarios">[];
}

export function EditarExpedicaoDrawer({ expedicao, onOpenChange, usuarios }: Props) {
  const router = useRouter();
  const open = expedicao !== null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  React.useEffect(() => {
    if (!expedicao) return;
    reset({
      nome: expedicao.nome,
      destino: expedicao.destino,
      data_embarque: expedicao.data_embarque?.slice(0, 10) ?? "",
      data_retorno: expedicao.data_retorno?.slice(0, 10) ?? "",
      status: expedicao.status,
      pax_planejados: expedicao.pax_planejados ?? 0,
      pax_cortesia: expedicao.pax_cortesia ?? 0,
      preco_venda_brl: Number(expedicao.preco_venda_brl ?? 0),
      observacoes: expedicao.observacoes ?? "",
      responsavel_operacional_id: expedicao.responsavel_operacional_id ?? undefined,
      responsavel_comercial_id: expedicao.responsavel_comercial_id ?? undefined,
    });
  }, [expedicao, reset]);

  const status = watch("status");
  const respOp = watch("responsavel_operacional_id");
  const respCom = watch("responsavel_comercial_id");

  async function onSubmit(data: FormData) {
    if (!expedicao) return;
    const r = await atualizarExpedicaoLote(expedicao.id, {
      ...data,
      observacoes: data.observacoes?.trim() ? data.observacoes.trim() : null,
      responsavel_operacional_id: data.responsavel_operacional_id ?? null,
      responsavel_comercial_id: data.responsavel_comercial_id ?? null,
    });
    if (r.ok) {
      toast.success("Expedição atualizada");
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
            <DrawerTitle>Editar expedição</DrawerTitle>
            <DrawerDescription>
              {expedicao?.codigo && (
                <span className="font-mono text-xs">{expedicao.codigo}</span>
              )}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input id="edit-nome" {...register("nome")} />
              {errors.nome && <p className="text-[11px] text-critico-600">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-destino">Destino</Label>
              <Input id="edit-destino" {...register("destino")} />
              {errors.destino && <p className="text-[11px] text-critico-600">{errors.destino.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-data_embarque">Embarque</Label>
                <Input id="edit-data_embarque" type="date" {...register("data_embarque")} />
                {errors.data_embarque && (
                  <p className="text-[11px] text-critico-600">{errors.data_embarque.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-data_retorno">Retorno</Label>
                <Input id="edit-data_retorno" type="date" {...register("data_retorno")} />
                {errors.data_retorno && (
                  <p className="text-[11px] text-critico-600">{errors.data_retorno.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", v as StatusExpedicao, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_EXPEDICAO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-pax_planejados">Pax planejados</Label>
                <Input
                  id="edit-pax_planejados"
                  type="number"
                  min={0}
                  {...register("pax_planejados", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-pax_cortesia">Cortesias</Label>
                <Input
                  id="edit-pax_cortesia"
                  type="number"
                  min={0}
                  {...register("pax_cortesia", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-preco_venda_brl">Preço (R$)</Label>
                <Input
                  id="edit-preco_venda_brl"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register("preco_venda_brl", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Resp. Operacional</Label>
              <Select
                value={respOp ?? "_none"}
                onValueChange={(v) =>
                  setValue("responsavel_operacional_id", v === "_none" ? undefined : v, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— sem responsável —</SelectItem>
                  {usuarios
                    .filter((u) => u.papel === "operacional" || u.papel === "admin")
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Resp. Comercial</Label>
              <Select
                value={respCom ?? "_none"}
                onValueChange={(v) =>
                  setValue("responsavel_comercial_id", v === "_none" ? undefined : v, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— sem responsável —</SelectItem>
                  {usuarios
                    .filter((u) => u.papel === "comercial" || u.papel === "admin")
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-observacoes">Observações</Label>
              <textarea
                id="edit-observacoes"
                {...register("observacoes")}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
