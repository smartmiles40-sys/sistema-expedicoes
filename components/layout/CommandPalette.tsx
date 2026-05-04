"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Map,
  Building2,
  Coins,
  Settings,
  Plus,
  Compass,
  HelpCircle,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import type { ExpedicaoComAgregados } from "@/types/database";
import type { FornecedorRow, PassageiroRow } from "@/types/database";

interface Props {
  expedicoes: ExpedicaoComAgregados[];
  passageiros: PassageiroRow[];
  fornecedores: FornecedorRow[];
}

export function CommandPalette({ expedicoes, passageiros, fornecedores }: Props) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "p" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (isInput) return;
      if (e.key === "?") {
        e.preventDefault();
        // dispatch event para abrir modal de ajuda
        window.dispatchEvent(new CustomEvent("show-keymap"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[20%] z-50 w-full max-w-lg translate-x-[-50%] rounded-lg border border-border bg-background shadow-lg outline-none animate-fade-in">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command className="flex flex-col" loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Compass className="h-4 w-4 text-muted-foreground shrink-0" />
              <Command.Input
                placeholder="Buscar expedição, passageiro, fornecedor..."
                className="flex-1 h-10 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5 font-mono">ESC</kbd>
            </div>
            <Command.List className="max-h-[400px] overflow-y-auto p-1">
              <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
                Nenhum resultado.
              </Command.Empty>

              <Command.Group heading="Navegação" className="text-[11px] uppercase tracking-wide text-muted-foreground p-1">
                <Item onSelect={() => go("/dashboard")} icon={<LayoutDashboard className="h-3.5 w-3.5" />}>
                  Dashboard <Hint>g d</Hint>
                </Item>
                <Item onSelect={() => go("/expedicoes")} icon={<Map className="h-3.5 w-3.5" />}>
                  Expedições <Hint>g e</Hint>
                </Item>
                <Item onSelect={() => go("/fornecedores")} icon={<Building2 className="h-3.5 w-3.5" />}>
                  Fornecedores <Hint>g f</Hint>
                </Item>
                <Item onSelect={() => go("/cambios")} icon={<Coins className="h-3.5 w-3.5" />}>
                  Câmbios
                </Item>
                <Item onSelect={() => go("/configuracoes")} icon={<Settings className="h-3.5 w-3.5" />}>
                  Configurações
                </Item>
              </Command.Group>

              <Command.Group heading="Ações" className="text-[11px] uppercase tracking-wide text-muted-foreground p-1">
                <Item
                  onSelect={() => {
                    setOpen(false);
                    router.push("/expedicoes");
                    setTimeout(() => {
                      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
                    }, 200);
                  }}
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Nova expedição
                </Item>
                <Item
                  onSelect={() => {
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent("show-keymap"));
                  }}
                  icon={<HelpCircle className="h-3.5 w-3.5" />}
                >
                  Mostrar atalhos <Hint>?</Hint>
                </Item>
              </Command.Group>

              <Command.Group heading="Expedições" className="text-[11px] uppercase tracking-wide text-muted-foreground p-1">
                {expedicoes.map((e) => (
                  <Item key={e.id} onSelect={() => go(`/expedicoes/${e.id}`)} value={`expedicao ${e.codigo} ${e.nome} ${e.destino}`}>
                    <span className="font-mono text-[11px] text-muted-foreground mr-2">{e.codigo}</span>
                    {e.nome}
                  </Item>
                ))}
              </Command.Group>

              <Command.Group heading="Passageiros" className="text-[11px] uppercase tracking-wide text-muted-foreground p-1">
                {passageiros.slice(0, 30).map((p) => {
                  const exp = expedicoes.find((e) => e.id === p.expedicao_id);
                  return (
                    <Item
                      key={p.id}
                      onSelect={() => go(`/expedicoes/${p.expedicao_id}/passageiros`)}
                      value={`pax ${p.nome_completo} ${p.cpf ?? ""} ${p.email ?? ""}`}
                    >
                      {p.nome_completo}
                      {exp && <span className="text-[10px] text-muted-foreground ml-2">{exp.codigo}</span>}
                    </Item>
                  );
                })}
              </Command.Group>

              <Command.Group heading="Fornecedores" className="text-[11px] uppercase tracking-wide text-muted-foreground p-1">
                {fornecedores.slice(0, 20).map((f) => (
                  <Item key={f.id} onSelect={() => go(`/fornecedores`)} value={`fornecedor ${f.nome} ${f.tipo}`}>
                    {f.nome}
                    <span className="text-[10px] text-muted-foreground ml-2">{f.tipo}</span>
                  </Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Item({
  onSelect,
  icon,
  value,
  children,
}: {
  onSelect: () => void;
  icon?: React.ReactNode;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-sm text-[13px] cursor-pointer",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </Command.Item>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-auto text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5 font-mono">
      {children}
    </kbd>
  );
}
