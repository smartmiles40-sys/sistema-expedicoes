import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { CurrentUser } from "@/lib/supabase/auth";

export function AppShell({
  user,
  children,
  alertCount = 0,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
  alertCount?: number;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar user={user} alertCount={alertCount} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
