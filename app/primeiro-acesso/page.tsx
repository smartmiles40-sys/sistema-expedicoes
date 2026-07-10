import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { Logo } from "@/components/ui/Logo";
import { NovaSenhaForm } from "@/components/auth/NovaSenhaForm";

export default async function PrimeiroAcessoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Quem já definiu a própria senha não passa por aqui.
  if (!user.senha_provisoria) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <Logo tone="dark" className="h-7 w-auto" />
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] text-white">
            Bem-vindo(a) à equipe.
            <br />
            <span className="text-[var(--brand-lime)]">Vamos proteger sua conta.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Sua conta foi criada com uma senha provisória. Defina agora uma senha só sua
            para começar a usar o sistema.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/40">Se Tu For, Eu Vou · Primeiro acesso</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-lime)] opacity-[0.07] blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="page-title">Defina sua senha</h1>
          <p className="page-subtitle mt-1 mb-6">
            Só precisa fazer isso uma vez. Depois é só entrar normalmente.
          </p>
          <NovaSenhaForm email={user.email} submitLabel="Salvar e entrar" redirectTo="/dashboard" />
        </div>
      </div>
    </div>
  );
}
