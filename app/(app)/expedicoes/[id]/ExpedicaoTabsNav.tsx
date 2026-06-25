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
];

export function ExpedicaoTabsNav({ expedicaoId }: { expedicaoId: string }) {
  const pathname = usePathname();
  const base = `/expedicoes/${expedicaoId}`;

  return (
    <nav className="border-b border-border bg-background px-4">
      <ul className="flex items-center gap-0 overflow-x-auto">
        {TABS.map((tab) => {
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
