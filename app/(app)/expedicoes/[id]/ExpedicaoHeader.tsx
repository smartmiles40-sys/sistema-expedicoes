import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, RefreshCw, Plane } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatDate, formatPercent, daysUntil } from "@/lib/utils";
import type { ExpedicaoComAgregados, StatusExpedicao } from "@/types/database";

const STATUS_PILL: Record<StatusExpedicao, string> = {
  Planejamento: "bg-white/15 text-white",
  "Vendas Abertas": "bg-[var(--brand-lime)] text-[var(--brand-dark)]",
  "Em andamento": "bg-[var(--brand-lime)] text-[var(--brand-dark)]",
  Concluída: "bg-white/15 text-white/80",
  Cancelada: "bg-critico-600 text-white",
};

export function ExpedicaoHeader({ expedicao }: { expedicao: ExpedicaoComAgregados }) {
  const dias = daysUntil(expedicao.data_embarque);
  const ocupacao = expedicao.pax_planejados > 0 ? expedicao.pax_confirmados / expedicao.pax_planejados : 0;
  const prontidaoPct = expedicao.prontidao_total > 0 ? expedicao.prontidao_aptos / expedicao.prontidao_total : 0;
  const embarcou = dias != null && dias < 0;

  return (
    <div>
      {/* HERO — banner em gradiente da marca */}
      <div className="bg-brand-gradient relative overflow-hidden px-5 py-5 text-white">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link
              href="/expedicoes"
              className="mt-1 text-white/60 transition-colors hover:text-[var(--brand-lime)]"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-[20px] sm:text-[26px] font-semibold leading-tight text-white truncate">
                  {expedicao.nome}
                </h1>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[expedicao.status]}`}>
                  {expedicao.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/75">
                <span className="font-mono text-white/45">{expedicao.codigo}</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {expedicao.destino}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--brand-lime)]" />
                  {formatDate(expedicao.data_embarque)} → {formatDate(expedicao.data_retorno)}
                </span>
              </div>
            </div>
          </div>

          {/* Contagem regressiva + ações */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2">
              {expedicao.responsavel_op_nome && (
                <span title={`Op: ${expedicao.responsavel_op_nome}`}>
                  <Avatar nome={expedicao.responsavel_op_nome} size={26} className="ring-2 ring-white/20" />
                </span>
              )}
              {expedicao.responsavel_com_nome && (
                <span title={`Com: ${expedicao.responsavel_com_nome}`} className="-ml-3">
                  <Avatar nome={expedicao.responsavel_com_nome} size={26} className="ring-2 ring-white/20" />
                </span>
              )}
            </div>

            {dias != null && !embarcou ? (
              <div className="rounded-2xl bg-[var(--brand-lime)] px-4 py-1.5 text-center text-[var(--brand-dark)] shadow-sm">
                <div className="text-[22px] font-bold leading-none tabular-nums">{dias}</div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
                  {dias === 0 ? "embarca hoje" : dias === 1 ? "dia p/ embarcar" : "dias p/ embarcar"}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/15 px-4 py-2 text-center">
                <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <Plane className="h-4 w-4" /> {embarcou ? "Embarcou" : "—"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* brilho decorativo */}
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--brand-lime)] opacity-[0.06] blur-3xl" />
      </div>

      {/* Faixa de anéis + Sync */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 flex-wrap">
        <RingStat
          value={ocupacao}
          color="var(--brand-dark)"
          label="Ocupação"
          big={`${expedicao.pax_confirmados}/${expedicao.pax_planejados}`}
          sub="confirmados"
        />
        <RingStat
          value={expedicao.checklist_pct}
          color="var(--brand-lime-deep)"
          label="Checklist"
          big={formatPercent(expedicao.checklist_pct, 0)}
          sub="concluído"
        />
        <RingStat
          value={prontidaoPct}
          color={expedicao.prontidao_total === 0 ? "var(--muted-foreground)" : prontidaoPct >= 1 ? "var(--vinculado-600)" : "var(--atencao-600)"}
          label="Prontidão"
          big={`${expedicao.prontidao_aptos}/${expedicao.prontidao_total}`}
          sub="aptos p/ embarque"
        />
        <button className="ml-auto inline-flex items-center gap-1.5 self-center rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Sync Bitrix
        </button>
      </div>
    </div>
  );
}

function RingStat({
  value,
  color,
  label,
  big,
  sub,
}: {
  value: number;
  color: string;
  label: string;
  big: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
      <ProgressRing value={value} color={color} label={`${Math.round((value || 0) * 100)}%`} />
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-[15px] font-semibold tabular-nums">{big}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
