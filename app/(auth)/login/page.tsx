import { redirect } from "next/navigation";
import { CompassIcon } from "lucide-react";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (DEV_BYPASS) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-dark)] text-[var(--brand-lime)]">
            <CompassIcon className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-base font-semibold">Sistema Operacional de Expedições</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Se Tu For, Eu Vou
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
