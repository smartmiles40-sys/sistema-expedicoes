import { CompassIcon } from "lucide-react";
import { entrar } from "./actions";

export default async function AcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const erro = sp?.erro === "1";
  const next = sp?.next ?? "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-dark)] text-[var(--brand-lime)]">
            <CompassIcon className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-base font-semibold">Sistema Operacional de Expedições</h1>
            <p className="text-xs text-muted-foreground mt-1">Se Tu For, Eu Vou</p>
          </div>
        </div>

        <form action={entrar} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1">
            <label htmlFor="senha" className="text-[13px] font-medium">
              Senha de acesso
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoFocus
              required
              placeholder="Digite a senha"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
            />
          </div>

          {erro && (
            <p className="text-[12px] text-critico-600">Senha incorreta. Tente de novo.</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-foreground text-background py-2 text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Entrar
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Acesso restrito à equipe.
        </p>
      </div>
    </div>
  );
}
