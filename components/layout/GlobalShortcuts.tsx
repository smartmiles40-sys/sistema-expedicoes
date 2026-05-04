"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

const ATALHOS: { keys: string; descricao: string }[] = [
  { keys: "/", descricao: "Focar busca" },
  { keys: "n", descricao: "Nova expedição (na lista)" },
  { keys: "↑ ↓", descricao: "Navegar linhas" },
  { keys: "Enter", descricao: "Abrir item selecionado / salvar célula" },
  { keys: "Esc", descricao: "Cancelar edição" },
  { keys: "Tab", descricao: "Próxima célula" },
  { keys: "⌘ K", descricao: "Command palette" },
  { keys: "g d", descricao: "Ir para Dashboard" },
  { keys: "g e", descricao: "Ir para Expedições" },
  { keys: "g f", descricao: "Ir para Fornecedores" },
  { keys: "?", descricao: "Mostrar atalhos" },
];

export function GlobalShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const lastKeyRef = React.useRef<string>("");
  const lastTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Sequência g+letra
      const now = Date.now();
      if (lastKeyRef.current === "g" && now - lastTimeRef.current < 1500) {
        if (e.key === "d") {
          e.preventDefault();
          router.push("/dashboard");
          lastKeyRef.current = "";
          return;
        }
        if (e.key === "e") {
          e.preventDefault();
          router.push("/expedicoes");
          lastKeyRef.current = "";
          return;
        }
        if (e.key === "f") {
          e.preventDefault();
          router.push("/fornecedores");
          lastKeyRef.current = "";
          return;
        }
      }
      if (e.key === "g") {
        lastKeyRef.current = "g";
        lastTimeRef.current = now;
        return;
      }
      lastKeyRef.current = "";
    };
    const onShowKeymap = () => setHelpOpen(true);

    window.addEventListener("keydown", onKey);
    window.addEventListener("show-keymap", onShowKeymap as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("show-keymap", onShowKeymap as EventListener);
    };
  }, [router]);

  return (
    <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background p-5 shadow-lg outline-none animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <Dialog.Title className="text-base font-semibold">Atalhos do teclado</Dialog.Title>
            <Dialog.Close className="rounded-sm p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <ul className="space-y-1.5">
            {ATALHOS.map((a) => (
              <li key={a.keys} className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">{a.descricao}</span>
                <kbd className="border border-border rounded px-1.5 py-0.5 font-mono text-[11px] bg-muted/50">
                  {a.keys}
                </kbd>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-4">
            Atalhos não funcionam em campos de texto.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
