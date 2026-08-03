"use client";
import * as React from "react";
import { ChevronDown, ClipboardList, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDateTime, cn } from "@/lib/utils";
import type { DecisaoInscricao, AcaoInscricao } from "./decisoes";

const ACAO_VARIANT: Record<AcaoInscricao, "vinculado" | "critico" | "lista" | "auto"> = {
  aprovada: "vinculado",
  recusada: "critico",
  restaurada: "lista",
  excluida: "auto",
};
const ACAO_LABEL: Record<AcaoInscricao, string> = {
  aprovada: "Aprovada",
  recusada: "Recusada",
  restaurada: "Restaurada",
  excluida: "Excluída",
};

/**
 * Log de decisões sobre inscrições (aprovou/recusou/restaurou/excluiu). Renderizado
 * só para admin (a página gate). Recolhível, com busca por nome/CPF/quem decidiu.
 */
export function DecisoesLog({ decisoes }: { decisoes: DecisaoInscricao[] }) {
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState("");

  const termo = busca.trim().toLowerCase();
  const filtradas = React.useMemo(() => {
    if (!termo) return decisoes;
    return decisoes.filter((d) =>
      [d.nome_completo, d.cpf, d.decidido_por_nome, d.expedicao_nome, ACAO_LABEL[d.acao]]
        .filter(Boolean).join(" ").toLowerCase().includes(termo),
    );
  }, [decisoes, termo]);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <span className="text-[14px] font-semibold">Log de decisões</span>
        <Badge variant="auto">{decisoes.length}</Badge>
        <span className="text-[11px] text-muted-foreground">quem aprovou, recusou, restaurou ou excluiu</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF, quem decidiu…"
              className="pl-7"
            />
          </div>

          {filtradas.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              {decisoes.length === 0 ? "Nenhuma decisão registrada ainda." : "Nenhum resultado para a busca."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full table-dense">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <Th>Quando</Th>
                    <Th>Ação</Th>
                    <Th>Passageiro</Th>
                    <Th>CPF</Th>
                    <Th>Expedição</Th>
                    <Th>Quem decidiu</Th>
                    <Th>Motivo</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d) => (
                    <tr key={d.id} className="border-b border-border hover:bg-accent/30">
                      <td className="whitespace-nowrap px-2.5 text-[12px] text-muted-foreground tabular-nums">{formatDateTime(d.created_at)}</td>
                      <td className="px-2.5"><Badge variant={ACAO_VARIANT[d.acao]}>{ACAO_LABEL[d.acao]}</Badge></td>
                      <td className="px-2.5 font-medium">{d.nome_completo ?? "—"}</td>
                      <td className="px-2.5 font-mono text-[12px] tabular-nums text-muted-foreground">{d.cpf ?? "—"}</td>
                      <td className="px-2.5 text-[12px] text-muted-foreground">{d.expedicao_nome ?? "—"}</td>
                      <td className="px-2.5 text-[12px]">{d.decidido_por_nome ?? "—"}</td>
                      <td className="px-2.5 text-[12px] text-muted-foreground max-w-[280px]">
                        <span className="line-clamp-2">{d.motivo ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}
