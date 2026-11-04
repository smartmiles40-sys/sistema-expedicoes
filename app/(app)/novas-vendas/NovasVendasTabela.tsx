"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, CheckCheck, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { useSomenteLeitura } from "@/components/layout/PermissoesContext";
import { marcarVendaVista, marcarTodasVendasVistas, type NovaVenda } from "./actions";

/** Cor do badge por status da reserva. */
function statusVariant(status: string): "vinculado" | "lista" | "atencao" {
  if (status === "Confirmado") return "vinculado";
  if (status === "Pré-reserva") return "lista";
  return "atencao";
}

export function NovasVendasTabela({ itens }: { itens: NovaVenda[] }) {
  const router = useRouter();
  const somenteLeitura = useSomenteLeitura();
  const [busca, setBusca] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((r) => r.nome.toLowerCase().includes(q) || r.expedicao_nome.toLowerCase().includes(q) || (r.cpf ?? "").includes(q));
  }, [itens, busca]);

  async function vista(r: NovaVenda) {
    setBusy(r.passageiro_id);
    const res = await marcarVendaVista(r.passageiro_id);
    setBusy(null);
    if (res.ok) { toast.success(`${r.nome} marcada como vista`); router.refresh(); }
    else toast.error("Erro", { description: res.error });
  }
  async function todasVistas() {
    setBusy("__todas__");
    const res = await marcarTodasVendasVistas();
    setBusy(null);
    if (res.ok) { toast.success("Todas as novas vendas foram marcadas como vistas"); router.refresh(); }
    else toast.error("Erro", { description: res.error });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-vinculado-600" /> Novas vendas
            {itens.length > 0 && <Badge variant="vinculado">{itens.length}</Badge>}
          </h1>
          <p className="text-xs text-muted-foreground">
            Passageiros que entraram novos pela sincronização do Bitrix. Triar e marcar como vistos.
          </p>
        </div>
        {!somenteLeitura && itens.length > 0 && (
          <Button size="sm" variant="outline" onClick={todasVistas} disabled={busy === "__todas__"}>
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas vistas
          </Button>
        )}
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
          {itens.length === 0 ? "Nenhuma venda nova por enquanto. 🎉" : "Nada encontrado para a busca."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Passageiro</th>
                <th className="px-3 py-2 font-semibold">Expedição</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Entrou em</th>
                <th className="px-3 py-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
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
                  <td className="px-3 py-2"><Badge variant={statusVariant(r.status_reserva)}>{r.status_reserva}</Badge></td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.entrou_em ? formatDate(r.entrou_em) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {!somenteLeitura && (
                      <Button size="sm" variant="brand" onClick={() => vista(r)} disabled={busy === r.passageiro_id}>
                        <Check className="h-3.5 w-3.5" /> Marcar vista
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
