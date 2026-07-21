"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mascaraCpf } from "@/lib/cpf";
import { copiarLoginSenha } from "@/app/(app)/expedicoes/[id]/passageiros/ExpedamigoPainel";
import { estadoSenhaCpf, gerarNovaSenhaCpf } from "@/app/(app)/expedicoes/[id]/passageiros/expedamigo-actions";

/** Senha do ExpedAmigo da PESSOA (por CPF) — no perfil global. Só admin. */
export function SenhaExpedamigoPessoa({ cpf }: { cpf: string | null }) {
  const [carregando, setCarregando] = React.useState(Boolean(cpf));
  const [admin, setAdmin] = React.useState(false);
  const [temHash, setTemHash] = React.useState(false);
  const [prov, setProv] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!cpf) return;
    let vivo = true;
    estadoSenhaCpf(cpf).then((s) => {
      if (!vivo) return;
      setAdmin(s.admin); setTemHash(s.temHash); setProv(s.senhaProvisoria);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [cpf]);

  if (carregando || !admin) return null;

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
    <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[13px]">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5" /> Senha do ExpedAmigo
      </div>
      {temHash ? (
        <p className="text-muted-foreground">O viajante já criou a própria senha.</p>
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
        </>
      ) : (
        <p className="text-muted-foreground">Libere o ExpedAmigo na página do passageiro (dentro da expedição) para gerar a senha.</p>
      )}
    </div>
  );
}
