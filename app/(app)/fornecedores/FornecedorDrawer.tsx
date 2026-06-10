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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/Select";
import { TIPO_FORNECEDOR, STATUS_FORNECEDOR, MOEDAS } from "@/lib/constants";
import { criarFornecedor, atualizarFornecedor } from "./actions";
import type { FornecedorRow } from "@/types/database";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["DMC", "Hotel", "Guia", "Aéreo", "Receptivo", "Seguro", "Outros"]),
  contato_nome: z.string().optional(),
  contato_email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  contato_whatsapp: z.string().optional(),
  destino_cidade: z.string().optional(),
  moeda_padrao: z.string().min(2),
  politica_pagamento: z.string().optional(),
  status: z.enum(["Ativo", "Pausado", "Bloqueado"]),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  fornecedor: FornecedorRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FornecedorDrawer({ fornecedor, open, onOpenChange }: Props) {
  const router = useRouter();
  const editando = fornecedor !== null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        tipo: "DMC",
        moeda_padrao: "BRL",
        status: "Ativo",
      },
    });

  React.useEffect(() => {
    if (!open) return;
    if (fornecedor) {
      reset({
        nome: fornecedor.nome,
        tipo: fornecedor.tipo,
        contato_nome: fornecedor.contato_nome ?? "",
        contato_email: fornecedor.contato_email ?? "",
        contato_whatsapp: fornecedor.contato_whatsapp ?? "",
        destino_cidade: fornecedor.destino_cidade ?? "",
        moeda_padrao: fornecedor.moeda_padrao,
        politica_pagamento: fornecedor.politica_pagamento ?? "",
        status: fornecedor.status,
        observacoes: fornecedor.observacoes ?? "",
      });
    } else {
      reset({
        nome: "",
        tipo: "DMC",
        contato_nome: "",
        contato_email: "",
        contato_whatsapp: "",
        destino_cidade: "",
        moeda_padrao: "BRL",
        politica_pagamento: "",
        status: "Ativo",
        observacoes: "",
      });
    }
  }, [open, fornecedor, reset]);

  async function onSubmit(data: FormData) {
    const r = editando
      ? await atualizarFornecedor(fornecedor.id, data)
      : await criarFornecedor(data);
    if (r.ok) {
      toast.success(editando ? "Fornecedor atualizado" : "Fornecedor criado");
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
            <DrawerTitle>{editando ? "Editar fornecedor" : "Novo fornecedor"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="f-nome">Nome</Label>
              <Input id="f-nome" {...register("nome")} placeholder="Andean DMC" autoFocus />
              {errors.nome && <p className="text-[11px] text-critico-600">{errors.nome.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "DMC", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_FORNECEDOR.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "Ativo", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FORNECEDOR.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="f-cidade">Cidade / Destino</Label>
                <Input id="f-cidade" {...register("destino_cidade")} placeholder="Cusco" />
              </div>
              <div className="space-y-1">
                <Label>Moeda padrão</Label>
                <Select value={watch("moeda_padrao")} onValueChange={(v) => setValue("moeda_padrao", v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Contato</h4>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="f-contato-nome">Nome</Label>
                  <Input id="f-contato-nome" {...register("contato_nome")} placeholder="Diego Quispe" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="f-email">E-mail</Label>
                    <Input id="f-email" type="email" {...register("contato_email")} placeholder="contato@..." />
                    {errors.contato_email && <p className="text-[11px] text-critico-600">{errors.contato_email.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="f-wpp">WhatsApp</Label>
                    <Input id="f-wpp" {...register("contato_whatsapp")} placeholder="+51 984 123 456" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="f-pol">Política de pagamento</Label>
              <Input id="f-pol" {...register("politica_pagamento")} placeholder="30% sinal, 70% até 30 dias antes" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="f-obs">Observações</Label>
              <textarea
                id="f-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || (editando && !isDirty)}>
              {isSubmitting ? "Salvando..." : editando ? "Salvar alterações" : "Criar fornecedor"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
