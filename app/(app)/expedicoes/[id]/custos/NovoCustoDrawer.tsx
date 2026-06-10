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
import { CATEGORIA_CUSTO, MOEDAS } from "@/lib/constants";
import { criarCusto } from "@/app/(app)/expedicoes/actions";
import type { FornecedorRow, CambioRow } from "@/types/database";

const schema = z.object({
  categoria: z.enum([
    "Hotelaria", "Aéreo", "Terrestre", "Ingressos", "Guias", "Seguro", "Taxas", "Brindes", "Outros",
  ]),
  servico: z.string().min(2, "Mínimo 2 caracteres"),
  fornecedor_id: z.string().optional(),
  cidade: z.string().optional(),
  data_servico: z.string().optional(),
  moeda: z.string().min(2),
  valor_planejado: z.number().min(0, "Valor inválido"),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  fornecedores: FornecedorRow[];
  cambios: CambioRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovoCustoDrawer({ expedicaoId, fornecedores, cambios, open, onOpenChange }: Props) {
  const router = useRouter();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { categoria: "Hotelaria", moeda: "BRL", valor_planejado: 0 },
    });

  React.useEffect(() => {
    if (open) reset({ categoria: "Hotelaria", moeda: "BRL", valor_planejado: 0 });
  }, [open, reset]);

  const moeda = watch("moeda");
  const valor = watch("valor_planejado");
  const taxaCambio = cambios.find((c) => c.moeda === moeda)?.taxa_brl ?? 1;
  const previewBRL = valor ? (valor * taxaCambio).toFixed(2) : "—";

  async function onSubmit(data: FormData) {
    const r = await criarCusto({
      expedicao_id: expedicaoId,
      ...data,
      cambio_aplicado: taxaCambio,
    });
    if (r.ok) {
      toast.success("Custo lançado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao lançar custo", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>Novo custo</DrawerTitle>
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
              <Label htmlFor="nc-servico">Serviço/Descrição</Label>
              <Input id="nc-servico" {...register("servico")} placeholder="Hospedagem 4 noites SGL" autoFocus />
              {errors.servico && <p className="text-[11px] text-critico-600">{errors.servico.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="nc-cidade">Cidade</Label>
                <Input id="nc-cidade" {...register("cidade")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-data">Data do serviço</Label>
                <Input id="nc-data" type="date" {...register("data_servico")} />
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
              <div className="space-y-1 col-span-2">
                <Label htmlFor="nc-valor">Valor planejado</Label>
                <Input
                  id="nc-valor"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register("valor_planejado", { valueAsNumber: true })}
                />
                {errors.valor_planejado && <p className="text-[11px] text-critico-600">{errors.valor_planejado.message}</p>}
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Câmbio aplicado: <span className="font-mono">R$ {taxaCambio.toFixed(4)}</span> · Equivalente: <strong className="font-mono">R$ {previewBRL}</strong>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nc-obs">Observações</Label>
              <textarea
                id="nc-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Lançando..." : "Lançar custo"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
