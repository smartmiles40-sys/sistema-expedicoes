"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, Plane } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adicionarPassageiroExistente } from "@/app/(app)/expedicoes/actions";
import { cpfDigitos } from "@/lib/csv/passageiros-import";
import type { PessoaAgregada } from "@/lib/data/pessoas";

interface Props {
  expedicaoId: string;
  pessoas: PessoaAgregada[];
  /** CPFs (só dígitos) já presentes nesta expedição — pra ocultar quem já está. */
  cpfsExistentes: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AdicionarExistenteDrawer({ expedicaoId, pessoas, cpfsExistentes, open, onOpenChange }: Props) {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [adicionando, setAdicionando] = React.useState<string | null>(null);

  const jaNaExp = React.useMemo(() => new Set(cpfsExistentes.filter(Boolean)), [cpfsExistentes]);
  const termo = busca.trim().toLowerCase();

  const filtradas = React.useMemo(() => {
    return pessoas
      .filter((p) => {
        const cpfD = cpfDigitos(p.cpf);
        if (cpfD && jaNaExp.has(cpfD)) return false; // já está nesta expedição
        if (!termo) return true;
        return [p.nome_completo, p.cpf ?? "", p.email ?? ""].join(" ").toLowerCase().includes(termo);
      })
      .slice(0, 50);
  }, [pessoas, termo, jaNaExp]);

  async function adicionar(p: PessoaAgregada) {
    const ref = p.idsPassageiros[0];
    if (!ref) return;
    setAdicionando(p.chave);
    const r = await adicionarPassageiroExistente(expedicaoId, ref);
    setAdicionando(null);
    if (r.ok) {
      toast.success(`${p.nome_completo} adicionado(a) à expedição`);
      router.refresh();
      // mantém aberto pra adicionar vários
    } else {
      toast.error("Não foi possível adicionar", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Adicionar passageiro existente</DrawerTitle>
          <DrawerDescription>
            Busque por nome ou CPF na base de passageiros e inclua nesta expedição.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CPF…"
              className="pl-7"
              autoFocus
            />
          </div>

          <ul className="mt-3 divide-y divide-border rounded-md border border-border overflow-hidden">
            {filtradas.length === 0 ? (
              <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                {termo
                  ? "Nenhuma pessoa encontrada (ou já está nesta expedição)."
                  : "Comece a digitar para buscar."}
              </li>
            ) : (
              filtradas.map((p) => (
                <li key={p.chave} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{p.nome_completo}</div>
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                      <span className="font-mono">{p.cpf ?? "sem CPF"}</span>
                      {p.totalExpedicoes > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Plane className="h-3 w-3" /> {p.totalExpedicoes}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={adicionando === p.chave}
                    onClick={() => adicionar(p)}
                  >
                    <UserPlus className="h-3 w-3" /> {adicionando === p.chave ? "Adicionando…" : "Adicionar"}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
