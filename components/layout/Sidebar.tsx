"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  Users,
  Map,
  Building2,
  Coins,
  Settings,
  CompassIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/supabase/auth";
import { UserMenu } from "./UserMenu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/avisos", label: "Avisos", icon: Bell },
  { href: "/passageiros", label: "Passageiros", icon: Users },
  { href: "/expedicoes", label: "Expedições", icon: Map },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/cambios", label: "Câmbios", icon: Coins },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({
  user,
  alertCount = 0,
}: {
  user: CurrentUser | null;
  alertCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand-dark)] text-[var(--brand-lime)]">
          <CompassIcon className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[12px] font-semibold tracking-tight">Se Tu For, Eu Vou</span>
          <span className="text-[10px] text-muted-foreground">Sistema Operacional</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/avisos" && alertCount > 0 && (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-critico-600 px-1.5 text-[10px] font-semibold leading-none text-white">
                      {alertCount > 99 ? "99+" : alertCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User menu rodapé */}
      <div className="border-t border-border p-2">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
