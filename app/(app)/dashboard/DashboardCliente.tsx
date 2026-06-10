"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plane,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { formatBRL, formatPercent, formatDate, daysUntil } from "@/lib/utils";
import { MARGEM_MINIMA, MARGEM_IDEAL } from "@/lib/constants";
import type { ExpedicaoComAgregados } from "@/types/database";
import type { ResumoProcessoExpedicao } from "@/lib/data/expedicoes";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

interface Props {
  expedicoes: ExpedicaoComAgregados[];
  processos: ResumoProcessoExpedicao[];
}

export function DashboardCliente({ expedicoes, processos }: Props) {
  // Dashboard depende de várias tabelas. Debounce maior (1s) pra agrupar
  // múltiplos eventos quando alguém edita várias coisas em sequência.
  const realtimeStatus = useRealtimeRefresh({
    debounceMs: 1000,
    subscriptions: [
      { table: "expedicoes" },
      { table: "passageiros" },
      { table: "custos" },
      { table: "pagamentos" },
      { table: "checklist_itens" },
    ],
  });

  // Processos (checklist) cross-expedição
  const comProcessos = processos.filter((p) => p.total > 0);
  const totalAtrasados = comProcessos.reduce((s, p) => s + p.atrasados, 0);
  const totalProximos = comProcessos.reduce((s, p) => s + p.proximos7d, 0);
  const processosOrdenados = [...comProcessos].sort(
    (a, b) => b.atrasados - a.atrasados || b.proximos7d - a.proximos7d,
  );

  const ativas = expedicoes.filter(
    (e) => e.status === "Vendas Abertas" || e.status === "Em andamento" || e.status === "Planejamento",
  );
  const totalReceita = ativas.reduce((s, e) => s + e.receita_prevista_brl, 0);
  const totalCusto = ativas.reduce((s, e) => s + e.custo_planejado_brl, 0);
  const margemMedia = totalReceita > 0 ? (totalReceita - totalCusto) / totalReceita : 0;
  const totalPaxConfirmados = ativas.reduce((s, e) => s + e.pax_confirmados, 0);
  const totalPagamentosVencidos = ativas.reduce((s, e) => s + e.pagamentos_vencidos, 0);
  const totalDocsPendentes = ativas.reduce((s, e) => s + e.docs_pendentes, 0);

  const proximosEmbarques = [...ativas]
    .filter((e) => {
      const d = daysUntil(e.data_embarque);
      return d != null && d >= 0 && d <= 60;
    })
    .sort((a, b) => a.data_embarque.localeCompare(b.data_embarque));

  const atencao = ativas
    .filter((e) => e.pagamentos_vencidos > 0 || e.docs_pendentes > 0 || e.margem_prevista < MARGEM_MINIMA)
    .slice(0, 10);

  const chartData = ativas.map((e) => ({
    id: e.id,
    nome: e.codigo,
    Receita: e.receita_prevista_brl,
    Custo: e.custo_planejado_brl,
  }));

  const router = useRouter();
  // Clicar numa barra (Receita ou Custo) abre a expedição correspondente.
  // O recharts entrega o item original em `payload` (ou achatado direto).
  const abrirExpedicao = (data: unknown) => {
    const d = data as { id?: string; payload?: { id?: string } } | undefined;
    const id = d?.id ?? d?.payload?.id;
    if (id) router.push(`/expedicoes/${id}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <LiveBadge status={realtimeStatus} />
        </div>
        <p className="text-xs text-muted-foreground">
          Visão executiva de {ativas.length} expediç{ativas.length === 1 ? "ão" : "ões"} ativa{ativas.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita prevista"
          value={formatBRL(totalReceita, 0)}
          sub={`${ativas.length} expediç${ativas.length === 1 ? "ão" : "ões"}`}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Custo planejado"
          value={formatBRL(totalCusto, 0)}
          sub={`Margem: ${formatPercent(margemMedia)}`}
          variant={margemMedia < MARGEM_MINIMA ? "critico" : margemMedia < MARGEM_IDEAL ? "atencao" : "vinculado"}
        />
        <KpiCard
          icon={<Plane className="h-4 w-4" />}
          label="Pax confirmados"
          value={String(totalPaxConfirmados)}
          sub="Todas as expedições ativas"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atenção requerida"
          value={String(totalPagamentosVencidos + totalDocsPendentes + totalAtrasados)}
          sub={`${totalAtrasados} processos atrasados · ${totalPagamentosVencidos} pagtos · ${totalDocsPendentes} docs`}
          variant={totalPagamentosVencidos + totalDocsPendentes + totalAtrasados > 0 ? "atencao" : "auto"}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Receita × Custo por expedição</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Clique numa barra para abrir a expedição
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => formatBRL(Number(v), 0)}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="Receita"
                    fill="var(--vinculado-600)"
                    cursor="pointer"
                    onClick={(d) => abrirExpedicao(d)}
                  />
                  <Bar
                    dataKey="Custo"
                    fill="var(--editavel-600)"
                    cursor="pointer"
                    onClick={(d) => abrirExpedicao(d)}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Nenhuma expedição ativa.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processos (checklist) cross-expedição */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-editavel-600" /> Processos das expedições
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {totalAtrasados > 0 && <Badge variant="critico">{totalAtrasados} atrasado{totalAtrasados > 1 ? "s" : ""}</Badge>}
            {totalProximos > 0 && <Badge variant="atencao">{totalProximos} vencem em 7d</Badge>}
            {totalAtrasados === 0 && totalProximos === 0 && <Badge variant="vinculado">Em dia</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {processosOrdenados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              Nenhuma expedição com checklist. Gere o checklist padrão na aba de cada expedição.
            </p>
          ) : (
            processosOrdenados.map((p) => {
              const pct = p.total ? Math.round((p.concluidos / p.total) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/expedicoes/${p.id}/checklist`}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{p.nome}</span>
                      {p.faseAtual && <Badge variant="lista">{p.faseAtual}</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className={pct === 100 ? "h-full rounded-full bg-vinculado-500" : "h-full rounded-full bg-editavel-600"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{p.concluidos}/{p.total}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {p.atrasados > 0 && <Badge variant="critico">{p.atrasados} atrasado{p.atrasados > 1 ? "s" : ""}</Badge>}
                    {p.proximos7d > 0 && <Badge variant="atencao">{p.proximos7d} em 7d</Badge>}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Atenção requerida */}
        <Card>
          <CardHeader>
            <CardTitle>Atenção requerida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {atencao.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">Tudo em ordem 👌</p>
            ) : (
              atencao.map((e) => (
                <Link
                  key={e.id}
                  href={`/expedicoes/${e.id}`}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-accent transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{e.nome}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {e.pagamentos_vencidos > 0 && (
                        <Badge variant="critico">{e.pagamentos_vencidos} pagto vencido{e.pagamentos_vencidos > 1 ? "s" : ""}</Badge>
                      )}
                      {e.docs_pendentes > 0 && (
                        <Badge variant="atencao">{e.docs_pendentes} doc{e.docs_pendentes > 1 ? "s" : ""} pendente{e.docs_pendentes > 1 ? "s" : ""}</Badge>
                      )}
                      {e.margem_prevista < MARGEM_MINIMA && (
                        <Badge variant="critico">Margem {formatPercent(e.margem_prevista)}</Badge>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Próximos embarques */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos embarques (60 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {proximosEmbarques.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">Nenhum embarque nos próximos 60 dias.</p>
            ) : (
              proximosEmbarques.map((e) => {
                const dias = daysUntil(e.data_embarque) ?? 0;
                return (
                  <Link
                    key={e.id}
                    href={`/expedicoes/${e.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-accent transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{e.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(e.data_embarque)} · {e.pax_confirmados}/{e.pax_planejados} pax
                      </div>
                    </div>
                    <Badge variant={dias < 14 ? "critico" : dias < 30 ? "atencao" : "auto"}>
                      {dias === 0 ? "Hoje" : `${dias}d`}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant?: "atencao" | "critico" | "vinculado" | "auto";
}) {
  const colors = {
    atencao: "text-atencao-600",
    critico: "text-critico-600",
    vinculado: "text-vinculado-600",
    auto: "text-muted-foreground",
  };
  return (
    <Card>
      <CardContent className="pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={variant ? colors[variant] : "text-muted-foreground"}>{icon}</span>
        </div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
