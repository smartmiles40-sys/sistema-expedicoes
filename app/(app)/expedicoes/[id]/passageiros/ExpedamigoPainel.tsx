"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Lock, Unlock, RefreshCw, Copy, Link2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  liberarExpedamigo,
  bloquearExpedamigo,
  resetarAcessoExpedamigo,
  gerarLinkAcessoExpedamigo,
  estadoExpedamigoPax,
} from "./expedamigo-actions";

/** Copia um texto pra área de transferência com toast. */
export function copiarTexto(texto: string, msg = "Copiado") {
  navigator.clipboard?.writeText(texto).then(() => toast.success(msg)).catch(() => {});
}

/** Caixa com o link mágico gerado + botões de copiar (link ou mensagem de WhatsApp). */
function LinkBox({ link, mensagem }: { link: string; mensagem: string | null }) {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]">{link}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => copiarTexto(link, "Link copiado")}>
          <Link2 className="h-3.5 w-3.5" /> Copiar link
        </Button>
        {mensagem && mensagem !== link && (
          <Button variant="ghost" size="sm" onClick={() => copiarTexto(mensagem, "Mensagem copiada")}>
            <MessageSquare className="h-3.5 w-3.5" /> Copiar mensagem
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Repasse o link ao viajante. Ao abrir, ele cria a própria senha e entra (válido por 30 dias).</p>
    </div>
  );
}

export function ExpedamigoPainel({ passageiroId, expedicaoId }: { passageiroId: string; expedicaoId: string }) {
  const [carregando, setCarregando] = React.useState(true);
  const [admin, setAdmin] = React.useState(false);
  const [liberado, setLiberado] = React.useState(false);
  const [temHash, setTemHash] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    estadoExpedamigoPax(passageiroId).then((s) => {
      if (!vivo) return;
      setAdmin(s.admin); setLiberado(s.liberado); setTemHash(s.temHash);
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
    setLiberado(true); setTemHash(r.jaTemSenha); setLink(r.link); setMensagem(r.mensagem);
    toast.success("ExpedAmigo liberado — link de acesso gerado");
  }
  async function bloquear() {
    setBusy(true);
    const r = await bloquearExpedamigo(passageiroId, expedicaoId);
    setBusy(false);
    if (!r.ok) return toast.error("Erro ao bloquear", { description: r.error });
    setLiberado(false); setLink(null); setMensagem(null);
    toast.success("ExpedAmigo bloqueado nesta expedição");
  }
  async function gerarLink() {
    setBusy(true);
    const r = await gerarLinkAcessoExpedamigo(passageiroId);
    setBusy(false);
    if (!r.ok || !r.link) return toast.error("Erro ao gerar link", { description: r.error });
    setLink(r.link); setMensagem(r.mensagem ?? r.link);
    toast.success("Link de acesso gerado");
  }
  async function resetar() {
    setBusy(true);
    const r = await resetarAcessoExpedamigo(passageiroId, expedicaoId);
    setBusy(false);
    if (!r.ok || !r.link) return toast.error("Erro ao resetar", { description: r.error });
    setTemHash(false); setLink(r.link); setMensagem(r.mensagem ?? r.link);
    toast.success("Acesso resetado — senha anterior invalidada; novo link gerado");
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
          <KeyRound className="h-3.5 w-3.5" /> Acesso ao portal
        </div>
        {!liberado ? (
          <p className="text-muted-foreground">Libere o ExpedAmigo para gerar o link de acesso do viajante.</p>
        ) : temHash ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">O viajante já criou a própria senha.</p>
            <Button variant="outline" size="sm" onClick={resetar} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> Resetar acesso</Button>
            <p className="text-[11px] text-muted-foreground">Invalida a senha atual na hora e gera um novo link mágico pra ele criar outra.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">Gere o link mágico de 1º acesso e repasse ao viajante.</p>
            <Button variant="outline" size="sm" onClick={gerarLink} disabled={busy}>
              <Link2 className="h-3.5 w-3.5" /> {link ? "Gerar novo link" : "Gerar link de acesso"}
            </Button>
          </div>
        )}
        {link && <LinkBox link={link} mensagem={mensagem} />}
      </div>
    </div>
  );
}
