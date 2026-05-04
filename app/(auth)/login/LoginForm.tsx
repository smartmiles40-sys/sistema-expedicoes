"use client";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { toast } from "sonner";
import { sendMagicLink } from "./actions";

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await sendMagicLink(email);
    setLoading(false);
    if (result.ok) {
      setSent(true);
      toast.success("Link enviado", { description: "Verifique seu email." });
    } else {
      toast.error("Erro", { description: result.error });
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm">
          Enviamos um link de acesso pra <strong>{email}</strong>.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          O link expira em 1 hora. Verifique também o spam.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-xs text-editavel-600 hover:underline mt-3"
        >
          Tentar com outro email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link de acesso"}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Vamos enviar um link mágico — sem senha.
      </p>
    </form>
  );
}
