"use client";
import { LogOut, Moon, Sun, ChevronUp } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "./ThemeProvider";
import type { CurrentUser } from "@/lib/supabase/auth";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  operacional: "Operacional",
  comercial: "Comercial",
  financeiro: "Financeiro",
  leitura: "Leitura",
};

export function UserMenu({ user }: { user: CurrentUser | null }) {
  const { theme, toggle } = useTheme();

  if (!user) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar nome={user.nome} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate">{user.nome}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {PAPEL_LABEL[user.papel] ?? user.papel}
          </div>
        </div>
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side="top"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-md border border-border bg-background shadow-md p-1"
        >
          <div className="px-2 py-1.5 border-b border-border mb-1">
            <div className="text-xs font-medium">{user.nome}</div>
            <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
          </div>
          <DropdownMenu.Item
            className="flex items-center gap-2 px-2 py-1.5 text-[13px] rounded-sm hover:bg-accent outline-none cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              toggle();
            }}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-3.5 w-3.5" /> Modo escuro
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5" /> Modo claro
              </>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <DropdownMenu.Item
            className="flex items-center gap-2 px-2 py-1.5 text-[13px] rounded-sm hover:bg-accent outline-none cursor-pointer text-critico-600"
            onSelect={() => {
              // signout via server action — em dev bypass apenas redirect
              fetch("/api/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
