"use client";
import * as React from "react";
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
      </div>
    </div>
  );
}
