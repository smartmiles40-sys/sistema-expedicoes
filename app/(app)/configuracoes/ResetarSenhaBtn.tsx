"use client";
import * as React from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { resetarSenhaUsuario } from "./actions";

export function ResetarSenhaBtn({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const [estado, setEstado] = React.useState<"idle" | "confirmar" | "loading">("idle");
  const [senha, setSenha] = React.useState<string | null>(null);
  const [copiado, setCopiado] = React.useState(false);

  async function confirmar() {
    setEstado("loading");
    const r = await resetarSenhaUsuario(usuarioId);
    if (r.ok && r.senha) {
      setSenha(r.senha);
      setEstado("idle");
    } else {
      setEstado("idle");
      toast.error("Não foi possível resetar", { description: r.error });
    }
  }

  async function copiar() {
    if (!senha) return;
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não consegui copiar — anote manualmente.");
    }
  }

  // Senha gerada: mostra pro admin repassar. Fica visível até fechar.
  if (senha) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 rounded-md border border-vinculado-600/30 bg-vinculado-50 px-2 py-1">
          <span className="font-mono text-[12px] font-semibold tabular-nums">{senha}</span>
          <button
            type="button"
            onClick={copiar}
            className="text-muted-foreground hover:text-foreground"
            title="Copiar senha"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-vinculado-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            Repasse ao usuário — ele troca no 1º acesso
          </span>
          <button
            type="button"
            onClick={() => setSenha(null)}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (estado === "confirmar") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">Resetar a senha de {nome.split(" ")[0]}?</span>
        <Button variant="brand" size="sm" onClick={confirmar}>
          Confirmar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEstado("idle")}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setEstado("confirmar")}
      disabled={estado === "loading"}
    >
      <KeyRound className="mr-1 h-3.5 w-3.5" />
      {estado === "loading" ? "Resetando..." : "Resetar senha"}
    </Button>
  );
}
