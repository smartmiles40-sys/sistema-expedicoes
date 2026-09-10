"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  MapPin, Calendar, ChevronRight, FileText, ArrowLeft, RefreshCw, CalendarDays, Moon, Sun,
  DownloadCloud, WifiOff, Trash2,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { COR_PRONTIDAO } from "@/lib/constants";
import { formatDate, daysUntil, cn, aniversarioNoMesDaExpedicao } from "@/lib/utils";
import {
  buscarDadosLider, linkAssinadoLider, definirSenhaLider,
  type LiderDados, type LiderExpedicao, type LiderPax, type LiderArquivo,
} from "./actions";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { conferirAcompanhante } from "@/lib/rooming/acompanhante";
import { resumoSaude } from "@/lib/saude";
import {
  offlineSuportado, salvarExpedicao, carregarExpedicoesSalvas, removerExpedicao,
  salvarDoc, carregarDoc, coletarArquivosExpedicao,
} from "@/lib/lider/offline";
import type { RoteiroLiderDiaRow } from "@/types/database";

type VerDoc = (a: LiderArquivo) => void;

const SEM_DOT: Record<string, string> = {
  ok: "bg-vinculado-600",
  atencao: "bg-atencao-600",
  bloqueio: "bg-critico-600",
  na: "bg-auto-600",
};

