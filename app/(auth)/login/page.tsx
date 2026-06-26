import Link from "next/link";
import { ArrowRight, Briefcase, CompassIcon, Crown } from "lucide-react";

export default function EntrarPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)]">
            <CompassIcon className="h-5 w-5" />
          </div>
          <span className="font-display text-[18px] font-semibold text-[var(--brand-lime)]">Se Tu For, Eu Vou</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] text-white">
            Organize cada expedição,
            <br />
            <span className="text-[var(--brand-lime)]">do sonho ao embarque.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Passageiros, prontidão, rooming e prazos — tudo num lugar só, do jeito da agência.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/40">Se Tu For, Eu Vou · Sistema de Expedições</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-lime)] opacity-[0.07] blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="page-title">Bem-vindo</h1>
          <p className="page-subtitle mt-1 mb-6">Como você quer entrar?</p>

          <div className="space-y-3">
            <Link
              href="/login/operacional"
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-dark)] text-[var(--brand-lime)]">
                <Briefcase className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Operacional</span>
                <span className="block text-[12px] text-muted-foreground">Equipe da agência — login com e-mail e senha</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/lider"
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)]">
                <Crown className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Área do Líder</span>
                <span className="block text-[12px] text-muted-foreground">Acompanhe suas expedições com o CPF</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
