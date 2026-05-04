"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Visão Geral" },
  { slug: "passageiros", label: "Passageiros" },
  { slug: "rooming", label: "Rooming" },
  { slug: "custos", label: "Custos" },
  { slug: "pagamentos", label: "Pagamentos" },
  { slug: "checklist", label: "Checklist" },
  { slug: "documentos", label: "Documentos" },
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
                  "inline-flex items-center px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
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
