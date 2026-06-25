"use client";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { toast } from "sonner";
import { entrarComSenha } from "./actions";

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await entrarComSenha(email, senha);
    if (result.ok) {
      // Recarrega no servidor pra a sessão (cookie) ser lida pelo layout.
      window.location.assign("/expedicoes");
    } else {
      setLoading(false);
      toast.error("Não foi possível entrar", { description: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
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
      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Use o e-mail e a senha fornecidos pela administração.
      </p>
    </form>
  );
}
