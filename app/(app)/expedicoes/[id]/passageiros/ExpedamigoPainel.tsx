"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Lock, Unlock, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { liberarExpedamigo, bloquearExpedamigo, gerarNovaSenhaProvisoria } from "./expedamigo-actions";

export function ExpedamigoPainel({
  passageiroId,
  expedicaoId,
  cpf,
  liberado: liberadoInicial,
  temHash: temHashInicial,
  senhaProvisoria: provInicial,
}: {
  passageiroId: string;
  expedicaoId: string;
  cpf: string | null;
  liberado: boolean;
  temHash: boolean;
  senhaProvisoria: string | null;
}) {
  const [liberado, setLiberado] = React.useState(liberadoInicial);
  const [temHash, setTemHash] = React.useState(temHashInicial);
  const [prov, setProv] = React.useState<string | null>(provInicial);
  const [busy, setBusy] = React.useState(false);

  async function liberar() {
    setBusy(true);
    const r = await liberarExpedamigo(passageiroId, expedicaoId);
    setBusy(false);
    if (!r.ok) return toast.error("Erro ao liberar", { description: r.error });
    setLiberado(true);
    if (r.jaTemSenha) setTemHash(true);
    if (r.senhaProvisoria) setProv(r.senhaProvisoria);
    toast.success("ExpedAmigo liberado para o passageiro");
  }
  async function bloquear() {
    setBusy(true);
    const r = await bloquearExpedamigo(passageiroId, expedicaoId);
    setBusy(false);
    if (!r.ok) return toast.error("Erro ao bloquear", { description: r.error });
    setLiberado(false);
    toast.success("ExpedAmigo bloqueado nesta expedição");
  }
  async function novaSenha() {
    if (!cpf) return;
    setBusy(true);
    const r = await gerarNovaSenhaProvisoria(cpf, passageiroId, expedicaoId);
    setBusy(false);
    if (!r.ok) return toast.error("Erro ao gerar senha", { description: r.error });
    setTemHash(false);
    setProv(r.senhaProvisoria ?? null);
    toast.success("Nova senha provisória gerada");
  }
  function copiar() {
    if (prov) { navigator.clipboard?.writeText(prov); toast.success("Senha copiada"); }
  }

  return (
    <div className="space-y-3 text-[13px]">
      {/* Liberação desta expedição */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          {liberado ? <Unlock className="h-4 w-4 text-vinculado-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
          {liberado ? "Liberado — aparece no portal do viajante" : "Não liberado — oculto no portal"}
        </span>
        {liberado ? (
          <Button variant="outline" size="sm" onClick={bloquear} disabled={busy}>Bloquear</Button>
        ) : (
          <Button variant="brand" size="sm" onClick={liberar} disabled={busy}>Liberar ExpedAmigo</Button>
        )}
      </div>

      {/* Senha da pessoa (por CPF) */}
      <div className="rounded-md border border-border bg-muted/20 p-2.5">
        <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" /> Senha do ExpedAmigo
        </div>
        {temHash ? (
          <p className="text-muted-foreground">O viajante já criou a própria senha.</p>
        ) : prov ? (
          <div className="flex items-center gap-2">
            <code className="rounded bg-background px-2 py-1 font-mono text-[14px] tracking-wider">{prov}</code>
            <Button variant="outline" size="sm" onClick={copiar}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
            <Button variant="ghost" size="sm" onClick={novaSenha} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> Nova</Button>
          </div>
        ) : (
          <p className="text-muted-foreground">A senha é gerada automaticamente ao liberar.</p>
        )}
        {!temHash && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Repasse ao viajante. No 1º acesso ele troca por uma senha própria e esta some.
          </p>
        )}
      </div>
    </div>
  );
}
