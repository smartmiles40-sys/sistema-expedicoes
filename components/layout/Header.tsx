"use client";
import { Bell, Search, Menu, LogOut } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";

export function Header({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Abrir menu"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Breadcrumb />
      </div>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
          onClick={() => {
            // dispatch global pra abrir command palette (P6)
            const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            window.dispatchEvent(evt);
          }}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-border bg-muted px-1 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>
        <button
          className="relative flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Notificações"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-critico-600" />
        </button>
        <button
          type="button"
          onClick={() => {
            fetch("/api/logout", { method: "POST" }).finally(() => {
              window.location.href = "/login";
            });
          }}
          title="Sair"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
