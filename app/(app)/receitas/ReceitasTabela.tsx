"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pill, Check, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import { useSomenteLeitura } from "@/components/layout/PermissoesContext";
import { marcarReceitaEnviada, type ReceitaPendente } from "./actions";

const DIAS_ALVO = 20;

/** Situação pela proximidade do embarque. */
function situacao(dias: number | null): { label: string; variant: "critico" | "atencao" | "lista" } {
  if (dias == null) return { label: "Sem data de embarque", variant: "lista" };
  if (dias <= DIAS_ALVO) return { label: `Emitir agora · ${dias}d pro embarque`, variant: dias <= 10 ? "critico" : "atencao" };
  return { label: `Faltam ${dias} dias`, variant: "lista" };
}

export function ReceitasTabela({ itens }: { itens: ReceitaPendente[] }) {
  const router = useRouter();
  const somenteLeitura = useSomenteLeitura();
  const [busca, setBusca] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((r) => r.nome.toLowerCase().includes(q) || r.expedicao_nome.toLowerCase().includes(q) || (r.cpf ?? "").includes(q));
  }, [itens, busca]);

  const urgentes = itens.filter((r) => r.dias_ate_embarque != null && r.dias_ate_embarque <= DIAS_ALVO).length;

  async function enviada(r: ReceitaPendente) {
    setBusy(r.passageiro_id);
    const res = await marcarReceitaEnviada(r.passageiro_id);
    setBusy(null);
    if (res.ok) { toast.success(`Receita de ${r.nome} marcada como enviada`); router.refresh(); }
    else toast.error("Erro", { description: res.error });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Pill className="h-4 w-4 text-editavel-600" /> Receitas pendentes
          {itens.length > 0 && <Badge variant="lista">{itens.length}</Badge>}
          {urgentes > 0 && <Badge variant="atencao">{urgentes} na hora</Badge>}
        </h1>
        <p className="text-xs text-muted-foreground">
          Passageiros que precisam de receita médica. A meta é emitir e enviar até ~{DIAS_ALVO} dias antes do embarque.
        </p>
      </div>

      {itens.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, expedição ou CPF…"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
          />
        </div>
      )}

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-[13px] text-muted-foreground">
          {itens.length === 0 ? "Nenhuma receita pendente. 🎉" : "Nada encontrado para a busca."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Passageiro</th>
                <th className="px-3 py-2 font-semibold">Expedição</th>
                <th className="px-3 py-2 font-semibold">Embarque</th>
                <th className="px-3 py-2 font-semibold">Emitir até</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const s = situacao(r.dias_ate_embarque);
                return (
                  <tr key={r.passageiro_id} className="border-t border-border/60 hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.nome}</div>
                      <div className="text-[11px] text-muted-foreground">{r.cpf ?? "—"}{r.telefone ? ` · ${r.telefone}` : ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/expedicoes/${r.expedicao_id}/passageiros`} className="inline-flex items-center gap-1 text-editavel-700 hover:underline">
                        {r.expedicao_nome} <ExternalLink className="h-3 w-3" />
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{r.destino}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.data_embarque ? formatDate(r.data_embarque) : "—"}</td>
                    <td className={cn("px-3 py-2 whitespace-nowrap", s.variant === "critico" && "font-semibold text-critico-700", s.variant === "atencao" && "font-medium text-atencao-700")}>
                      {r.data_limite ? formatDate(r.data_limite) : "—"}
                    </td>
                    <td className="px-3 py-2"><Badge variant={s.variant}>{s.label}</Badge></td>
                    <td className="px-3 py-2 text-right">
                      {!somenteLeitura && (
                        <Button size="sm" variant="brand" onClick={() => enviada(r)} disabled={busy === r.passageiro_id}>
                          <Check className="h-3.5 w-3.5" /> Marcar enviada
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
