import Link from "next/link";
import type { ReactNode } from "react";
import {
  listExpedicoesComAgregados,
  getResumoProntidao,
  getResumoProcessos,
} from "@/lib/data/expedicoes";
import { listPessoas } from "@/lib/data/pessoas";
import { ehMarco, ordinalFem } from "@/lib/fidelidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, daysUntil, aniversarioNaViagem, cn } from "@/lib/utils";
import {
  Map as MapIcon, Users, ShieldCheck, CalendarClock, PartyPopper, Star, Cake, ArrowRight, Plane,
} from "lucide-react";

const ATIVA = (s: string) => s !== "Concluída" && s !== "Cancelada";

export default async function DashboardPage() {
  const [expedicoes, resumoProntidao, resumoProcessos, pessoas] = await Promise.all([
    listExpedicoesComAgregados(),
    getResumoProntidao(),
    getResumoProcessos(),
    listPessoas(),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);
  const ativas = expedicoes.filter((e) => ATIVA(e.status));

  // ---- Números-chave ----
  const totalAptos = resumoProntidao.reduce((s, r) => s + r.aptos, 0);
  const totalPront = resumoProntidao.reduce((s, r) => s + r.total, 0);
  const pctProntos = totalPront > 0 ? Math.round((totalAptos / totalPront) * 100) : 0;
  const paxConfirmados = ativas.reduce((s, e) => s + e.pax_confirmados, 0);
  const totalBloqueados = resumoProntidao.reduce((s, r) => s + r.bloqueados, 0);
  const totalAtencao = resumoProntidao.reduce((s, r) => s + r.atencao, 0);
  const atrasados = resumoProcessos.filter((r) => ATIVA(r.status)).reduce((s, r) => s + r.atrasados, 0);

  // ---- Próximas expedições ----
  const proximas = ativas
    .filter((e) => (e.data_embarque ?? "").slice(0, 10) >= hoje)
    .sort((a, b) => (a.data_embarque ?? "").localeCompare(b.data_embarque ?? ""))
    .slice(0, 6);

  // ---- Prontidão / prazos com pendência (clicáveis) ----
  const comBloqueio = resumoProntidao
    .filter((r) => r.bloqueados > 0 || r.atencao > 0)
    .sort((a, b) => b.bloqueados - a.bloqueados || b.atencao - a.atencao)
    .slice(0, 6);
  const prazosPend = resumoProcessos
    .filter((r) => ATIVA(r.status) && (r.atrasados > 0 || r.proximos7d > 0))
    .sort((a, b) => b.atrasados - a.atrasados || b.proximos7d - a.proximos7d)
    .slice(0, 6);

  // ---- Momentos especiais (agregado das expedições futuras) ----
  const infoExp = new Map(ativas.map((e) => [e.id, { nome: e.nome, embarque: e.data_embarque, retorno: e.data_retorno }]));
  const futurasIds = new Set(proximas.map((e) => e.id).concat(ativas.filter((e) => (e.data_embarque ?? "").slice(0, 10) >= hoje).map((e) => e.id)));
  const marcos: { nome: string; exp: string; expId: string; pos: number }[] = [];
  const aniversariantes: { nome: string; exp: string; expId: string; data: string; idade: number | null }[] = [];
  for (const p of pessoas) {
    const ativasPessoa = p.expedicoes
      .filter((e) => e.status_reserva !== "Cancelado")
      .slice()
      .sort((a, b) => a.data_embarque.localeCompare(b.data_embarque) || a.expedicao_id.localeCompare(b.expedicao_id));
    ativasPessoa.forEach((e, idx) => {
      if (!futurasIds.has(e.expedicao_id)) return;
      const pos = idx + 1;
      if (ehMarco(pos)) marcos.push({ nome: p.nome_completo, exp: e.nome, expId: e.expedicao_id, pos });
      const info = infoExp.get(e.expedicao_id);
      const aniv = info ? aniversarioNaViagem(p.data_nascimento, info.embarque, info.retorno) : null;
      if (aniv) aniversariantes.push({ nome: p.nome_completo, exp: e.nome, expId: e.expedicao_id, data: aniv.data, idade: aniv.idade });
    });
  }
  marcos.sort((a, b) => b.pos - a.pos);
  aniversariantes.sort((a, b) => a.data.localeCompare(b.data));
  const temMomentos = marcos.length + aniversariantes.length > 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="page-title">Início</h1>
        <p className="text-xs text-muted-foreground">Resumo geral — clique em qualquer item para abrir.</p>
      </div>

      {/* Números-chave */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/expedicoes" icone={<MapIcon className="h-4 w-4" />} cor="text-editavel-600" bg="bg-editavel-100" valor={ativas.length} label="Expedições ativas" />
        <Kpi href="/passageiros" icone={<Users className="h-4 w-4" />} cor="text-vinculado-600" bg="bg-vinculado-100" valor={paxConfirmados} label="Passageiros confirmados" />
        <Kpi href="/expedicoes" icone={<ShieldCheck className="h-4 w-4" />} cor="text-lista-600" bg="bg-lista-100" valor={`${pctProntos}%`} label={`Prontos (${totalAptos}/${totalPront})`} />
        <Kpi href="/expedicoes" icone={<CalendarClock className="h-4 w-4" />} cor="text-critico-600" bg="bg-critico-100" valor={atrasados} label="Prazos atrasados" />
      </div>

      {/* Próximas expedições */}
      <SecaoCard titulo="Próximas expedições" icone={<Plane className="h-3.5 w-3.5" />} verTudo="/expedicoes">
        {proximas.length === 0 ? (
          <Vazio texto="Nenhuma expedição futura." />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {proximas.map((e) => {
              const dias = daysUntil(e.data_embarque);
              return (
                <Link
                  key={e.id}
                  href={`/expedicoes/${e.id}`}
                  className="group rounded-xl border border-border bg-background p-3 hover:border-foreground/30 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{e.destino}</span>
                    {dias != null && dias >= 0 && (
                      <Badge variant={dias <= 15 ? "critico" : dias <= 45 ? "atencao" : "lista"}>
                        {dias === 0 ? "hoje" : `${dias}d`}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-[14px] font-semibold leading-tight truncate">{e.nome}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(e.data_embarque)}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-muted px-1.5 py-0.5">{e.pax_confirmados} pax</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5">{e.prontidao_aptos}/{e.prontidao_total} prontos</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5">{Math.round(e.checklist_pct * 100)}% checklist</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SecaoCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Prontidão + alertas */}
        <SecaoCard titulo="Prontidão & alertas" icone={<ShieldCheck className="h-3.5 w-3.5" />}>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat cor="text-vinculado-600" valor={totalAptos} label="Aptos" />
            <MiniStat cor="text-atencao-600" valor={totalAtencao} label="Atenção" />
            <MiniStat cor="text-critico-600" valor={totalBloqueados} label="Bloqueados" />
          </div>
          {comBloqueio.length === 0 ? (
            <Vazio texto="Sem pendências de prontidão. 🎉" />
          ) : (
            <div className="space-y-0.5">
              {comBloqueio.map((r) => (
                <Link
                  key={r.id}
                  href={`/expedicoes/${r.id}/passageiros`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{r.nome}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {r.topBloqueador ? `Principal: ${r.topBloqueador}` : "Requisitos pendentes"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {r.bloqueados > 0 && <Badge variant="critico">{r.bloqueados}</Badge>}
                    {r.atencao > 0 && <Badge variant="atencao">{r.atencao}</Badge>}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SecaoCard>

        {/* Prazos & checklist */}
        <SecaoCard titulo="Prazos & checklist" icone={<CalendarClock className="h-3.5 w-3.5" />}>
          {prazosPend.length === 0 ? (
            <Vazio texto="Nenhum prazo atrasado ou próximo." />
          ) : (
            <div className="space-y-0.5">
              {prazosPend.map((r) => (
                <Link
                  key={r.id}
                  href={`/expedicoes/${r.id}/checklist`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{r.nome}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.faseAtual}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {r.atrasados > 0 && <Badge variant="critico">{r.atrasados} atrasado{r.atrasados > 1 ? "s" : ""}</Badge>}
                    {r.proximos7d > 0 && <Badge variant="atencao">{r.proximos7d} em 7d</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SecaoCard>
      </div>

      {/* Momentos especiais */}
      <SecaoCard titulo="Momentos especiais" icone={<PartyPopper className="h-3.5 w-3.5" />}>
        {!temMomentos ? (
          <Vazio texto="Marcos de fidelidade e aniversários das próximas viagens aparecem aqui." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {marcos.length > 0 && (
              <div>
                <SubTitulo icone={<Star className="h-3.5 w-3.5" />} cor="text-lista-600" bg="bg-lista-100">Marcos de fidelidade</SubTitulo>
                <div className="space-y-0.5">
                  {marcos.map((m, i) => (
                    <MomentoLink key={i} href={`/expedicoes/${m.expId}`} nome={m.nome} detalhe={`${ordinalFem(m.pos)} expedição · ${m.exp}`} />
                  ))}
                </div>
              </div>
            )}
            {aniversariantes.length > 0 && (
              <div>
                <SubTitulo icone={<Cake className="h-3.5 w-3.5" />} cor="text-atencao-600" bg="bg-atencao-100">Aniversariantes na viagem</SubTitulo>
                <div className="space-y-0.5">
                  {aniversariantes.map((a, i) => (
                    <MomentoLink key={i} href={`/expedicoes/${a.expId}`} nome={a.nome} detalhe={`🎂 ${formatDate(a.data)} · ${a.exp}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SecaoCard>
    </div>
  );
}

function Kpi({ href, icone, cor, bg, valor, label }: { href: string; icone: ReactNode; cor: string; bg: string; valor: number | string; label: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-foreground/30 hover:bg-accent/20">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", bg, cor)}>{icone}</span>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{valor}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </Link>
  );
}

function SecaoCard({ titulo, icone, verTudo, children }: { titulo: string; icone: ReactNode; verTudo?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-foreground">{icone}</span>
            {titulo}
          </span>
          {verTudo && (
            <Link href={verTudo} className="text-[12px] font-medium text-editavel-700 hover:underline">Ver tudo</Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MiniStat({ cor, valor, label }: { cor: string; valor: number; label: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className={cn("text-xl font-semibold tabular-nums", cor)}>{valor}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SubTitulo({ icone, cor, bg, children }: { icone: ReactNode; cor: string; bg: string; children: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-md", bg, cor)}>{icone}</span>
      {children}
    </div>
  );
}

function MomentoLink({ href, nome, detalhe }: { href: string; nome: string; detalhe: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
      <Avatar nome={nome} size={26} className="shrink-0" />
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate">{nome}</div>
        <div className="text-[11px] text-muted-foreground truncate">{detalhe}</div>
      </div>
    </Link>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-2 text-xs text-muted-foreground">{texto}</p>;
}
