"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { PassageiroRow } from "@/types/database";
import { conectarPassageiros, removerDaConexao } from "@/app/(app)/expedicoes/actions";

interface Props {
  expedicaoId: string;
  passageiros: PassageiroRow[];
  /** Membros iniciais (edição). Vazio/ausente = criar nova conexão. */
  membrosIniciais?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConexaoViagemDrawer({ expedicaoId, passageiros, membrosIniciais, open, onOpenChange }: Props) {
  const router = useRouter();
  const editando = (membrosIniciais?.length ?? 0) > 0;
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [busca, setBusca] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSel(new Set(membrosIniciais ?? []));
      setBusca("");
    }
  }, [open, membrosIniciais]);

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtrados = passageiros.filter((p) =>
    !busca.trim() ? true : p.nome_completo.toLowerCase().includes(busca.toLowerCase()),
  );

  async function salvar() {
    const selecionados = [...sel];
    const iniciais = membrosIniciais ?? [];
    if (!editando && selecionados.length < 2) {
      toast.error("Selecione ao menos 2 pessoas que viajam juntas.");
      return;
    }
    setSalvando(true);
    try {
      // Quem foi desmarcado na edição sai da conexão (dissolve se sobrar <2).
      const removidos = iniciais.filter((id) => !sel.has(id));
      for (const id of removidos) {
        const r = await removerDaConexao(id, expedicaoId);
        if (!r.ok) { toast.error("Erro ao atualizar conexão", { description: r.error }); setSalvando(false); return; }
      }
      if (selecionados.length >= 2) {
        const r = await conectarPassageiros(expedicaoId, selecionados);
        if (!r.ok) { toast.error("Erro ao conectar", { description: r.error }); setSalvando(false); return; }
      }
      toast.success(editando ? "Conexão atualizada" : "Conexão criada");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent width="w-[460px]">
        <DrawerHeader>
          <DrawerTitle>{editando ? "Editar conexão" : "Nova conexão (viajam juntas)"}</DrawerTitle>
          <DrawerDescription>
            Marque as pessoas que viajam juntas (casal, família, amigos). Elas serão tratadas como um
            grupo para ficar no mesmo quarto.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <input
            placeholder="Buscar passageiro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600 mb-2"
          />
          <p className="text-[11px] text-muted-foreground mb-2">{sel.size} selecionada(s)</p>
          <div className="space-y-1">
            {filtrados.map((p) => {
              const marcado = sel.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors",
                    marcado ? "border-editavel-600 bg-editavel-100/50" : "border-border hover:bg-muted",
                  )}
                >
                  <input type="checkbox" readOnly checked={marcado} className="h-3.5 w-3.5 pointer-events-none" />
                  <Avatar nome={p.nome_completo} size={22} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{p.nome_completo}</div>
                    <div className="text-[10px] text-muted-foreground">{p.tipo}</div>
                  </div>
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="text-[12px] text-muted-foreground py-4 text-center">Nenhum passageiro encontrado.</p>
            )}
          </div>
        </DrawerBody>

        <DrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Salvar conexão" : "Criar conexão"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
