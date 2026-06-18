import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, formatPercent, daysUntil } from "@/lib/utils";
import type { ExpedicaoComAgregados, StatusExpedicao } from "@/types/database";

const STATUS_VARIANT: Record<StatusExpedicao, "lista" | "vinculado" | "atencao" | "auto" | "critico"> = {
  Planejamento: "lista",
  "Vendas Abertas": "vinculado",
  "Em andamento": "atencao",
  Concluída: "auto",
  Cancelada: "critico",
};

export function ExpedicaoHeader({
  expedicao,
}: {
  expedicao: ExpedicaoComAgregados;
}) {
  const dias = daysUntil(expedicao.data_embarque);
  const ocupacao = expedicao.pax_planejados > 0 ? expedicao.pax_confirmados / expedicao.pax_planejados : 0;
  const prontidaoPct = expedicao.prontidao_total > 0 ? expedicao.prontidao_aptos / expedicao.prontidao_total : 0;

  return (
    <div className="border-b border-border bg-background px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Link
            href="/expedicoes"
            className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para lista"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold truncate">{expedicao.nome}</h1>
              <span className="font-mono text-xs text-muted-foreground">{expedicao.codigo}</span>
              <Badge variant={STATUS_VARIANT[expedicao.status]}>{expedicao.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {expedicao.destino}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(expedicao.data_embarque)} → {formatDate(expedicao.data_retorno)}
                {dias != null && dias >= 0 && (
                  <span className={dias < 30 ? "text-atencao-600 ml-1" : "ml-1"}>
                    (em {dias}d)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expedicao.responsavel_op_nome && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Op:</span>
              <Avatar nome={expedicao.responsavel_op_nome} size={20} />
              <span className="hidden md:inline">{expedicao.responsavel_op_nome}</span>
            </div>
          )}
          {expedicao.responsavel_com_nome && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Com:</span>
              <Avatar nome={expedicao.responsavel_com_nome} size={20} />
              <span className="hidden md:inline">{expedicao.responsavel_com_nome}</span>
            </div>
          )}
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 transition-colors">
            <RefreshCw className="h-3 w-3" />
            Sync Bitrix
          </button>
        </div>
      </div>

      {/* KPIs operacionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Pax confirmados"
          value={`${expedicao.pax_confirmados}/${expedicao.pax_planejados}`}
          sub={`${formatPercent(ocupacao, 0)} ocupação`}
        />
        <Kpi
          label="Checklist"
          value={formatPercent(expedicao.checklist_pct, 0)}
          sub="processos concluídos"
          variant={expedicao.checklist_pct >= 1 ? "vinculado" : expedicao.checklist_pct >= 0.5 ? "atencao" : undefined}
        />
        <Kpi
          label="Prontidão"
          value={`${expedicao.prontidao_aptos}/${expedicao.prontidao_total}`}
          sub={`${formatPercent(prontidaoPct, 0)} aptos`}
          variant={expedicao.prontidao_total === 0 ? undefined : prontidaoPct >= 1 ? "vinculado" : "atencao"}
        />
        <Kpi
          label="Embarque"
          value={dias != null ? (dias >= 0 ? `${dias}d` : "Embarcou") : "—"}
          sub={dias != null && dias >= 0 ? "até o embarque" : ""}
          variant={dias != null && dias >= 0 && dias < 30 ? "atencao" : undefined}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "atencao" | "critico" | "vinculado";
}) {
  const colors = {
    atencao: "text-atencao-600",
    critico: "text-critico-600",
    vinculado: "text-vinculado-600",
  };
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${variant ? colors[variant] : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
