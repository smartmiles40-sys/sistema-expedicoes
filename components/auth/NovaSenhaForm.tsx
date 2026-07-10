"use client";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { toast } from "sonner";
import { atualizarSenhaConta } from "@/app/conta/actions";

interface Props {
  /** E-mail da conta — exibido como confirmação (read-only) no 1º acesso. */
  email?: string;
  submitLabel?: string;
  redirectTo?: string;
}

export function NovaSenhaForm({ email, submitLabel = "Salvar senha", redirectTo = "/dashboard" }: Props) {
  const [senha, setSenha] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const curta = senha.length > 0 && senha.length < 8;
  const divergem = confirmar.length > 0 && senha !== confirmar;
  const podeEnviar = senha.length >= 8 && senha === confirmar && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setLoading(true);
    const result = await atualizarSenhaConta(senha);
    if (result.ok) {
      toast.success("Senha definida!", { description: "Bem-vindo(a) ao sistema." });
      window.location.assign(redirectTo);
    } else {
      setLoading(false);
      toast.error("Não foi possível salvar", { description: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {email ? (
        <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sua conta</p>
          <p className="text-[14px] font-medium break-all">{email}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Confira se o e-mail está correto. Se não for o seu, fale com a administração.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="senha">Nova senha</Label>
        <Input
          id="senha"
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {curta ? <p className="text-[11px] text-critico-600">Use ao menos 8 caracteres.</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmar">Confirme a nova senha</Label>
        <Input
          id="confirmar"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
        {divergem ? <p className="text-[11px] text-critico-600">As senhas não coincidem.</p> : null}
      </div>

      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={!podeEnviar}>
        {loading ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