export default function LiderPage() {
  const { theme, toggle: alternarTema } = useTheme();
  const [cpf, setCpf] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [dados, setDados] = React.useState<LiderDados | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  // Visualizador de documento IN-APP (evita window.open, que o mobile bloqueia
  // quando chamado depois de um await). `objectUrl` = URL de blob a revogar ao fechar.
  const [docView, setDocView] = React.useState<{ url: string; mime: string | null; nome: string; objectUrl: boolean } | null>(null);
  const fecharDoc = React.useCallback(() => {
    setDocView((d) => { if (d?.objectUrl) URL.revokeObjectURL(d.url); return null; });
  }, []);
  const [atualizando, setAtualizando] = React.useState(false);
  const [precisaTrocar, setPrecisaTrocar] = React.useState(false);
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmaSenha, setConfirmaSenha] = React.useState("");
  const [salvandoSenha, setSalvandoSenha] = React.useState(false);
  // Grupos recolhíveis abertos (chave = "passadas" ou o ano, ex.: "2027").
  const [gruposAbertos, setGruposAbertos] = React.useState<Set<string>>(new Set());
  const toggleGrupo = (k: string) =>
    setGruposAbertos((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  // Offline (opção B), POR EXPEDIÇÃO: o líder salva cada expedição que quiser.
  // `salvas` = expId → savedAt (salvas neste aparelho). `offline` = renderizando dos
  // snapshots (sem servidor). `prepExp` = progresso do download da expedição atual.
  const [offline, setOffline] = React.useState(false);
  const [salvas, setSalvas] = React.useState<Map<string, string>>(new Map());
  const [prepExp, setPrepExp] = React.useState<{ expId: string; feito: number; total: number; falhas: number } | null>(null);
  const [restaurando, setRestaurando] = React.useState(true);

  // Registra o service worker (faz /lider abrir sem internet). Só em produção —
  // em dev o cache atrapalharia o desenvolvimento das outras páginas.
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/lider-sw.js").catch(() => {});
    }
  }, []);

  // Ao abrir: carrega quais expedições estão salvas. Se estiver SEM internet e houver
  // salvas, remonta a tela a partir delas (sem login).
  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const lista = offlineSuportado() ? await carregarExpedicoesSalvas() : [];
      if (!ativo) return;
      setSalvas(new Map(lista.map((s) => [s.expId, s.savedAt])));
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!online && lista.length) {
        const first = lista[0];
        setCpf(first.cpf);
        setSenha(first.senha);
        setDados({ nome: first.nome, master: first.master, expedicoes: lista.map((s) => s.expedicao) });
        setOffline(true);
      }
      setRestaurando(false);
    })();
    return () => { ativo = false; };
  }, []);

  // Recarrega os dados em silêncio (reflete o que a operação atualizou).
  const recarregar = React.useCallback(async () => {
    if (!cpf) return;
    setAtualizando(true);
    const r = await buscarDadosLider(cpf, senha);
    setAtualizando(false);
    if (r.ok) setDados(r.dados);
  }, [cpf, senha]);

  // Enquanto a área está aberta ONLINE: atualiza a cada 25s e ao voltar pra aba.
  // No modo offline (remontado dos snapshots) não faz nada.
  const logado = dados !== null;
  React.useEffect(() => {
    if (!logado || offline) return;
    const id = setInterval(recarregar, 25000);
    const onVis = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [logado, offline, recarregar]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const r = await buscarDadosLider(cpf, senha);
    setLoading(false);
    if (r.ok) { setDados(r.dados); setPrecisaTrocar(r.precisaTrocar); }
    else setErro(r.error);
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.trim().length < 6) return setErro("A nova senha precisa ter pelo menos 6 caracteres.");
    if (novaSenha !== confirmaSenha) return setErro("As senhas não conferem.");
    setSalvandoSenha(true);
    const r = await definirSenhaLider(cpf, senha, novaSenha);
    setSalvandoSenha(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível salvar a senha.");
    setSenha(novaSenha);
    setNovaSenha(""); setConfirmaSenha("");
    setPrecisaTrocar(false);
    toast.success("Senha criada! 🎉");
  }

  async function verDoc(arq: LiderArquivo) {
    // Abre SEMPRE no visualizador in-app (nada de window.open — bloqueado no celular).
    // 1) tenta o blob salvo no aparelho (offline); 2) senão, URL assinada (online).
    const local = offlineSuportado() ? await carregarDoc(arq.id) : null;
    if (local) {
      setDocView({ url: URL.createObjectURL(local.blob), mime: local.mime, nome: local.nome, objectUrl: true });
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Documento não disponível offline", { description: "Conecte-se e use “Salvar para offline” nesta expedição." });
      return;
    }
    const tid = toast.loading("Abrindo documento…");
    const r = await linkAssinadoLider(cpf, senha, arq.id, false);
    if (!r.ok) {
      toast.error("Não foi possível abrir", { description: r.error, id: tid });
      return;
    }
    toast.dismiss(tid);
    setDocView({ url: r.url, mime: arq.mime, nome: arq.nome, objectUrl: false });
  }

  // Baixa dados + documentos de UMA expedição e salva (congelada) no aparelho.
  async function salvarExpedicaoOffline(exp: LiderExpedicao) {
    if (!offlineSuportado()) { toast.error("Este navegador não suporta salvar offline."); return; }
    setPrepExp({ expId: exp.id, feito: 0, total: 0, falhas: 0 });
    const r = await buscarDadosLider(cpf, senha);
    if (!r.ok) { toast.error("Não foi possível carregar os dados", { description: r.error }); setPrepExp(null); return; }
    const fresh = r.dados.expedicoes.find((e) => e.id === exp.id) ?? exp;
    const arquivos = coletarArquivosExpedicao(fresh);
    setPrepExp({ expId: exp.id, feito: 0, total: arquivos.length, falhas: 0 });
    let feito = 0, falhas = 0;
    const LOTE = 4; // baixa em lotes pequenos pra não travar a rede do celular
    for (let i = 0; i < arquivos.length; i += LOTE) {
      await Promise.all(
        arquivos.slice(i, i + LOTE).map(async (a) => {
          try {
            const link = await linkAssinadoLider(cpf, senha, a.id, false);
            if (!link.ok) { falhas++; return; }
            const resp = await fetch(link.url);
            if (!resp.ok) { falhas++; return; }
            const blob = await resp.blob();
            await salvarDoc(a.id, { blob, mime: a.mime, nome: a.nome });
          } catch {
            falhas++;
          } finally {
            feito++;
            setPrepExp({ expId: exp.id, feito, total: arquivos.length, falhas });
          }
        }),
      );
    }
    const savedAt = new Date().toISOString();
    await salvarExpedicao({ expId: exp.id, cpf, senha, nome: r.dados.nome, master: r.dados.master, expedicao: fresh, savedAt });
    setSalvas((prev) => new Map(prev).set(exp.id, savedAt));
    setPrepExp(null);
    toast.success(
      falhas === 0 ? "Expedição salva para offline! 📴" : `Salva com ${falhas} documento(s) que falharam.`,
      { description: `${arquivos.length - falhas} de ${arquivos.length} documentos no aparelho.` },
    );
  }

  async function removerExpedicaoOffline(expId: string) {
    await removerExpedicao(expId);
    setSalvas((prev) => { const n = new Map(prev); n.delete(expId); return n; });
    toast.success("Dados offline desta expedição removidos.");
    if (offline) {
      // No modo offline, tira o card da tela; se era o último, volta pro portão.
      const rest = (dados?.expedicoes ?? []).filter((e) => e.id !== expId);
      if (rest.length === 0) { setDados(null); setOffline(false); }
      else if (dados) setDados({ ...dados, expedicoes: rest });
    }
  }

  function sair() {
    setDados(null); setCpf(""); setSenha(""); setPrecisaTrocar(false); setErro(null); setOffline(false);
  }

  // Enquanto verifica se há um snapshot salvo no aparelho, não pisca a tela de login.
  if (restaurando && !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------- Primeiro acesso: criar nova senha ----------
  if (precisaTrocar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <form onSubmit={trocarSenha} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h1 className="page-title">Crie sua senha</h1>
            <p className="page-subtitle mt-1">Primeiro acesso! Escolha uma senha só sua para as próximas vezes.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lider-nova">Nova senha</Label>
            <Input id="lider-nova" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lider-conf">Confirmar senha</Label>
            <Input id="lider-conf" type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} placeholder="Repita a senha" />
          </div>
          {erro && <p className="text-[12px] font-medium text-critico-600">{erro}</p>}
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={salvandoSenha}>
            {salvandoSenha ? "Salvando…" : "Salvar e entrar"}
          </Button>
        </form>
      </div>
    );
  }

  // ---------- Portão de CPF ----------
  if (!dados) {
    return (
      <div className="relative grid min-h-screen lg:grid-cols-2">
        <ThemeToggle className="absolute right-4 top-4 z-20" />
        <div className="incan-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <Logo tone="dark" className="h-7 w-auto" />
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

        <div className="relative z-10 flex items-center justify-center p-6">
          <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
            <a href="/login" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </a>
            <div>
              <h1 className="page-title">Área do Líder</h1>
              <p className="page-subtitle mt-1">Acesse com seu CPF e sua senha.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lider-cpf">CPF</Label>
              <Input id="lider-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Seu CPF" inputMode="numeric" autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lider-senha">Senha</Label>
              <Input id="lider-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" />
              <p className="text-[11px] text-muted-foreground">Primeiro acesso? Use a senha que a Se Tu For, Eu Vou te enviou pelo WhatsApp.</p>
            </div>
            {erro && <p className="text-[12px] font-medium text-critico-600">{erro}</p>}
            <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
              {loading ? "Buscando..." : "Entrar"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              É o CPF cadastrado como líder. No primeiro acesso, use a senha que a agência te enviou pelo WhatsApp. Só leitura.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Área do líder ----------
  return (
    <div className="relative min-h-screen bg-background">
      <div className="incan-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <header className="relative z-10 bg-brand-gradient flex items-center justify-between px-5 py-4 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoMark tone="dark" className="h-9 w-9" />
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
            onClick={alternarTema}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="inline-flex items-center justify-center rounded-lg bg-white/10 p-1.5 hover:bg-white/20"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          {!offline && (
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
          )}
          <button
            type="button"
            onClick={sair}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/20"
          >
            Sair
          </button>
        </div>
      </header>

      {offline && (
        <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-atencao-600/30 bg-atencao-50 px-5 py-2 text-[12px] text-atencao-700">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Modo offline.</span>
          <span>Mostrando {dados.expedicoes.length} expedição(ões) salva(s) neste aparelho. Conecte-se para ver ao vivo e salvar outras.</span>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-3xl space-y-4 p-4">
        {dados.expedicoes.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">
            Nenhuma expedição atribuída a você no momento.
          </p>
        ) : (() => {
          const anoAtual = new Date().getFullYear();
          const anoDe = (e: LiderExpedicao) =>
            e.data_embarque ? new Date(e.data_embarque).getFullYear() : anoAtual;
          const concluidas = dados.expedicoes.filter((e) => e.status === "Concluída");
          const naoConcluidas = dados.expedicoes.filter((e) => e.status !== "Concluída");
          const atuais = naoConcluidas.filter((e) => anoDe(e) <= anoAtual);
          const futuras = naoConcluidas.filter((e) => anoDe(e) > anoAtual);
          const anosFuturos = [...new Set(futuras.map(anoDe))].sort((a, b) => a - b);
          const renderCards = (lista: LiderExpedicao[]) =>
            lista.map((exp) => (
              <ExpedicaoLiderCard
                key={exp.id}
                exp={exp}
                onVerDoc={verDoc}
                meuNome={dados.nome}
                podeSalvar={offlineSuportado() && !offline}
                salvoEm={salvas.get(exp.id) ?? null}
                prep={prepExp && prepExp.expId === exp.id ? prepExp : null}
                onSalvar={() => salvarExpedicaoOffline(exp)}
                onRemover={() => removerExpedicaoOffline(exp.id)}
              />
            ));
          return (
            <>
              {renderCards(atuais)}
              {anosFuturos.map((ano) => (
                <GrupoBox
                  key={ano}
                  titulo={`Expedições de ${ano}`}
                  quantidade={futuras.filter((e) => anoDe(e) === ano).length}
                  aberto={gruposAbertos.has(String(ano))}
                  onToggle={() => toggleGrupo(String(ano))}
                >
                  {renderCards(futuras.filter((e) => anoDe(e) === ano))}
                </GrupoBox>
              ))}
              {concluidas.length > 0 && (
                <GrupoBox
                  titulo="Expedições passadas"
                  quantidade={concluidas.length}
                  aberto={gruposAbertos.has("passadas")}
                  onToggle={() => toggleGrupo("passadas")}
                >
                  {renderCards(concluidas)}
                </GrupoBox>
              )}
            </>
          );
        })()}
        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Visualização apenas. Para qualquer alteração, fale com a equipe da agência.
        </p>
      </main>

      {docView && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[300] flex flex-col bg-black/85" onClick={fecharDoc}>
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="min-w-0 flex-1 truncate text-[13px]" title={docView.nome}>{docView.nome}</span>
              <div className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium">
                <a
                  href={docView.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-white/15 px-2.5 py-1 hover:bg-white/25"
                >
                  Abrir em nova aba
                </a>
                <a
                  href={docView.url}
                  download={docView.nome}
                  className="rounded-md bg-white/15 px-2.5 py-1 hover:bg-white/25"
                >
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={fecharDoc}
                  className="rounded-md bg-white/15 px-2.5 py-1 hover:bg-white/25"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto p-3" onClick={(e) => e.stopPropagation()}>
              {docView.mime?.startsWith("image/") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={docView.url} alt={docView.nome} className="max-h-full max-w-full rounded-md object-contain shadow-xl" />
              ) : (
                <iframe src={docView.url} title={docView.nome} className="h-full w-full rounded-md bg-white" />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Caixa recolhível de um grupo de expedições (anos futuros / passadas). */
function GrupoBox({
  titulo, quantidade, aberto, onToggle, children,
}: {
  titulo: string;
  quantidade: number;
  aberto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="bg-brand-gradient flex w-full items-center gap-2.5 px-4 py-3 text-left text-white"
      >
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] font-semibold leading-none">{titulo}</div>
          <div className="mt-1 text-[11px] text-white/70">
            {quantidade} expediç{quantidade === 1 ? "ão" : "ões"}
          </div>
        </div>
        <span className="rounded-full bg-[var(--brand-lime)] px-2 py-0.5 text-[12px] font-bold text-[var(--brand-dark)]">
          {quantidade}
        </span>
        <ChevronRight className={cn("h-5 w-5 shrink-0 transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && <div className="space-y-3 border-t border-border bg-card p-3">{children}</div>}
    </div>
  );
}

function ExpedicaoLiderCard({
  exp, onVerDoc, meuNome, podeSalvar, salvoEm, prep, onSalvar, onRemover,
}: {
  exp: LiderExpedicao;
  onVerDoc: VerDoc;
  meuNome: string;
  podeSalvar: boolean;
  salvoEm: string | null;
  prep: { feito: number; total: number; falhas: number } | null;
  onSalvar: () => void;
  onRemover: () => void;
}) {
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
          {salvoEm && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold" title="Disponível offline neste aparelho">
              <WifiOff className="h-2.5 w-2.5" /> offline
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

      {/* Ação de offline por expedição */}
      {(podeSalvar || salvoEm) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[12px]">
          {prep ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <DownloadCloud className="h-3.5 w-3.5 animate-pulse" />
              Salvando… {prep.feito}/{prep.total}{prep.falhas ? ` (${prep.falhas} falha[s])` : ""}
            </span>
          ) : salvoEm ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-vinculado-700">
                <WifiOff className="h-3.5 w-3.5" />
                Salva offline · {new Date(salvoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
              {podeSalvar && (
                <button type="button" onClick={onSalvar} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium hover:bg-accent">
                  <RefreshCw className="h-3 w-3" /> Atualizar
                </button>
              )}
              <button type="button" onClick={onRemover} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium text-critico-600 hover:bg-accent">
                <Trash2 className="h-3 w-3" /> Remover
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSalvar}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-lime)] px-2.5 py-1 font-semibold text-[var(--brand-dark)] hover:opacity-90"
              title="Baixar esta expedição (dados + documentos) para acessar sem internet"
            >
              <DownloadCloud className="h-3.5 w-3.5" /> Salvar para offline
            </button>
          )}
        </div>
      )}

      {aberta && (
        <div className="space-y-3 p-3">
          <RoteiroLider exp={exp} meuNome={meuNome} />
          <Aniversariantes exp={exp} />
          {lideres.length > 0 && (
            <Secao titulo="Líderes" pax={lideres} onVerDoc={onVerDoc} />
          )}
          <Secao titulo={`ExpedAmigos (${amigos.length})`} pax={amigos} onVerDoc={onVerDoc} />
        </div>
      )}
    </div>
  );
}

const MESES_PT = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Aniversariantes do MÊS da expedição (cobre os dois meses quando a viagem atravessa).
 * Destaca quem faz aniversário DURANTE a viagem. Aparece na Área do Líder.
 */
function Aniversariantes({ exp }: { exp: LiderExpedicao }) {
  const [aberto, setAberto] = React.useState(false);
  const lista = exp.passageiros
    .map((p) => {
      const a = aniversarioNoMesDaExpedicao(p.data_nascimento, exp.data_embarque, exp.data_retorno);
      return a ? { p, ...a } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (!lista.length) return null;
  const meses = [...new Set(lista.map((x) => x.mes))].map((m) => MESES_PT[m]);

  return (
    <section className="overflow-hidden rounded-xl border border-lista-600/30 bg-lista-50/60 dark:bg-lista-600/10">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left"
        aria-expanded={aberto}
      >
        <span className="text-[13px] font-semibold text-lista-700 dark:text-lista-300">🎂 Aniversariantes do mês</span>
        <span className="rounded-full bg-lista-100 px-1.5 py-0.5 text-[11px] font-semibold text-lista-600">{lista.length}</span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">· {meses.join(" e ")}</span>
        <ChevronRight className={cn("ml-auto h-4 w-4 text-lista-600 transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && (
        <div className="px-3 pb-3">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Quem faz aniversário em {meses.join(" ou ")} — dá pra preparar uma surpresa. 🎉
          </p>
          <ul className="space-y-1">
            {lista.map((x) => (
              <li key={x.p.id} className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-1.5">
                <Avatar nome={x.p.nome_completo} size={22} className="shrink-0" src={x.p.foto_url ?? undefined} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{x.p.nome_completo}</span>
                {x.idade != null && <span className="shrink-0 text-[11px] text-muted-foreground">faz {x.idade}</span>}
                <span className="shrink-0 rounded-full bg-lista-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-lista-600">
                  {String(x.dia).padStart(2, "0")}/{String(x.mes).padStart(2, "0")}
                </span>
                {x.naViagem && (
                  <span
                    title="Faz aniversário durante a viagem!"
                    className="shrink-0 rounded-full bg-[var(--brand-lime)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-dark)]"
                  >
                    na viagem 🎉
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ===================== Roteiro do Líder (dia a dia operacional) =====================

type LiderDia = RoteiroLiderDiaRow;

const COR_GRUPO: Record<string, string> = {
  G1: "border-editavel-600 bg-editavel-50 text-editavel-700",
  G2: "border-lista-600 bg-lista-50 text-lista-600",
};
const corGrupo = (r: string | null) => (r && COR_GRUPO[r]) || "border-border bg-muted/40 text-muted-foreground";

const NIVEL_ALERTA: Record<string, { emoji: string; cls: string }> = {
  "Crítico": { emoji: "🔴", cls: "border-critico-600 bg-critico-50" },
  "Atenção": { emoji: "🟠", cls: "border-atencao-600 bg-atencao-50" },
  "Verificar": { emoji: "🟡", cls: "border-editavel-600 bg-editavel-50" },
};
const nomesLideres = (s: string | null) => (s ?? "").split("·").map((x) => x.trim()).filter(Boolean);
const primeiroNome = (s: string) => (s ?? "").trim().split(/\s+/)[0] ?? "";
const hojeISO = () => new Date().toISOString().slice(0, 10);

type BriefDia = {
  meuGrupo: string | null;
  meuDia: LiderDia;
  comigo: string[];
  outros: { rotulo: string | null; lideres: string[] }[];
};

function RoteiroLider({ exp, meuNome }: { exp: LiderExpedicao; meuNome: string }) {
  const [verTudo, setVerTudo] = React.useState(false);
  const roteiro = exp.roteiro;
  if (roteiro.length === 0) return null;
  const eu = primeiroNome(meuNome).toLowerCase();
  const multi = exp.grupos.length > 1;
  const hoje = hojeISO();

  // Monta o resumo PESSOAL do dia: em qual grupo VOCÊ está, com quem, e onde estão os outros.
  function brief(d: LiderDia): BriefDia {
    let meuGrupo: string | null = multi ? null : exp.grupo_rotulo;
    let meuDia: LiderDia = d;
    if (multi && d.data) {
      for (const g of exp.grupos) {
        const gd = g.dias.find((x) => x.data === d.data);
        if (gd && nomesLideres(gd.lideres_ativos).some((n) => n.toLowerCase() === eu)) {
          meuGrupo = g.rotulo;
          meuDia = gd;
        }
      }
    }
    const comigo = nomesLideres(meuDia.lideres_ativos).filter((n) => n.toLowerCase() !== eu);
    const outros = multi
      ? exp.grupos
          .filter((g) => g.rotulo !== meuGrupo)
          .map((g) => ({ rotulo: g.rotulo, lideres: d.data ? nomesLideres(g.dias.find((x) => x.data === d.data)?.lideres_ativos ?? null) : [] }))
          .filter((o) => o.lideres.length > 0)
      : [];
    return { meuGrupo, meuDia, comigo, outros };
  }

  const diaHoje = roteiro.find((d) => d.data === hoje);
  const proximo = roteiro.find((d) => d.data && d.data >= hoje);
  const foco = diaHoje ?? proximo ?? roteiro[0];
  const focoLabel = diaHoje ? "HOJE" : proximo ? "A SEGUIR" : "";

  return (
    <div className="space-y-2.5">
      {foco && <DiaBrief dia={foco} info={brief(foco)} multi={multi} destaque label={focoLabel} />}

      <Recolhivel
        titulo={`Todos os dias (${roteiro.length})`}
        icone={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
        aberto={verTudo}
        onToggle={() => setVerTudo((v) => !v)}
      >
        <div className="space-y-1.5">
          {roteiro.map((d) => <DiaBrief key={d.id} dia={d} info={brief(d)} multi={multi} hoje={d.data === hoje} />)}
        </div>
      </Recolhivel>
    </div>
  );
}

function Recolhivel({ titulo, icone, aberto, onToggle, children }: { titulo: string; icone: React.ReactNode; aberto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        {icone}
        <span className="flex-1 text-[12px] font-semibold">{titulo}</span>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && <div className="border-t border-border p-2.5">{children}</div>}
    </div>
  );
}

function DiaBrief({ dia, info, multi, destaque, label, hoje }: { dia: LiderDia; info: BriefDia; multi: boolean; destaque?: boolean; label?: string; hoje?: boolean }) {
  const [aberto, setAberto] = React.useState(!!destaque);
  const md = info.meuDia;
  const nivel = md.alerta_nivel ? NIVEL_ALERTA[md.alerta_nivel] : null;
  const localFase = md.local || dia.fase;
  return (
    <div className={cn("overflow-hidden rounded-xl border", destaque ? "border-[var(--brand-lime-deep)] bg-[var(--brand-lime)]/10 shadow-sm" : hoje ? "border-[var(--brand-lime-deep)]" : "border-border bg-background")}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left">
        <div className="flex w-9 shrink-0 flex-col items-center rounded-lg bg-[var(--brand-dark)] py-1 text-white">
          <span className="text-[8px] font-bold uppercase leading-none text-[var(--brand-lime)]">Dia</span>
          <span className="font-display text-[16px] font-bold leading-tight">{dia.dia}</span>
        </div>
        <div className="min-w-0 flex-1">
          {label && (
            <span className="mb-1 inline-block rounded bg-[var(--brand-lime)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--brand-dark)]">{label}</span>
          )}
          <div className="text-[11px] text-muted-foreground">
            {dia.data ? formatDate(dia.data) : ""}{localFase ? ` · ${localFase}` : ""}
          </div>
          <div className="text-[13px] font-semibold leading-snug">{md.programacao ?? "—"}</div>
          {multi && info.meuGrupo && (
            <div className="mt-1 text-[12px]">
              Você fica com o{" "}
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-bold", corGrupo(info.meuGrupo))}>{info.meuGrupo}</span>
            </div>
          )}
          {multi && !info.meuGrupo && <div className="mt-1 text-[12px] text-muted-foreground">Você não acompanha o grupo neste dia.</div>}
        </div>
        {nivel && <span className="shrink-0 text-[13px]" title={md.alerta_nivel ?? ""}>{nivel.emoji}</span>}
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && (
        <div className="space-y-1.5 border-t border-border px-3 py-2.5 text-[12px]">
          {md.pax && <div className="text-muted-foreground">{md.pax} passageiros com você.</div>}
          {info.comigo.length > 0 && (
            <div><span className="text-muted-foreground">Com você:</span> <span className="font-semibold">{info.comigo.join(" · ")}</span></div>
          )}
          {info.outros.map((o) => (
            <div key={o.rotulo ?? "x"}>
              <span className="text-muted-foreground">No </span>
              <span className={cn("rounded border px-1 py-0.5 text-[10px] font-bold", corGrupo(o.rotulo))}>{o.rotulo}</span>
              <span>: {o.lideres.join(" · ")}</span>
            </div>
          ))}
          {md.observacoes && <p className="whitespace-pre-line text-muted-foreground">{md.observacoes}</p>}
          {nivel && md.alerta_texto && (
            <div className={cn("rounded-lg border-l-4 p-2", nivel.cls)}>
              <div className="text-[11px] font-bold">{nivel.emoji} Atenção</div>
              <div className="mt-0.5">{md.alerta_texto}</div>
              {md.alerta_acao && <div className="mt-1"><span className="font-semibold">O que fazer:</span> {md.alerta_acao}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const prioridadeGrupoPax = (p: LiderPax) => (p.grupo === "G1" ? 0 : p.grupo === "G2" ? 1 : 2);

function Secao({ titulo, pax, onVerDoc }: { titulo: string; pax: LiderPax[]; onVerDoc: VerDoc }) {
  // G1 em cima, G2 embaixo, sem grupo por último; nome preserva a ordem já vinda.
  const ordenados = [...pax].sort((a, b) => prioridadeGrupoPax(a) - prioridadeGrupoPax(b));
  const distintos = new Set(ordenados.map((p) => p.grupo ?? "—"));
  const separar = distintos.size > 1;
  let ultimo: string | null | undefined;
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className="space-y-1.5">
        {ordenados.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Ninguém ainda.</p>
        ) : (
          ordenados.flatMap((p) => {
            const nodes = [];
            if (separar && p.grupo !== ultimo) {
              ultimo = p.grupo;
              const qtd = ordenados.filter((x) => x.grupo === p.grupo).length;
              nodes.push(
                <div key={`div-${p.grupo ?? "sem"}`} className={cn("mt-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", corGrupo(p.grupo))}>
                  {p.grupo === "G1" ? "Grupo 1 (G1)" : p.grupo === "G2" ? "Grupo 2 (G2)" : "Sem grupo"} · {qtd}
                </div>,
              );
            }
            nodes.push(<PaxLiderRow key={p.id} p={p} onVerDoc={onVerDoc} />);
            return nodes;
          })
        )}
      </div>
    </div>
  );
}

function PaxLiderRow({ p, onVerDoc }: { p: LiderPax; onVerDoc: VerDoc }) {
  const [aberto, setAberto] = React.useState(false);
  const [dadosAbertos, setDadosAbertos] = React.useState(false);
  const [saudeAberta, setSaudeAberta] = React.useState(false);
  // Documentos que não estão ligados a nenhuma exigência exibida.
  const outros = p.arquivos.filter((a) => !p.checagens.some((c) => c.arquivos.some((x) => x.id === a.id)));
  const saudeFlags = resumoSaude(p.saude);
  const saudeAlertas = saudeFlags.filter((f) => f.alerta).length;
  return (
    <div className="rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <Avatar nome={p.nome_completo} size={28} className="shrink-0" src={p.foto_url ?? undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium">{p.nome_completo}</span>
            {p.grupo && (
              <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none", corGrupo(p.grupo))}>
                {p.grupo}
              </span>
            )}
          </div>
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

          {/* Saúde (questionário da inscrição) — só os pontos sinalizados */}
          <div>
            <button
              type="button"
              onClick={() => setSaudeAberta((v) => !v)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-editavel-700"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", saudeAberta && "rotate-90")} />
              Saúde
              {saudeAlertas > 0 && <Badge variant="atencao">{saudeAlertas}</Badge>}
            </button>
            {saudeAberta && (
              saudeFlags.length === 0 ? (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {p.saude ? "Sem apontamentos de saúde." : "Questionário de saúde não preenchido."}
                </p>
              ) : (
                <ul className="mt-1 space-y-1.5 rounded-lg border border-border bg-muted/20 p-2.5">
                  {saudeFlags.map((f, i) => (
                    <li key={i} className="text-[12px]">
                      <div className="flex items-start gap-2">
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", f.alerta ? "bg-atencao-600" : "bg-vinculado-600")} />
                        <span>
                          <span className="font-medium">{f.curto}</span>
                          {f.detalhe && <span className="text-muted-foreground"> — {f.detalhe}</span>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          {/* Quarto (alocação real do Rooming) + com quem divide */}
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quarto</div>
            {p.quartos_alocados.length > 0 ? (
              <div className="space-y-0.5 rounded-lg border border-border bg-muted/20 p-2.5 text-[12px]">
                {p.quartos_alocados.map((q, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{q.hotel ?? "Hotel"}</span>
                    <span className="font-medium">Quarto {q.numero} ({q.tipo})</span>
                  </div>
                ))}
                <div className="pt-0.5">
                  <span className="text-muted-foreground">Divide com: </span>
                  <span className="font-medium">{p.companheiros_quarto.length > 0 ? p.companheiros_quarto.join(", ") : "sozinho no quarto"}</span>
                </div>
                {p.acompanhante_nome?.trim() && (() => {
                  const status = conferirAcompanhante(p.acompanhante_nome, p.companheiros_quarto);
                  return (
                    <div className={cn("pt-0.5 text-[11px]", status === "bate" ? "text-vinculado-600" : "text-atencao-700")}>
                      {status === "bate" ? "✓ Bate com o indicado" : "⚠ Não bate"} — indicou: {p.acompanhante_nome.trim()}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {p.acompanhante_nome?.trim()
                  ? `Ainda não alocado. Indicou: ${p.acompanhante_nome.trim()}`
                  : "Ainda não alocado em nenhum quarto."}
              </p>
            )}
          </div>

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
      <button type="button" onClick={() => onVerDoc(a)} className="font-medium text-editavel-700 hover:underline">Abrir</button>
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
