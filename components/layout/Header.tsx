"use client";
import { Bell, Search } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <Breadcrumb />
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
      </div>
    </header>
  );
}
