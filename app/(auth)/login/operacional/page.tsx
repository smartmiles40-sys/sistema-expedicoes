import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CompassIcon } from "lucide-react";
import { DEV_AUTH_BYPASS } from "@/lib/dev-mode";
import { LoginForm } from "../LoginForm";

export default async function OperacionalPage() {
  if (DEV_AUTH_BYPASS) {
    redirect("/expedicoes");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
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
            Passageiros, prontidão, rooming, prazos e câmbios — tudo num lugar só, do jeito da agência.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/40">Sistema Operacional · uso interno da equipe</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-lime)] opacity-[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[var(--brand-lime)] opacity-[0.05] blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/login" className="mb-6 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <h1 className="page-title">Bem-vindo de volta</h1>
          <p className="page-subtitle mt-1 mb-6">Entre para acessar o painel da agência.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
