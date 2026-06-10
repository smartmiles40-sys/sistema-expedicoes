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
import { criarPagamento } from "@/app/(app)/expedicoes/actions";
import type { CustoRow, FornecedorRow } from "@/types/database";

const schema = z.object({
  custo_id: z.string().min(1, "Selecione o custo"),
  servico: z.string().min(2),
  moeda: z.string().min(2),
  valor_total: z.number().min(0),
  entrada: z.number().min(0),
  vencimento_saldo: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  custos: CustoRow[];
  fornecedores: FornecedorRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovoPagamentoDrawer({ expedicaoId, custos, fornecedores, open, onOpenChange }: Props) {
  const router = useRouter();
  const fornecedoresById = new Map(fornecedores.map((f) => [f.id, f]));

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { entrada: 0, valor_total: 0, moeda: "BRL", servico: "" },
    });

  const custoId = watch("custo_id");
  const valor_total = watch("valor_total") || 0;
  const entrada = watch("entrada") || 0;
  const saldo = Math.max(0, valor_total - entrada);

  // Quando muda o custo, pré-popula serviço/moeda/valor
  React.useEffect(() => {
    if (!custoId) return;
    const c = custos.find((x) => x.id === custoId);
    if (c) {
      setValue("servico", c.servico);
      setValue("moeda", c.moeda);
      setValue("valor_total", Number(c.valor_planejado));
    }
  }, [custoId, custos, setValue]);

  React.useEffect(() => {
    if (open) reset({ entrada: 0, valor_total: 0, moeda: "BRL", servico: "" });
  }, [open, reset]);

  async function onSubmit(data: FormData) {
    const c = custos.find((x) => x.id === data.custo_id);
    const r = await criarPagamento({
      expedicao_id: expedicaoId,
      custo_id: data.custo_id,
      fornecedor_id: c?.fornecedor_id ?? null,
      servico: data.servico,
      moeda: data.moeda,
      valor_total: data.valor_total,
      entrada: data.entrada,
      vencimento_saldo: data.vencimento_saldo,
      observacoes: data.observacoes,
    });
    if (r.ok) {
      toast.success("Pagamento criado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao criar pagamento", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>Novo pagamento</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label>Custo vinculado</Label>
              <Select value={watch("custo_id") ?? ""} onValueChange={(v) => setValue("custo_id", v, { shouldDirty: true })}>
                <SelectTrigger><SelectValue placeholder="Selecione o custo..." /></SelectTrigger>
                <SelectContent>
                  {custos.length === 0 ? (
                    <SelectItem value="_empty" disabled>— Nenhum custo lançado ainda —</SelectItem>
                  ) : (
                    custos.map((c) => {
                      const fn = c.fornecedor_id ? fornecedoresById.get(c.fornecedor_id)?.nome : null;
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.servico} {fn ? `· ${fn}` : ""} ({c.moeda} {Number(c.valor_planejado).toFixed(2)})
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              {errors.custo_id && <p className="text-[11px] text-critico-600">{errors.custo_id.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="npg-servico">Descrição/Serviço</Label>
              <Input id="npg-servico" {...register("servico")} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="npg-moeda">Moeda</Label>
                <Input id="npg-moeda" {...register("moeda")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="npg-total">Valor total</Label>
                <Input id="npg-total" type="number" step="0.01" min={0} {...register("valor_total", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="npg-entrada">Entrada</Label>
                <Input id="npg-entrada" type="number" step="0.01" min={0} {...register("entrada", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground tabular-nums">
              Saldo a pagar: <strong>{watch("moeda")} {saldo.toFixed(2)}</strong>
            </div>

            <div className="space-y-1">
              <Label htmlFor="npg-venc">Vencimento do saldo</Label>
              <Input id="npg-venc" type="date" {...register("vencimento_saldo")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="npg-obs">Observações</Label>
              <textarea
                id="npg-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar pagamento"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
