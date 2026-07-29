"use client";
import * as React from "react";
import { Eye } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PointerEventsGuard } from "./PointerEventsGuard";
import type { CurrentUser } from "@/lib/supabase/auth";

export function AppShell({
  user,
  children,
  alertCount = 0,
  inscricoesCount = 0,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
  alertCount?: number;
  inscricoesCount?: number;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // Perfis somente-leitura (relacionamento / leitura): mostram uma faixa e o servidor
  // bloqueia qualquer edição (RLS + guardas). Relacionamento ainda aprova/recusa inscrições.
  const somenteLeitura = user?.papel === "relacionamento" || user?.papel === "leitura";

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <PointerEventsGuard />
      <Sidebar
        user={user}
        alertCount={alertCount}
        inscricoesCount={inscricoesCount}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenu={() => setMobileOpen(true)} />
        {somenteLeitura && (
          <div className="flex items-center gap-2 border-b border-atencao-600/30 bg-atencao-50 px-4 py-1.5 text-[12px] font-medium text-atencao-700">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span>
              Modo leitura — você vê tudo do sistema.
              {user?.papel === "relacionamento" ? " Pode aprovar e recusar inscrições, mas não editar o resto." : " Edições ficam desativadas."}
            </span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="relative min-h-full">
            <div className="incan-pattern pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
            <div className="relative z-10">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
