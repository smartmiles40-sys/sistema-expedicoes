"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  CompassIcon, MapPin, Calendar, ChevronRight, FileText, ArrowLeft, RefreshCw,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { COR_PRONTIDAO } from "@/lib/constants";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import {
  buscarDadosLider, linkAssinadoLider,
  type LiderDados, type LiderExpedicao, type LiderPax, type LiderArquivo,
} from "./actions";

type VerDoc = (a: LiderArquivo, download?: boolean) => void;

const SEM_DOT: Record<string, string> = {
  ok: "bg-vinculado-600",
  atencao: "bg-atencao-600",
  bloqueio: "bg-critico-600",
  na: "bg-auto-600",
};

export default function LiderPage() {
  const [cpf, setCpf] = React.useState("");
  const [dados, setDados] = React.useState<LiderDados | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const [atualizando, setAtualizando] = React.useState(false);

  // Recarrega os dados em silêncio (reflete o que a operação atualizou).
  const recarregar = React.useCallback(async () => {
    if (!cpf) return;
    setAtualizando(true);
    const r = await buscarDadosLider(cpf);
    setAtualizando(false);
    if (r.ok) setDados(r.dados);
  }, [cpf]);

  // Enquanto a área está aberta: atualiza a cada 25s e ao voltar pra aba.
  const logado = dados !== null;
  React.useEffect(() => {
    if (!logado) return;
    const id = setInterval(recarregar, 25000);
    const onVis = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [logado, recarregar]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const r = await buscarDadosLider(cpf);
    setLoading(false);
    if (r.ok) setDados(r.dados);
    else setErro(r.error);
  }

  async function verDoc(arq: LiderArquivo, download = false) {
    const r = await linkAssinadoLider(cpf, arq.id, download);
    if (!r.ok) {
      toast.error("Não foi possível abrir", { description: r.error });
      return;
    }
    if (download) {
      window.open(r.url, "_blank", "noopener");
      return;
    }
    if (arq.mime?.startsWith("image/")) setLightbox(r.url);
    else window.open(r.url, "_blank", "noopener");
  }

  // ---------- Portão de CPF ----------
  if (!dados) {
    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)]">
              <CompassIcon className="h-5 w-5" />
            </div>
            <span className="font-display text-[18px] font-semibold text-[var(--brand-lime)]">Se Tu For, Eu Vou</span>
          </div>
          <div className="relative z-10 max-w-md">
            <h2 className="font-display text-4xl font-semibold leading-[1.1] text-white">
              Área do Líder
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
              Acompanhe suas expedições, os ExpedAmigos e a prontidão de cada um — direto na palma da mão.
            </p>
          </div>
          <p className="relative z-10 text-xs text-white/40">Acesso só leitura</p>
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-lime)] opacity-[0.07] blur-3xl" />
        </div>

        <div className="flex items-center justify-center p-6">
          <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
            <a href="/login" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </a>
            <div>
              <h1 className="page-title">Área do Líder</h1>
              <p className="page-subtitle mt-1">Informe seu CPF para ver suas expedições.</p>
            </div>
            <Input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="Seu CPF"
              inputMode="numeric"
              autoFocus
            />
            {erro && <p className="text-[12px] font-medium text-critico-600">{erro}</p>}
            <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
              {loading ? "Buscando..." : "Entrar"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Sem senha — é só o CPF cadastrado como líder. Você verá apenas as informações (sem editar).
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Área do líder ----------
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand-gradient flex items-center justify-between px-5 py-4 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)]">
            <CompassIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[16px] font-semibold leading-none">Área do Líder</span>
              {dados.master && (
                <span className="rounded-full bg-[var(--brand-lime)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-dark)]">MASTER</span>
              )}
            </div>
            <div className="mt-0.5 truncate text-[13px] text-white/70">
              Olá, {dados.nome.split(" ")[0]} 👋{dados.master ? ` · ${dados.expedicoes.length} expedições` : ""}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={recarregar}
            disabled={atualizando}
            title="Atualizar"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", atualizando && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            type="button"
            onClick={() => { setDados(null); setCpf(""); setErro(null); }}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/20"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {dados.expedicoes.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">
            Nenhuma expedição atribuída a você no momento.
          </p>
        ) : (
          dados.expedicoes.map((exp) => (
            <ExpedicaoLiderCard key={exp.id} exp={exp} onVerDoc={verDoc} />
          ))
        )}
        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Visualização apenas. Para qualquer alteração, fale com a equipe da agência.
        </p>
      </main>

      {lightbox && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt="Documento"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-xl"
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 rounded-full bg-background/90 px-3 py-1 text-[13px] font-medium hover:bg-background"
            >
              Fechar
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ExpedicaoLiderCard({ exp, onVerDoc }: { exp: LiderExpedicao; onVerDoc: VerDoc }) {
  // Sempre recolhida — o usuário abre a expedição que quiser.
  const [aberta, setAberta] = React.useState(false);
  const dias = daysUntil(exp.data_embarque);
  const lideres = exp.passageiros.filter((p) => p.tipo === "Líder");
  const amigos = exp.passageiros.filter((p) => p.tipo !== "Líder");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="bg-brand-gradient block w-full px-4 py-3 text-left text-white"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{exp.status}</span>
          {dias != null && dias >= 0 && (
            <span className="rounded-full bg-[var(--brand-lime)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-dark)]">
              {dias === 0 ? "hoje" : `${dias}d`}
            </span>
          )}
          <ChevronRight className={cn("ml-auto h-4 w-4 transition-transform", aberta && "rotate-90")} />
        </div>
        <h3 className="font-display mt-2 text-[18px] font-semibold leading-snug">{exp.nome}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/70">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-[var(--brand-lime)]" /> {exp.destino}</span>
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3 text-[var(--brand-lime)]" /> {formatDate(exp.data_embarque)} → {formatDate(exp.data_retorno)}</span>
        </div>
      </button>

      {aberta && (
        <div className="space-y-3 p-3">
          {lideres.length > 0 && (
            <Secao titulo="Líderes" pax={lideres} onVerDoc={onVerDoc} />
          )}
          <Secao titulo={`ExpedAmigos (${amigos.length})`} pax={amigos} onVerDoc={onVerDoc} />
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, pax, onVerDoc }: { titulo: string; pax: LiderPax[]; onVerDoc: VerDoc }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className="space-y-1.5">
        {pax.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Ninguém ainda.</p>
        ) : (
          pax.map((p) => <PaxLiderRow key={p.id} p={p} onVerDoc={onVerDoc} />)
        )}
      </div>
    </div>
  );
}

