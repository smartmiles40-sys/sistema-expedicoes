"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { duplicarHotelRooming } from "@/app/(app)/expedicoes/actions";

type Origem = { quartoIds: string[]; hotelOrigem: string | null };
type FormData = { hotel_cidade: string; check_in: string; check_out: string };

export function DuplicarHotelDrawer({
  expedicaoId,
  origem,
  onOpenChange,
}: {
  expedicaoId: string;
  origem: Origem | null;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const open = origem !== null;
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } =
    useForm<FormData>({ defaultValues: { hotel_cidade: "", check_in: "", check_out: "" } });

  React.useEffect(() => {
    if (origem) reset({ hotel_cidade: "", check_in: "", check_out: "" });
  }, [origem, reset]);

  async function onSubmit(data: FormData) {
    if (!origem) return;
    const r = await duplicarHotelRooming(expedicaoId, origem.quartoIds, {
      hotel_cidade: data.hotel_cidade.trim(),
      check_in: data.check_in || null,
      check_out: data.check_out || null,
    });
    if (r.ok) {
      toast.success(`Hotel duplicado — ${r.criados ?? 0} quarto(s) com os mesmos passageiros`);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao duplicar", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2"><Copy className="h-4 w-4" /> Duplicar hotel</DrawerTitle>
            <DrawerDescription>
              Copia os {origem?.quartoIds.length ?? 0} quarto(s){origem?.hotelOrigem ? ` de "${origem.hotelOrigem}"` : ""} para um novo hotel,
              com os mesmos passageiros alocados. Não muda nada no hotel de origem.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-1">
              <Label htmlFor="dup-hotel">Novo hotel / cidade</Label>
              <Input id="dup-hotel" {...register("hotel_cidade")} placeholder="Ex.: Resort All Inclusive - Hurghada" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="dup-in">Check-in</Label>
                <Input id="dup-in" type="date" {...register("check_in")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dup-out">Check-out</Label>
                <Input id="dup-out" type="date" {...register("check_out")} />
              </div>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || !watch("hotel_cidade")?.trim()}>
              {isSubmitting ? "Duplicando..." : "Duplicar"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
