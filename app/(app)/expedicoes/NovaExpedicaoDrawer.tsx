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
import { generateExpedicaoCodigo } from "@/lib/utils";
import { DESTINOS_CADASTRADOS } from "@/lib/prontidao/requisitos-destino";
import { criarExpedicao } from "./actions";
import type { Tables } from "@/types/database";

const schema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  destino: z.string().min(2, "Obrigatório"),
  data_embarque: z.string().min(1, "Obrigatório"),
  data_retorno: z.string().min(1, "Obrigatório"),
  responsavel_operacional_id: z.string().optional(),
  responsavel_comercial_id: z.string().optional(),
  pax_planejados: z.number().int().min(1, "Mínimo 1"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: Tables<"usuarios">[];
}

export function NovaExpedicaoDrawer({ open, onOpenChange, usuarios }: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { pax_planejados: 20 },
  });

  const destino = watch("destino");
  const dataEmbarque = watch("data_embarque");

  const codigoPreview = React.useMemo(() => {
    if (!destino || !dataEmbarque) return "—";
    try {
      return generateExpedicaoCodigo(destino, dataEmbarque);
    } catch {
      return "—";
    }
  }, [destino, dataEmbarque]);

  async function onSubmit(data: FormData) {
    const codigo = generateExpedicaoCodigo(data.destino, data.data_embarque);
    const result = await criarExpedicao({ ...data, codigo });
    if (result.ok) {
      toast.success("Expedição criada", { description: `${codigo} · checklist padrão gerado` });
      reset();
      onOpenChange(false);
      router.push(`/expedicoes/${result.id}`);
    } else {
      toast.error("Erro ao criar", { description: result.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>Nova expedição</DrawerTitle>
            <DrawerDescription>
              O código é gerado automaticamente: <span className="font-mono">{codigoPreview}</span>
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" placeholder="Peru — Caminho Inca Ago 2026" {...register("nome")} />
              {errors.nome && <p className="text-[11px] text-critico-600">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="destino">Destino</Label>
              <Input
                id="destino"
                list="destinos-cadastrados"
                placeholder="Peru, Egito… (ou digite outro)"
                {...register("destino")}
              />
              <datalist id="destinos-cadastrados">
                {DESTINOS_CADASTRADOS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Cadastrados aparecem como sugestão (com condicionais próprias); outros destinos
                caem nos requisitos internacionais padrão.
              </p>
              {errors.destino && <p className="text-[11px] text-critico-600">{errors.destino.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="data_embarque">Embarque</Label>
                <Input id="data_embarque" type="date" {...register("data_embarque")} />
                {errors.data_embarque && <p className="text-[11px] text-critico-600">{errors.data_embarque.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="data_retorno">Retorno</Label>
                <Input id="data_retorno" type="date" {...register("data_retorno")} />
                {errors.data_retorno && <p className="text-[11px] text-critico-600">{errors.data_retorno.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pax_planejados">Pax planejados</Label>
              <Input id="pax_planejados" type="number" min={1} {...register("pax_planejados", { valueAsNumber: true })} />
              {errors.pax_planejados && <p className="text-[11px] text-critico-600">{errors.pax_planejados.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Resp. Operacional</Label>
              <Select
                onValueChange={(v) => setValue("responsavel_operacional_id", v === "_none" ? undefined : v)}
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
                onValueChange={(v) => setValue("responsavel_comercial_id", v === "_none" ? undefined : v)}
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
            <p className="rounded-md border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
              O <strong className="text-foreground">checklist padrão</strong> (31 processos das 5 fases, com prazos
              calculados a partir do embarque) é gerado <strong className="text-foreground">automaticamente</strong>.
            </p>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar expedição"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
