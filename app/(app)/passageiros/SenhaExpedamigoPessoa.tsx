"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Link2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { copiarTexto } from "@/app/(app)/expedicoes/[id]/passageiros/ExpedamigoPainel";
import { estadoSenhaCpf, gerarLinkAcessoCpf, resetarAcessoCpf } from "@/app/(app)/expedicoes/[id]/passageiros/expedamigo-actions";

/** Acesso ao ExpedAmigo da PESSOA (por CPF) — no perfil global. Só admin. Via link mágico. */
export function SenhaExpedamigoPessoa({ cpf }: { cpf: string | null }) {
  const [carregando, setCarregando] = React.useState(Boolean(cpf));
  const [admin, setAdmin] = React.useState(false);
  const [temHash, setTemHash] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!cpf) return;
    let vivo = true;
    estadoSenhaCpf(cpf).then((s) => {
      if (!vivo) return;
      setAdmin(s.admin); setTemHash(s.temHash);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [cpf]);

  if (carregando || !admin) return null;

  async function gerarLink() {
    if (!cpf) return;
    setBusy(true);
    const r = await gerarLinkAcessoCpf(cpf);
    setBusy(false);
    if (!r.ok || !r.link) return toast.error("Erro ao gerar link", { description: r.error });
    setLink(r.link); setMensagem(r.mensagem ?? r.link);
    toast.success("Link de acesso gerado");
  }
  async function resetar() {
    if (!cpf) return;
    setBusy(true);
    const r = await resetarAcessoCpf(cpf);
    setBusy(false);
    if (!r.ok || !r.link) return toast.error("Erro ao resetar", { description: r.error });
    setTemHash(false); setLink(r.link); setMensagem(r.mensagem ?? r.link);
    toast.success("Acesso resetado — senha anterior invalidada; novo link gerado");
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[13px]">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5" /> Acesso ao ExpedAmigo
      </div>
      {temHash ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground">O viajante já criou a própria senha.</p>
          <Button variant="outline" size="sm" onClick={resetar} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> Resetar acesso</Button>
          <p className="text-[11px] text-muted-foreground">Invalida a senha atual na hora e gera um novo link mágico.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-muted-foreground">Gere o link mágico de acesso pra repassar ao viajante.</p>
          <Button variant="outline" size="sm" onClick={gerarLink} disabled={busy}>
            <Link2 className="h-3.5 w-3.5" /> {link ? "Gerar novo link" : "Gerar link de acesso"}
          </Button>
        </div>
      )}
      {link && (
        <div className="mt-2 space-y-1.5">
          <div className="break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]">{link}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => copiarTexto(link, "Link copiado")}><Link2 className="h-3.5 w-3.5" /> Copiar link</Button>
            {mensagem && mensagem !== link && (
              <Button variant="ghost" size="sm" onClick={() => copiarTexto(mensagem, "Mensagem copiada")}><MessageSquare className="h-3.5 w-3.5" /> Copiar mensagem</Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Válido por 30 dias. Ao abrir, o viajante cria a própria senha.</p>
        </div>
      )}
    </div>
  );
}