function PaxLiderRow({ p, onVerDoc }: { p: LiderPax; onVerDoc: VerDoc }) {
  const [aberto, setAberto] = React.useState(false);
  const [dadosAbertos, setDadosAbertos] = React.useState(false);
  // Documentos que não estão ligados a nenhuma exigência exibida.
  const outros = p.arquivos.filter((a) => !p.checagens.some((c) => c.arquivos.some((x) => x.id === a.id)));
  return (
    <div className="rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <Avatar nome={p.nome_completo} size={28} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{p.nome_completo}</div>
          <div className="text-[10px] text-muted-foreground">{p.tipo} · {p.status_reserva}</div>
        </div>
        <Badge variant={COR_PRONTIDAO[p.prontidao]}>{p.prontidao}</Badge>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-90")} />
      </button>

      {aberto && (
        <div className="space-y-2.5 border-t border-border px-3 py-2.5">
          {/* Dados pessoais (clicável) */}
          <button
            type="button"
            onClick={() => setDadosAbertos((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-editavel-700"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", dadosAbertos && "rotate-90")} />
            Dados pessoais
          </button>
          {dadosAbertos && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/20 p-2.5">
              <Campo label="CPF" valor={p.cpf} />
              <Campo label="Passaporte" valor={p.passaporte} />
              <Campo label="Validade passap." valor={p.validade_passaporte ? formatDate(p.validade_passaporte) : null} />
              <Campo label="Nascimento" valor={p.data_nascimento ? formatDate(p.data_nascimento) : null} />
              <Campo label="Telefone" valor={p.telefone} />
              <Campo label="E-mail" valor={p.email} />
              <Campo label="Contato emergência" valor={p.contato_emergencia_nome} />
              <Campo label="Fone emergência" valor={p.contato_emergencia_fone} />
              {p.restricoes_alimentares && <Campo label="Restrições alimentares" valor={p.restricoes_alimentares} full />}
              {p.condicoes_medicas && <Campo label="Condições médicas" valor={p.condicoes_medicas} full />}
            </div>
          )}

          {/* Prontidão + documentos por exigência */}
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prontidão</div>
            <ul className="space-y-1.5">
              {p.checagens.map((c) => (
                <li key={c.tipo} className="text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", SEM_DOT[c.semaforo])} />
                    <span className="font-medium">{c.tipo}</span>
                    <span className="truncate text-muted-foreground">— {c.detalhe}</span>
                  </div>
                  {c.arquivos.length > 0 && (
                    <div className="ml-4 mt-1 flex flex-wrap gap-1.5">
                      {c.arquivos.map((a) => <DocChip key={a.id} a={a} onVerDoc={onVerDoc} />)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Outros documentos */}
          {outros.length > 0 && (
            <div className="border-t border-border pt-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Outros documentos</div>
              <div className="flex flex-wrap gap-1.5">
                {outros.map((a) => <DocChip key={a.id} a={a} onVerDoc={onVerDoc} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocChip({ a, onVerDoc }: { a: LiderArquivo; onVerDoc: VerDoc }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px]">
      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="max-w-[120px] truncate" title={a.nome}>{a.nome}</span>
      <button type="button" onClick={() => onVerDoc(a, false)} className="font-medium text-editavel-700 hover:underline">Abrir</button>
      <span className="text-border">·</span>
      <button type="button" onClick={() => onVerDoc(a, true)} className="font-medium text-editavel-700 hover:underline">Baixar</button>
    </span>
  );
}

function Campo({ label, valor, full }: { label: string; valor: string | null; full?: boolean }) {
  return (
    <div className={cn(full && "col-span-2")}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[12px] font-medium">{valor || "—"}</div>
    </div>
  );
}
