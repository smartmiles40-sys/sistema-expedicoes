"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Users,
  Map,
  Building2,
  Coins,
  Settings,
  CompassIcon,
  LayoutDashboard,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/supabase/auth";
import { UserMenu } from "./UserMenu";

const NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
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
  mobileOpen = false,
  onClose,
}: {
  user: CurrentUser | null;
  alertCount?: number;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop só no mobile, quando aberto */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          "bg-brand-gradient flex w-[244px] shrink-0 flex-col border-r border-white/10 text-white",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:pointer-events-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)] shadow-sm">
            <CompassIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-[16px] font-semibold leading-none text-white">Se Tu For, Eu Vou</span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-[var(--brand-lime)]/70">Sistema Operacional</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="ml-auto text-white/60 transition-colors hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2.5">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-[var(--brand-lime)] font-semibold text-[var(--brand-dark)] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
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
      <div className="border-t border-white/10 p-2.5">
        <UserMenu user={user} onDark />
      </div>
      </aside>
    </>
  );
}
