"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  expedicoes: "Expedições",
  fornecedores: "Fornecedores",
  cambios: "Câmbios",
  configuracoes: "Configurações",
  passageiros: "Passageiros",
  checklist: "Checklist",
  documentos: "Documentos",
  rooming: "Rooming",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/expedicoes" className="hover:text-foreground transition-colors">
        Início
      </Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const label = SEGMENT_LABELS[seg] ?? decodeURIComponent(seg);
        const isLast = i === segments.length - 1;
        const isId = !SEGMENT_LABELS[seg] && seg.length > 8;
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="text-foreground font-medium">
                {isId ? "Detalhe" : label}
              </span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {isId ? "Detalhe" : label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
