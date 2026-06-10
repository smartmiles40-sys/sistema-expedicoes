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
import { CATEGORIA_CUSTO, MOEDAS, STATUS_CUSTO } from "@/lib/constants";
import { atualizarCustoLote } from "@/app/(app)/expedicoes/actions";
import type { CustoRow, FornecedorRow, CambioRow } from "@/types/database";

const schema = z.object({
  categoria: z.enum([
    "Hotelaria", "Aéreo", "Terrestre", "Ingressos", "Guias", "Seguro", "Taxas", "Brindes", "Outros",
  ]),
  servico: z.string().min(2, "Mínimo 2 caracteres"),
  fornecedor_id: z.string().optional(),
  cidade: z.string().optional(),
  data_servico: z.string().optional(),
  moeda: z.string().min(2),
  valor_planejado: z.number().min(0),
  valor_realizado: z.number().min(0).optional(),
  status: z.enum(["A programar", "Programado", "Pago", "Parcial", "Vencido"]),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  custo: CustoRow | null;
  fornecedores: FornecedorRow[];
  cambios: CambioRow[];
  onOpenChange: (v: boolean) => void;
}

export function EditarCustoDrawer({ expedicaoId, custo, fornecedores, cambios, onOpenChange }: Props) {
  const router = useRouter();
  const open = custo !== null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!custo) return;
    reset({
      categoria: custo.categoria,
      servico: custo.servico,
      fornecedor_id: custo.fornecedor_id ?? undefined,
      cidade: custo.cidade ?? "",
      data_servico: custo.data_servico?.slice(0, 10) ?? "",
      moeda: custo.moeda,
      valor_planejado: Number(custo.valor_planejado),
      valor_realizado: custo.valor_realizado != null ? Number(custo.valor_realizado) : undefined,
      status: custo.status,
      observacoes: custo.observacoes ?? "",
    });
  }, [custo, reset]);

  const moeda = watch("moeda");
  const valor = watch("valor_planejado") || 0;
  const taxaCambio = cambios.find((c) => c.moeda === moeda)?.taxa_brl ?? 1;
  const previewBRL = (valor * taxaCambio).toFixed(2);

  async function onSubmit(data: FormData) {
    if (!custo) return;
    const r = await atualizarCustoLote(custo.id, expedicaoId, {
      categoria: data.categoria,
      servico: data.servico,
      fornecedor_id: data.fornecedor_id || null,
      cidade: data.cidade?.trim() || null,
      data_servico: data.data_servico || null,
      moeda: data.moeda,
      valor_planejado: data.valor_planejado,
      valor_realizado: data.valor_realizado ?? null,
      cambio_aplicado: taxaCambio,
      status: data.status,
      observacoes: data.observacoes?.trim() || null,
    });
    if (r.ok) {
      toast.success("Custo atualizado");
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
            <DrawerTitle>Editar custo</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={watch("categoria")} onValueChange={(v) => setValue("categoria", v as "Hotelaria", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIA_CUSTO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={watch("fornecedor_id") ?? "_none"} onValueChange={(v) => setValue("fornecedor_id", v === "_none" ? undefined : v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem fornecedor —</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ec-servico">Serviço/Descrição</Label>
              <Input id="ec-servico" {...register("servico")} />
              {errors.servico && <p className="text-[11px] text-critico-600">{errors.servico.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ec-cidade">Cidade</Label>
                <Input id="ec-cidade" {...register("cidade")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-data">Data do serviço</Label>
                <Input id="ec-data" type="date" {...register("data_servico")} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Moeda</Label>
                <Select value={watch("moeda")} onValueChange={(v) => setValue("moeda", v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-plan">Valor planejado</Label>
                <Input id="ec-plan" type="number" step="0.01" min={0} {...register("valor_planejado", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-real">Valor realizado</Label>
                <Input
                  id="ec-real"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register("valor_realizado", {
                    setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                  })}
                />
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Câmbio aplicado: <span className="font-mono">R$ {taxaCambio.toFixed(4)}</span> · Equivalente plan.: <strong className="font-mono">R$ {previewBRL}</strong>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "Programado", { shouldDirty: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_CUSTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ec-obs">Observações</Label>
              <textarea
                id="ec-obs"
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
