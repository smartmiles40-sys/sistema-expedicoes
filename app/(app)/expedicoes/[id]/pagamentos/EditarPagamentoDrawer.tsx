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
import { MOEDAS, STATUS_PAGAMENTO } from "@/lib/constants";
import { atualizarPagamentoLote } from "@/app/(app)/expedicoes/actions";
import type { PagamentoRow, FornecedorRow } from "@/types/database";

const schema = z.object({
  servico: z.string().min(2),
  fornecedor_id: z.string().optional(),
  moeda: z.string().min(2),
  valor_total: z.number().min(0),
  entrada: z.number().min(0),
  vencimento_saldo: z.string().optional(),
  status: z.enum(["Pendente", "Programado", "Pago", "Parcial", "Vencido", "Cancelado"]),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  pagamento: PagamentoRow | null;
  fornecedores: FornecedorRow[];
  onOpenChange: (v: boolean) => void;
}

export function EditarPagamentoDrawer({ expedicaoId, pagamento, fornecedores, onOpenChange }: Props) {
  const router = useRouter();
  const open = pagamento !== null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!pagamento) return;
    reset({
      servico: pagamento.servico,
      fornecedor_id: pagamento.fornecedor_id ?? undefined,
      moeda: pagamento.moeda,
      valor_total: Number(pagamento.valor_total),
      entrada: Number(pagamento.entrada),
      vencimento_saldo: pagamento.vencimento_saldo?.slice(0, 10) ?? "",
      status: pagamento.status,
      observacoes: pagamento.observacoes ?? "",
    });
  }, [pagamento, reset]);

  const valor_total = watch("valor_total") || 0;
  const entrada = watch("entrada") || 0;
  const moeda = watch("moeda");
  const saldo = Math.max(0, valor_total - entrada);

  async function onSubmit(data: FormData) {
    if (!pagamento) return;
    const r = await atualizarPagamentoLote(pagamento.id, expedicaoId, {
      servico: data.servico,
      fornecedor_id: data.fornecedor_id || null,
      moeda: data.moeda,
      valor_total: data.valor_total,
      entrada: data.entrada,
      vencimento_saldo: data.vencimento_saldo || null,
      status: data.status,
      observacoes: data.observacoes?.trim() || null,
    });
    if (r.ok) {
      toast.success("Pagamento atualizado");
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
            <DrawerTitle>Editar pagamento</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="ep-servico">Serviço/Descrição</Label>
              <Input id="ep-servico" {...register("servico")} />
              {errors.servico && <p className="text-[11px] text-critico-600">{errors.servico.message}</p>}
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
                <Label htmlFor="ep-total">Valor total</Label>
                <Input id="ep-total" type="number" step="0.01" min={0} {...register("valor_total", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-entrada">Entrada</Label>
                <Input id="ep-entrada" type="number" step="0.01" min={0} {...register("entrada", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground tabular-nums">
              Saldo a pagar: <strong>{moeda} {saldo.toFixed(2)}</strong>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-venc">Vencimento</Label>
                <Input id="ep-venc" type="date" {...register("vencimento_saldo")} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "Pendente", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_PAGAMENTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ep-obs">Observações</Label>
              <textarea
                id="ep-obs"
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
