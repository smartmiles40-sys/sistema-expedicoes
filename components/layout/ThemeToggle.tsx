"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Botão de alternância claro/escuro. Usa a paleta de portal (`--portal-*`), que
 * responde ao tema, então o botão fica visível tanto no claro quanto no escuro.
 * Usado no ExpedAmigo (/amigo) e na Área do Líder (/lider).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-opacity hover:opacity-75",
        "border-[var(--portal-border)] bg-[var(--portal-panel)] text-[var(--portal-fg)]",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
