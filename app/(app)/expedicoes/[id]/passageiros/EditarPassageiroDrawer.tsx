"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
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
import { TIPO_PASSAGEIRO, STATUS_RESERVA } from "@/lib/constants";
import { Drive } from "@/components/arquivos/Drive";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { atualizarPassageiroLote, excluirPassageiro } from "@/app/(app)/expedicoes/actions";
import type { ArquivoRow, PassageiroRow } from "@/types/database";

const schema = z.object({
  nome_completo: z.string().min(2, "Mínimo 2 caracteres"),
  tipo: z.enum(["Pagante", "Cortesia", "Líder"]),
  status_reserva: z.enum(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]),
  cpf: z.string().optional(),
  passaporte: z.string().optional(),
  validade_passaporte: z.string().optional(),
  data_nascimento: z.string().optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  telefone: z.string().optional(),
  companhia_aerea: z.string().optional(),
  localizador: z.string().optional(),
  voo_nacional_necessario: z.boolean().optional(),
  contrato_assinado: z.boolean().optional(),
  checkin_online_feito: z.boolean().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  passageiro: PassageiroRow | null;
  arquivos: ArquivoRow[];
  onOpenChange: (open: boolean) => void;
}

export function EditarPassageiroDrawer({ expedicaoId, passageiro, arquivos, onOpenChange }: Props) {
  const router = useRouter();
  const open = passageiro !== null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!passageiro) return;
    reset({
      nome_completo: passageiro.nome_completo,
      tipo: passageiro.tipo,
      status_reserva: passageiro.status_reserva,
      cpf: passageiro.cpf ?? "",
      passaporte: passageiro.passaporte ?? "",
      validade_passaporte: passageiro.validade_passaporte?.slice(0, 10) ?? "",
      data_nascimento: passageiro.data_nascimento?.slice(0, 10) ?? "",
      email: passageiro.email ?? "",
      telefone: passageiro.telefone ?? "",
      companhia_aerea: passageiro.companhia_aerea ?? "",
      localizador: passageiro.localizador ?? "",
      voo_nacional_necessario: passageiro.voo_nacional_necessario ?? false,
      contrato_assinado: passageiro.contrato_assinado ?? false,
      checkin_online_feito: passageiro.checkin_online_feito ?? false,
      observacoes: passageiro.observacoes ?? "",
    });
  }, [passageiro, reset]);

  async function onSubmit(data: FormData) {
    if (!passageiro) return;
    const r = await atualizarPassageiroLote(passageiro.id, expedicaoId, {
      ...data,
      cpf: data.cpf?.trim() || null,
      passaporte: data.passaporte?.trim() || null,
      validade_passaporte: data.validade_passaporte || null,
      data_nascimento: data.data_nascimento || null,
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
      companhia_aerea: data.companhia_aerea?.trim() || null,
      localizador: data.localizador?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
    });
    if (r.ok) {
      toast.success("Passageiro atualizado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  const arquivosDoPassageiro = passageiro
    ? arquivos.filter((a) => a.passageiro_id === passageiro.id)
    : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle>Editar passageiro</DrawerTitle>
            {passageiro && (
              <Link
                href={`/expedicoes/${expedicaoId}/passageiros/${passageiro.id}`}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> Abrir página completa
              </Link>
            )}
          </div>
          <DrawerDescription>
            Edite os dados e gerencie os arquivos do cliente.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <form
            id="edit-passageiro-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="ep-nome">Nome completo</Label>
              <Input id="ep-nome" {...register("nome_completo")} />
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
                <Label htmlFor="ep-cpf">CPF</Label>
                <Input id="ep-cpf" {...register("cpf")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-tel">Telefone</Label>
                <Input id="ep-tel" {...register("telefone")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-pass">Passaporte</Label>
                <Input id="ep-pass" {...register("passaporte")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-val">Validade</Label>
                <Input id="ep-val" type="date" {...register("validade_passaporte")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-nasc">Nascimento</Label>
                <Input id="ep-nasc" type="date" {...register("data_nascimento")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-email">Email</Label>
                <Input id="ep-email" type="email" {...register("email")} />
                {errors.email && <p className="text-[11px] text-critico-600">{errors.email.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-cia">Companhia aérea</Label>
                <Input id="ep-cia" {...register("companhia_aerea")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-loc">Localizador</Label>
                <Input id="ep-loc" {...register("localizador")} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Embarque</span>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  {...register("contrato_assinado")}
                  className="h-3.5 w-3.5"
                />
                Contrato assinado
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  {...register("checkin_online_feito")}
                  className="h-3.5 w-3.5"
                />
                Check-in online feito
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  {...register("voo_nacional_necessario")}
                  className="h-3.5 w-3.5"
                />
                Voo nacional necessário
              </label>
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
          </form>

          {/* Drive — arquivos do passageiro */}
          {passageiro && (
            <div className="mt-5 pt-4 border-t border-border space-y-2">
              <div>
                <h3 className="text-sm font-semibold">Arquivos do cliente</h3>
                <p className="text-[11px] text-muted-foreground">
                  Apólices, bilhetes, documentos pessoais. Vinculados a este passageiro.
                </p>
              </div>
              <Drive
                expedicaoId={expedicaoId}
                passageiroId={passageiro.id}
                arquivos={arquivosDoPassageiro}
              />
            </div>
          )}
        </DrawerBody>

        <DrawerFooter>
          {passageiro && (
            <ConfirmDeleteButton
              triggerLabel="Excluir passageiro"
              triggerClassName="mr-auto"
              ariaLabel="Excluir passageiro"
              title={`Excluir "${passageiro.nome_completo}"?`}
              description="Esta ação não pode ser desfeita. Arquivos vinculados continuarão no storage."
              successMessage="Passageiro excluído"
              onConfirm={() => excluirPassageiro(passageiro.id, expedicaoId)}
              onDeleted={() => {
                onOpenChange(false);
                router.refresh();
              }}
            />
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="submit" form="edit-passageiro-form" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
