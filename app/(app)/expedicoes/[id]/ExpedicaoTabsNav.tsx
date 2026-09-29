"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Visão Geral" },
  { slug: "passageiros", label: "Passageiros" },
  { slug: "rooming", label: "Rooming" },
  { slug: "checklist", label: "Checklist" },
  { slug: "documentos", label: "Documentos" },
  { slug: "links", label: "Links" },
  { slug: "portal", label: "ExpedAmigo" },
  { slug: "roteiro-lider", label: "Roteiro do Líder" },
];

// Abas escondidas num PACOTE personalizado (não usa rooming/SOP/roteiro de líder de grupo).
const OCULTAS_PACOTE = new Set(["rooming", "checklist", "roteiro-lider"]);

export function ExpedicaoTabsNav({
  expedicaoId,
  tipo = "expedicao",
}: {
  expedicaoId: string;
  tipo?: "expedicao" | "pacote";
}) {
  const pathname = usePathname();
  const base = `/expedicoes/${expedicaoId}`;
  const tabs = tipo === "pacote" ? TABS.filter((t) => !OCULTAS_PACOTE.has(t.slug)) : TABS;

  return (
    <nav className="border-b border-border bg-background px-4">
      <ul className="flex items-center gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const isActive = tab.slug ? pathname.endsWith(`/${tab.slug}`) : pathname === base;
          return (
            <li key={tab.slug}>
              <Link
                href={href}
                className={cn(
                  "inline-flex items-center px-3.5 py-2.5 text-[13px] whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-[var(--brand-lime-deep)] text-foreground font-semibold"
                    : "border-transparent font-medium text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
