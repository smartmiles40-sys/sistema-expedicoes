import { notFound } from "next/navigation";
import {
  getExpedicaoComAgregados,
  listPassageiros,
  listCustos,
  listPagamentos,
  listDocumentos,
} from "@/lib/data/expedicoes";
import { ExpedicaoHeader } from "./ExpedicaoHeader";
import { ExpedicaoTabsNav } from "./ExpedicaoTabsNav";
import { ExpedicaoRealtimeSync } from "./ExpedicaoRealtimeSync";

export default async function ExpedicaoLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const expedicao = await getExpedicaoComAgregados(id);
  if (!expedicao) notFound();

  const [pax, custos, pagamentos, docs] = await Promise.all([
    listPassageiros(id),
    listCustos(id),
    listPagamentos(id),
    listDocumentos(id),
  ]);

  const paxConfirmados = pax.filter((p) => p.status_reserva === "Confirmado").length;
  const custoRealizadoBrl = custos.reduce(
    (s, c) => s + (c.valor_realizado_brl ?? 0),
    0,
  );
  const docsPendentes = pax.filter((p) => {
    const d = docs.find((dd) => dd.passageiro_id === p.id);
    return !p.passaporte || (d?.seguro_status !== "Emitido");
  }).length;
  const pagamentosVencidos = pagamentos.filter((p) => p.status === "Vencido").length;

  return (
    <div className="flex flex-col h-full">
      <ExpedicaoRealtimeSync expedicaoId={id} />
      <ExpedicaoHeader
        expedicao={expedicao}
        kpis={{
          paxConfirmados,
          paxPlanejados: expedicao.pax_planejados,
          receitaPrevista: expedicao.receita_prevista_brl,
          custoPlanejado: expedicao.custo_planejado_brl,
          custoRealizado: custoRealizadoBrl,
          margemPrevista: expedicao.margem_prevista,
          docsPendentes,
          pagamentosVencidos,
        }}
      />
      <ExpedicaoTabsNav expedicaoId={id} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
