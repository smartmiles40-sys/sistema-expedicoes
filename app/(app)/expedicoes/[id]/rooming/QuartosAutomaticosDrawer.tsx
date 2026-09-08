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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { TIPO_QUARTO } from "@/lib/constants";
import { criarQuartosAutomaticos } from "@/app/(app)/expedicoes/actions";

const schema = z.object({
  hotel_cidade: z.string().min(1, "Informe o hotel/cidade"),
  check_in: z.string().min(1, "Informe o check-in"),
  check_out: z.string().min(1, "Informe o check-out"),
  tipo: z.enum(["Single", "Duplo", "Twin", "Triplo", "Compartilhado", "Líder"]),
  quantidade: z.coerce.number().int().min(1, "Mínimo 1").max(100, "Máximo 100"),
  extensao_id: z.string().optional(),
});
type FormData = z.input<typeof schema>;

interface Props {
  expedicaoId: string;
  /** Preenche hotel/datas (ao adicionar quartos a uma seção/hotel já existente). */
  prefill?: { hotel_cidade: string; check_in: string; check_out: string; extensao_id?: string | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  extensoes?: { id: string; nome: string }[];
}

export function QuartosAutomaticosDrawer({ expedicaoId, prefill, open, onOpenChange, extensoes }: Props) {
  const router = useRouter();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { tipo: "Duplo", quantidade: 5 },
    });

  React.useEffect(() => {
    if (!open) return;
    reset({
      tipo: "Duplo",
      quantidade: prefill ? 1 : 5,
      hotel_cidade: prefill?.hotel_cidade ?? "",
      check_in: prefill?.check_in ?? "",
      check_out: prefill?.check_out ?? "",
      extensao_id: prefill?.extensao_id ?? "",
    });
  }, [open, reset, prefill]);

  async function onSubmit(data: FormData) {
    const r = await criarQuartosAutomaticos({
      expedicao_id: expedicaoId,
      hotel_cidade: data.hotel_cidade,
      check_in: data.check_in,
      check_out: data.check_out,
      tipo: data.tipo,
      quantidade: Number(data.quantidade),
      extensao_id: data.extensao_id || null,
    });
    if (r.ok) {
      toast.success(`${r.criados} quarto(s) criado(s)`);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao criar quartos", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>{prefill ? "Adicionar quartos à seção" : "Criar quartos automaticamente"}</DrawerTitle>
            <DrawerDescription>
              {prefill
                ? `Adiciona quartos a ${prefill.hotel_cidade || "este hotel"} (mesmas datas). Os números continuam a sequência do hotel.`
                : "Cria vários quartos do mesmo tipo para um hotel/trecho de uma vez. Os números são gerados em sequência (continuando os que já existem nesse hotel)."}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qa-hotel">Hotel / Cidade</Label>
              <Input id="qa-hotel" {...register("hotel_cidade")} placeholder="Hotel Casa Andina — Cusco" autoFocus />
              {errors.hotel_cidade && <p className="text-[11px] text-critico-600">{errors.hotel_cidade.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="qa-in">Check-in</Label>
                <Input id="qa-in" type="date" {...register("check_in")} />
                {errors.check_in && <p className="text-[11px] text-critico-600">{errors.check_in.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="qa-out">Check-out</Label>
                <Input id="qa-out" type="date" {...register("check_out")} />
                {errors.check_out && <p className="text-[11px] text-critico-600">{errors.check_out.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tipo do quarto</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "Duplo", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_QUARTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="qa-qtd">Quantos quartos</Label>
                <Input id="qa-qtd" type="number" min={1} max={100} {...register("quantidade")} />
                {errors.quantidade && <p className="text-[11px] text-critico-600">{errors.quantidade.message}</p>}
              </div>
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
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar quartos"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
