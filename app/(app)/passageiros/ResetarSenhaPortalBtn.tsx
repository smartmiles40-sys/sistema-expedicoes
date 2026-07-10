"use client";
import * as React from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { resetarSenhaPortal } from "./actions";

/**
 * Botão (admin) que reseta o acesso ao portal (ExpedAmigo / Líder) de uma pessoa.
 * Some se a pessoa não tem CPF (o acesso é por CPF).
 */
export function ResetarSenhaPortalBtn({ cpf, nome }: { cpf: string | null; nome: string }) {
  const [estado, setEstado] = React.useState<"idle" | "confirmar" | "loading">("idle");
  const semCpf = !cpf || cpf.replace(/\D/g, "").length !== 11;

  async function confirmar() {
    setEstado("loading");
    const r = await resetarSenhaPortal(cpf ?? "");
    setEstado("idle");
    if (r.ok) {
      toast.success("Acesso ao portal resetado", {
        description: r.tinhaSenha
          ? `${nome.split(" ")[0]} volta ao 1º acesso: entra com a data de nascimento e cria uma nova senha.`
          : "Não havia senha definida — a pessoa já entra pela data de nascimento.",
      });
    } else {
      toast.error("Não foi possível resetar", { description: r.error });
    }
  }

  if (semCpf) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Sem CPF cadastrado — o acesso ao portal (por CPF) não se aplica.
      </p>
    );
  }

  if (estado === "confirmar") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">Resetar o acesso de {nome.split(" ")[0]}?</span>
        <Button type="button" variant="brand" size="sm" onClick={confirmar}>
          Confirmar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEstado("idle")}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setEstado("confirmar")}
      disabled={estado === "loading"}
    >
      <KeyRound className="mr-1 h-3.5 w-3.5" />
      {estado === "loading" ? "Resetando..." : "Resetar senha do portal"}
    </Button>
  );
}
