"use client";
import * as React from "react";
import { ScrollText, Search, LogIn, FileDown, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { StatPill } from "@/components/ui/StatPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatarCpf } from "@/lib/cpf";

export type AcessoLog = {
  id: string;
  cpf: string;
  nome: string | null;
  evento: "login" | "download_pdf" | "viagem_aberta";
  expedicao_nome: string | null;
  created_at: string;
};

const EVENTOS: { chave: AcessoLog["evento"]; label: string; variant: "lista" | "vinculado" | "atencao"; Icon: typeof LogIn }[] = [
  { chave: "login", label: "Login", variant: "lista", Icon: LogIn },
  { chave: "viagem_aberta", label: "Abriu viagem", variant: "atencao", Icon: BookOpen },
  { chave: "download_pdf", label: "Baixou PDF", variant: "vinculado", Icon: FileDown },
];
const EVENTO_META = new Map(EVENTOS.map((e) => [e.chave, e]));

function dataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AcessosTabela({ rows }: { rows: AcessoLog[] }) {
  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState<AcessoLog["evento"] | null>(null);

  const filtrados = rows.filter((r) => {
    if (filtro && r.evento !== filtro) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const hay = `${r.nome ?? ""} ${r.cpf} ${r.expedicao_nome ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <ScrollText className="h-4 w-4 text-editavel-600" /> Acessos ao ExpedAmigo
        </h1>
        <p className="text-xs text-muted-foreground">
          Registro de quem entrou no portal, abriu uma viagem e baixou o PDF. Só CPF, evento e data/hora (sem IP/dispositivo).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF ou expedição…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-72 pl-7" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Evento:</span>
          <button
            type="button"
            onClick={() => setFiltro(null)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
              filtro === null ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Todos
          </button>
          {EVENTOS.map((e) => (
            <button
              key={e.chave}
              type="button"
              onClick={() => setFiltro((f) => (f === e.chave ? null : e.chave))}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                filtro === e.chave ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatPill label="Total" value={rows.length} />
        {EVENTOS.map((e) => (
          <StatPill key={e.chave} label={e.label} value={rows.filter((r) => r.evento === e.chave).length} variant={e.variant} />
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20">
          <EmptyState icon={ScrollText} title="Nenhum acesso registrado ainda" description="Assim que os viajantes começarem a usar o portal, os acessos aparecem aqui." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Data / hora</Th>
                  <Th>Pessoa</Th>
                  <Th>Evento</Th>
                  <Th>Expedição</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[12px] text-muted-foreground">Nenhum acesso no filtro atual.</td>
                  </tr>
                ) : (
                  filtrados.map((r) => {
                    const meta = EVENTO_META.get(r.evento)!;
                    const Icon = meta.Icon;
                    return (
                      <tr key={r.id} className="border-b border-border hover:bg-accent/30">
                        <td className="whitespace-nowrap px-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">{dataHora(r.created_at)}</td>
                        <td className="px-2.5">
                          <div className="font-medium">{r.nome ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground">{formatarCpf(r.cpf)}</div>
                        </td>
                        <td className="px-2.5">
                          <Badge variant={meta.variant}><Icon className="mr-0.5 h-3 w-3" /> {meta.label}</Badge>
                        </td>
                        <td className="px-2.5 text-muted-foreground">{r.expedicao_nome ?? "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="whitespace-nowrap px-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>;
}
