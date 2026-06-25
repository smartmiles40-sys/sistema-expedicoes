import {
  listPassageiros,
  listChecklist,
  getProntidaoExpedicao,
  getExpedicao,
  listUsuarios,
} from "@/lib/data/expedicoes";
import { listArquivosExpedicao } from "@/lib/data/arquivos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, daysUntil } from "@/lib/utils";
import { Calendar, ShieldCheck } from "lucide-react";
import { DocumentosPendentesCard } from "./DocumentosPendentesCard";

export default async function VisaoGeralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, checklist, prontidao, expedicao, usuarios, arquivos] = await Promise.all([
    listPassageiros(id),
    listChecklist(id),
    getProntidaoExpedicao(id),
    getExpedicao(id),
    listUsuarios(),
    listArquivosExpedicao(id),
  ]);

  const proximosPrazos = checklist
    .filter((c) => {
      const d = daysUntil(c.prazo);
      return d != null && d >= 0 && d <= 7 && c.status !== "Concluído";
    })
    .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));

  const aptos = prontidao.filter((l) => l.resultado.prontidao === "Apto").length;
  const atencao = prontidao.filter((l) => l.resultado.prontidao === "Atenção").length;
  const bloqueados = prontidao.filter((l) => l.resultado.prontidao === "Bloqueado").length;

  const checklistConcluido = checklist.filter((c) => c.status === "Concluído").length;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-atencao-100 text-atencao-600">
              <Calendar className="h-3.5 w-3.5" />
            </span>
            Próximos prazos (7 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {proximosPrazos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum prazo próximo.</p>
          ) : (
            proximosPrazos.map((c) => {
              const d = daysUntil(c.prazo) ?? 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate">{c.tarefa}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.etapa} · {formatDate(c.prazo)}
                    </div>
                  </div>
                  <Badge variant={d <= 1 ? "critico" : d <= 3 ? "atencao" : "lista"}>
                    {d === 0 ? "Hoje" : `${d}d`}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-vinculado-100 text-vinculado-600">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            Prontidão de embarque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prontidao.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Sem passageiros ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <ProntidaoBox cor="text-vinculado-600" valor={aptos} label="Aptos" />
              <ProntidaoBox cor="text-atencao-600" valor={atencao} label="Atenção" />
              <ProntidaoBox cor="text-critico-600" valor={bloqueados} label="Bloqueados" />
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentosPendentesCard
        expedicaoId={id}
        destino={expedicao?.destino ?? ""}
        prontidao={prontidao}
        usuarios={usuarios}
        arquivos={arquivos}
      />

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ResumoLinha
            label="Passageiros"
            value={`${pax.length} (${pax.filter((p) => p.status_reserva === "Confirmado").length} confirmados)`}
          />
          <ResumoLinha label="Prontidão" value={`${aptos}/${prontidao.length} aptos`} />
          <ResumoLinha label="Checklist" value={`${checklistConcluido}/${checklist.length} concluídos`} />
        </CardContent>
      </Card>
    </div>
  );
}

function ProntidaoBox({ cor, valor, label }: { cor: string; valor: number; label: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className={`text-xl font-semibold tabular-nums ${cor}`}>{valor}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ResumoLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
