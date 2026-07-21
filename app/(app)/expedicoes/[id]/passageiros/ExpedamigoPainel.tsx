"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Lock, Unlock, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mascaraCpf } from "@/lib/cpf";
import {
  liberarExpedamigo,
  bloquearExpedamigo,
  gerarNovaSenhaCpf,
  estadoExpedamigoPax,
} from "./expedamigo-actions";

/** Copia "Login: <cpf>\nSenha: <senha>" pra área de transferência. */
export function copiarLoginSenha(cpf: string | null, senha: string) {
  const texto = `Login: ${cpf ? mascaraCpf(cpf) : "—"}\nSenha: ${senha}`;
  navigator.clipboard?.writeText(texto);
  toast.success("Login e senha copiados");
}

export function ExpedamigoPainel({ passageiroId, expedicaoId }: { passageiroId: string; expedicaoId: string }) {
  const [carregando, setCarregando] = React.useState(true);
  const [admin, setAdmin] = React.useState(false);
  const [cpf, setCpf] = React.useState<string | null>(null);
  const [liberado, setLiberado] = React.useState(false);
  const [temHash, setTemHash] = React.useState(false);
  const [prov, setProv] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    estadoExpedamigoPax(passageiroId).then((s) => {
      if (!vivo) return;
      setAdmin(s.admin); setCpf(s.cpf); setLiberado(s.liberado); setTemHash(s.temHash); setProv(s.senhaProvisoria);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [passageiroId]);

  if (carregando || !admin) return null;

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
    const r = await gerarNovaSenhaCpf(cpf);
    setBusy(false);
    if (!r.ok) return toast.error("Erro ao gerar senha", { description: r.error });
    setTemHash(false);
    setProv(r.senhaProvisoria ?? null);
    toast.success("Nova senha provisória gerada");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-[13px]">
      <h3 className="text-sm font-semibold">ExpedAmigo (portal do viajante)</h3>

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

      <div className="rounded-md border border-border bg-muted/20 p-2.5">
        <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" /> Senha do ExpedAmigo
        </div>
        {temHash ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">O viajante já criou a própria senha.</p>
            <Button variant="outline" size="sm" onClick={novaSenha} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> Resetar senha</Button>
            <p className="text-[11px] text-muted-foreground">Gera uma nova senha provisória e faz a pessoa voltar ao 1º acesso.</p>
          </div>
        ) : prov ? (
          <>
            <div className="space-y-0.5 font-mono text-[13px]">
              <div>Login: <span className="tracking-wider">{cpf ? mascaraCpf(cpf) : "—"}</span></div>
              <div>Senha: <span className="tracking-wider">{prov}</span></div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => copiarLoginSenha(cpf, prov)}><Copy className="h-3.5 w-3.5" /> Copiar login e senha</Button>
              <Button variant="ghost" size="sm" onClick={novaSenha} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> Nova</Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Repasse ao viajante. No 1º acesso ele troca por uma senha própria e esta some.</p>
          </>
        ) : (
          <p className="text-muted-foreground">A senha é gerada automaticamente ao liberar.</p>
        )}
      </div>
    </div>
  );
}
