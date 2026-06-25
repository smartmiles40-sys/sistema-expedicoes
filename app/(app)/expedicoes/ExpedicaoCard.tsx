import { Calendar, MapPin, Pencil, Plane, Star } from "lucide-react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import type { ExpedicaoComAgregados, StatusExpedicao } from "@/types/database";

const STATUS_PILL: Record<StatusExpedicao, string> = {
  Planejamento: "bg-white/15 text-white",
  "Vendas Abertas": "bg-[var(--brand-lime)] text-[var(--brand-dark)]",
  "Em andamento": "bg-[var(--brand-lime)] text-[var(--brand-dark)]",
  Concluída: "bg-white/15 text-white/80",
  Cancelada: "bg-critico-600 text-white",
};

/** Card de uma expedição — "trip card" com contagem regressiva e anéis. */
export function ExpedicaoCard({
  expedicao: e,
  destaque,
  onOpen,
  onEdit,
}: {
  expedicao: ExpedicaoComAgregados;
  destaque?: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const dias = daysUntil(e.data_embarque);
  const embarcou = dias != null && dias < 0;
  const ocup = e.pax_planejados > 0 ? e.pax_confirmados / e.pax_planejados : 0;
  const prontidao = e.prontidao_total > 0 ? e.prontidao_aptos / e.prontidao_total : 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        destaque && "ring-2 ring-[var(--brand-lime-deep)]",
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* topo em gradiente */}
        <div className="bg-brand-gradient relative px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL[e.status]}`}>
              {e.status}
            </span>
            {dias != null && !embarcou ? (
              <span className="rounded-full bg-[var(--brand-lime)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--brand-dark)]">
                {dias === 0 ? "embarca hoje" : `${dias}d`}
              </span>
            ) : embarcou ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                <Plane className="h-3 w-3" /> Embarcou
              </span>
            ) : null}
            {destaque && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-lime)]">
                <Star className="h-3 w-3 fill-current" /> Próxima
              </span>
            )}
          </div>
          <h3 className="font-display mt-2 line-clamp-2 text-[18px] font-semibold leading-snug text-white">
            {e.nome}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-white/70">
            <MapPin className="h-3 w-3 text-[var(--brand-lime)]" /> {e.destino}
          </div>
        </div>

        {/* corpo: anéis + datas */}
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <ProgressRing value={ocup} size={42} stroke={4} color="var(--brand-dark)" label={`${Math.round(ocup * 100)}%`} />
              <div className="text-[11px] leading-tight">
                <div className="text-[13px] font-semibold tabular-nums">{e.pax_confirmados}/{e.pax_planejados}</div>
                <div className="text-muted-foreground">pax</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProgressRing
                value={prontidao}
                size={42}
                stroke={4}
                color={e.prontidao_total === 0 ? "var(--muted-foreground)" : prontidao >= 1 ? "var(--vinculado-600)" : "var(--atencao-600)"}
                label={`${Math.round(prontidao * 100)}%`}
              />
              <div className="text-[11px] leading-tight">
                <div className="text-[13px] font-semibold tabular-nums">{e.prontidao_aptos}/{e.prontidao_total}</div>
                <div className="text-muted-foreground">aptos</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(e.data_embarque)} → {formatDate(e.data_retorno)}
            </span>
            <span className="font-mono">{e.codigo}</span>
          </div>
        </div>
      </button>

      {/* editar (aparece no hover) */}
      <button
        type="button"
        onClick={onEdit}
        aria-label="Editar expedição"
        title="Editar"
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 opacity-0 transition-all hover:bg-white/20 hover:text-white group-hover:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
