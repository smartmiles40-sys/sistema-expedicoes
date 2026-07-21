"use client";
import * as React from "react";
import {
  CompassIcon, MapPin, Calendar, Plane, LinkIcon, BedDouble, ExternalLink,
  CalendarDays, Ticket, Info, ChevronRight, Megaphone, Download, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import {
  entrarExpedAmigo, definirSenhaExpedAmigo,
  type AmigoDados, type AmigoExpedicao, type AmigoRoteiroDia,
} from "./actions";
import { Logo } from "@/components/ui/Logo";
import { useTheme } from "@/components/layout/ThemeProvider";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { heroDoDestino, diaImgFallback, HERO_SLIDESHOW } from "./fotos";

const STORAGE_KEY = "expedamigo-sessao";

// CPF: texto livre que vira XXX.XXX.XXX-XX (11 dígitos) enquanto digita.
function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Seções presentes numa expedição — alimenta a barra de navegação do header. */
function secoesDaExp(exp: AmigoExpedicao): { id: string; label: string }[] {
  const s = (k: string) => `${k}-${exp.id}`;
  const out: { id: string; label: string }[] = [];
  if (exp.roteiro.length > 0) out.push({ id: s("roteiro"), label: "Roteiro" });
  out.push({ id: s("vouchers"), label: "Vouchers" });
  if (exp.links.length > 0) out.push({ id: s("links"), label: "Links" });
  if (exp.info.length > 0) out.push({ id: s("info"), label: "Informações" });
  if (exp.avisos.length > 0) out.push({ id: s("avisos"), label: "Avisos" });
  return out;
}

export default function AmigoPage() {
  const { theme } = useTheme();
  const [cpf, setCpf] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [dados, setDados] = React.useState<AmigoDados | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  // Verificando se há sessão salva (evita piscar o login ao dar refresh).
  const [checando, setChecando] = React.useState(true);
  // Primeiro acesso: forçar criar uma nova senha antes de entrar.
  const [precisaTrocar, setPrecisaTrocar] = React.useState(false);
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmaSenha, setConfirmaSenha] = React.useState("");
  const [salvandoSenha, setSalvandoSenha] = React.useState(false);
  // Viagem aberta (null = tela inicial com a lista de expedições).
  const [selecionadaId, setSelecionadaId] = React.useState<string | null>(null);

  // Ao carregar, tenta restaurar a sessão salva (CPF + nascimento) e re-buscar.
  React.useEffect(() => {
    let ativo = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as { cpf?: string; senha?: string; nascimento?: string }) : null;
      const senhaSalva = saved?.senha ?? saved?.nascimento; // migra sessões antigas
      if (saved?.cpf && senhaSalva) {
        setCpf(mascaraCpf(saved.cpf));
        setSenha(senhaSalva);
        entrarExpedAmigo(saved.cpf, senhaSalva)
          .then((r) => {
            if (!ativo) return;
            if (r.ok) { setDados(r.dados); setPrecisaTrocar(r.precisaTrocar); }
            else localStorage.removeItem(STORAGE_KEY);
          })
          .finally(() => ativo && setChecando(false));
        return;
      }
    } catch {
      /* localStorage indisponível — segue sem sessão */
    }
    setChecando(false);
    return () => { ativo = false; };
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const r = await entrarExpedAmigo(cpf, senha);
    setLoading(false);
    if (r.ok) {
      setDados(r.dados);
      setPrecisaTrocar(r.precisaTrocar);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ cpf, senha })); } catch { /* ignore */ }
    } else {
      setErro(r.error);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.trim().length < 6) return setErro("A nova senha precisa ter pelo menos 6 caracteres.");
    if (novaSenha !== confirmaSenha) return setErro("As senhas não conferem.");
    setSalvandoSenha(true);
    const r = await definirSenhaExpedAmigo(cpf, senha, novaSenha);
    setSalvandoSenha(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível salvar a senha.");
    setSenha(novaSenha);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ cpf, senha: novaSenha })); } catch { /* ignore */ }
    setNovaSenha(""); setConfirmaSenha("");
    setPrecisaTrocar(false);
    toast.success("Senha criada! Boa viagem. 🎉");
  }

  function sair() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setDados(null);
    setCpf("");
    setSenha("");
    setPrecisaTrocar(false);
    setNovaSenha(""); setConfirmaSenha("");
    setErro(null);
    setSelecionadaId(null);
  }

  // ---------- Restaurando sessão ----------
  if (checando) {
    return (
      <div data-theme="light" className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <CompassIcon className="h-7 w-7 animate-pulse text-[var(--brand-dark)]" />
          <span className="text-[13px]">Entrando…</span>
        </div>
      </div>
    );
  }

  // ---------- Primeiro acesso: criar nova senha ----------
  if (precisaTrocar) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--portal-bg)] p-6 text-foreground">
        <ThemeToggle className="absolute right-4 top-4 z-20" />
        <div className="incan-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <form onSubmit={trocarSenha} className="relative w-full max-w-sm space-y-4">
          <Logo tone={theme === "dark" ? "dark" : "light"} className="h-6 w-auto" />
          <div>
            <h1 className="page-title">Crie sua senha</h1>
            <p className="page-subtitle mt-1">Primeiro acesso! Escolha uma senha só sua para as próximas vezes.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input id="nova-senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus className="border-[var(--portal-border)] bg-[var(--portal-panel)] text-[var(--portal-fg)] placeholder:text-[var(--portal-fg-soft)]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="conf-senha">Confirmar senha</Label>
            <Input id="conf-senha" type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} placeholder="Repita a senha" className="border-[var(--portal-border)] bg-[var(--portal-panel)] text-[var(--portal-fg)] placeholder:text-[var(--portal-fg-soft)]" />
          </div>
          {erro && <p className="text-[12px] font-medium text-critico-600">{erro}</p>}
          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={salvandoSenha}>
            {salvandoSenha ? "Salvando…" : "Salvar e entrar"}
          </Button>
        </form>
      </div>
    );
  }

  // ---------- Portão de acesso ----------
  if (!dados) {
    return (
      <div className="relative grid min-h-screen bg-background text-foreground lg:grid-cols-2">
        <ThemeToggle className="absolute right-4 top-4 z-20" />
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <HeaderSlideshow imagens={HERO_SLIDESHOW} />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-dark)]/45 via-[var(--brand-dark)]/65 to-[var(--brand-dark)]/95" />
          <Logo tone="dark" className="relative z-10 h-7 w-auto" />
          <div className="relative z-10 max-w-md">
            <h2 className="font-display text-4xl font-semibold leading-[1.1] text-white">
              Sua próxima aventura começa aqui.
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/80">
              Tudo sobre a sua viagem num lugar só: voos, hospedagem e as informações
              que você precisa para embarcar tranquilo.
            </p>
          </div>
          <p className="relative z-10 text-xs text-white/60">Espaço do viajante</p>
        </div>

        <div className="relative flex items-center justify-center overflow-hidden bg-[var(--portal-bg)] p-6 text-foreground">
          <div className="incan-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <form onSubmit={entrar} className="relative w-full max-w-sm space-y-4">
            <div className="lg:hidden">
              <Logo tone={theme === "dark" ? "dark" : "light"} className="h-6 w-auto" />
            </div>
            <div>
              <h1 className="page-title">Minha Viagem</h1>
              <p className="page-subtitle mt-1">Acesse com seu CPF e sua senha.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amigo-cpf">CPF</Label>
              <Input
                id="amigo-cpf"
                value={cpf}
                onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
                autoFocus
                className="border-[var(--portal-border)] bg-[var(--portal-panel)] text-[var(--portal-fg)] placeholder:text-[var(--portal-fg-soft)]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amigo-senha">Senha</Label>
              <Input
                id="amigo-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="border-[var(--portal-border)] bg-[var(--portal-panel)] text-[var(--portal-fg)] placeholder:text-[var(--portal-fg-soft)]"
              />
              <p className="text-[11px] text-[var(--portal-fg-soft)]">Primeiro acesso? Use a senha que a Se Tu For, Eu Vou te enviou pelo WhatsApp.</p>
            </div>
            {erro && <p className="text-[12px] font-medium text-critico-600">{erro}</p>}
            <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Acessar minha viagem"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              É o mesmo CPF da sua reserva. No primeiro acesso, use a senha que a agência te enviou pelo WhatsApp.
              Algum dado não confere? Fale com a agência.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Área do viajante ----------
  const selecionada = selecionadaId ? dados.expedicoes.find((e) => e.id === selecionadaId) ?? null : null;
  const secoes = selecionada ? secoesDaExp(selecionada) : [];

  return (
    <div className="min-h-screen bg-[var(--portal-bg)]">
      {/* Cabeçalho flutuante translúcido — fica por cima do hero */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5 text-[var(--portal-fg)]">
          <button type="button" onClick={() => setSelecionadaId(null)} className="flex items-center gap-2" aria-label="Minhas viagens">
            {selecionada && <ArrowLeft className="h-4 w-4 text-[var(--portal-fg-soft)]" />}
            <Logo tone={theme === "dark" ? "dark" : "light"} className="h-5 w-auto" />
          </button>
          <div className="flex items-center gap-3">
            {!selecionada && <span className="hidden text-[12px] text-[var(--portal-fg-soft)] sm:inline">Olá, {dados.primeiro_nome} 👋</span>}
            <ThemeToggle className="h-8 w-8" />
            <button
              type="button"
              onClick={sair}
              className="rounded-full bg-[var(--portal-panel)] px-3 py-1.5 text-[12px] font-medium hover:opacity-80"
            >
              Sair
            </button>
          </div>
        </div>
        {selecionada && secoes.length > 1 && (
          <nav className="border-t border-[var(--portal-border)]">
            <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4 py-2">
              {secoes.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="shrink-0 rounded-full border border-[var(--portal-border)] bg-[var(--portal-panel)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--portal-fg-soft)] transition-colors hover:bg-[var(--brand-lime)] hover:text-[var(--brand-dark)]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {selecionada ? (
        <main>
          <ViagemExperiencia exp={selecionada} nome={dados.nome} />
          <footer className="bg-brand-gradient px-4 py-12 text-center text-white">
            <p className="font-display text-2xl font-semibold">Nós cuidamos de tudo. Você só embarca.</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-white/70">
              Dúvidas sobre a sua viagem? Fale com a equipe da agência — estamos com você do sonho ao embarque.
            </p>
          </footer>
        </main>
      ) : (
        <HomeExpedicoes dados={dados} onAbrir={setSelecionadaId} />
      )}
    </div>
  );
}

function ViagemExperiencia({ exp, nome }: { exp: AmigoExpedicao; nome: string }) {
  const [gerandoPdf, setGerandoPdf] = React.useState(false);
  const dias = daysUntil(exp.data_embarque);
  // Foto de capa do header: a imagem icônica do destino (Machu Picchu, no Peru);
  // se o destino não tiver imagem mapeada, cai na 1ª foto do roteiro.
  const heroImg = heroDoDestino(exp.destino) ?? exp.roteiro.flatMap((d) => d.fotos).map((f) => f.url).find(Boolean) ?? null;
  const cidades = [...new Set(exp.roteiro.map((d) => d.cidade).filter(Boolean))].slice(0, 6) as string[];
  const ano = (exp.data_embarque ?? "").slice(0, 4);

  async function baixarPdf() {
    setGerandoPdf(true);
    try {
      const { gerarPdfViagem } = await import("./ViagemPDF");
      const blob = await gerarPdfViagem(exp, nome);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exp.nome.replace(/[^\w\-]+/g, "_") || "viagem"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o PDF", { description: "Tente novamente em instantes." });
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <section>
      {/* ===== HERO cinematográfico: foto + Ken Burns + grão + serifa gigante ===== */}
      <div className="grain-subtle relative flex min-h-screen items-center overflow-hidden bg-[var(--brand-dark)]">
        <div className="absolute inset-0 z-0 overflow-hidden">
          {heroImg ? (
            <div className="ken-burns absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImg} alt={exp.nome} className="h-full w-full object-cover" />
            </div>
          ) : null}
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[var(--brand-dark)]/55 via-[var(--brand-dark)]/70 to-[var(--brand-dark)]/95" />
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-[var(--brand-dark)]/40 via-transparent to-[var(--brand-dark)]/40" />

        {ano && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] flex select-none items-center justify-center overflow-hidden">
            <span className="num-stamp text-white" style={{ fontSize: "clamp(15rem, 46vw, 40rem)", WebkitTextStroke: "2px rgba(248,246,247,0.35)", opacity: 0.06 }}>
              {ano}
            </span>
          </div>
        )}

        <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-24 text-center text-white drop-shadow-[0_2px_12px_rgba(9,40,43,0.5)]">
          <div className="animate-fade-up eyebrow justify-center text-[var(--brand-lime)]" style={{ animationDelay: "0.05s" }}>
            {formatDate(exp.data_embarque)} — {formatDate(exp.data_retorno)}
          </div>

          <h1 className="font-display mt-7 font-bold leading-[0.95] tracking-[-0.02em]">
            <span className="animate-fade-up block text-[clamp(1.6rem,5vw,3rem)] font-normal italic text-white/95" style={{ animationDelay: "0.15s" }}>
              Sua expedição
            </span>
            <span className="animate-fade-up mt-1 block text-[clamp(2.6rem,9vw,6rem)] font-black leading-[0.95]" style={{ animationDelay: "0.28s" }}>
              {exp.nome}
            </span>
          </h1>

          <div className="animate-fade-up mx-auto mt-8 h-[2px] w-24 bg-[var(--brand-lime)] md:w-32" style={{ animationDelay: "0.5s" }} />

          <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[14px] text-white/85" style={{ animationDelay: "0.6s" }}>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[var(--brand-lime)]" /> {exp.destino}</span>
            {dias != null && dias >= 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[var(--brand-lime)]" /> {dias === 0 ? "É hoje! 🎉" : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`}
              </span>
            )}
          </div>

          <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.75s" }}>
            <a
              href={`#roteiro-${exp.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-lime)] px-7 py-3.5 text-[14px] font-semibold text-[var(--brand-dark)] shadow-[0_12px_40px_-8px_rgba(215,242,100,0.45)] transition-transform hover:scale-[1.02]"
            >
              Ver o roteiro <ChevronRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={baixarPdf}
              disabled={gerandoPdf}
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/25 px-7 py-3.5 text-[14px] font-semibold text-white transition-colors hover:border-white/60 disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> {gerandoPdf ? "Gerando PDF…" : "Baixar PDF"}
            </button>
          </div>

          {cidades.length > 0 && (
            <div className="animate-fade-up mt-12 flex flex-wrap justify-center gap-2.5" style={{ animationDelay: "0.95s" }}>
              {cidades.map((c) => (
                <span key={c} className="rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div aria-hidden className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/55">Role para descobrir</span>
          <div className="flex h-9 w-[22px] items-start justify-center rounded-full border-2 border-white/40 p-1.5">
            <span className="scroll-hint-dot h-2 w-1 rounded-full bg-white/80" />
          </div>
        </div>
      </div>

      {/* Conteúdo da viagem (fundo teal com textura orgânica) */}
      <div className="relative bg-[var(--portal-bg)]">
        <div className="incan-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-3xl space-y-10 px-4 py-12">
        {/* Roteiro dia a dia */}
        {exp.roteiro.length > 0 && (
          <Bloco id={`roteiro-${exp.id}`} icone={<CalendarDays className="h-4 w-4" />} titulo="Roteiro dia a dia" sub="O previsto para cada dia da sua jornada.">
            <ol className="space-y-5">
              {exp.roteiro.map((d, i) => (
                <DiaRoteiro key={i} d={d} destino={exp.destino} />
              ))}
            </ol>
          </Bloco>
        )}

        {/* Vouchers — voos + passeios/ingressos + hospedagem num só item */}
        <Bloco id={`vouchers-${exp.id}`} icone={<Ticket className="h-4 w-4" />} titulo="Vouchers">
          <div className="space-y-4">
            {/* Voos */}
            <div>
              <SubTitulo icone={<Plane className="h-3.5 w-3.5" />}>Voos</SubTitulo>
              {exp.voos_grupo.length > 0 && (
                <ul className="space-y-1.5">
                  {exp.voos_grupo.map((v, i) => (
                    <li key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-[13px] font-medium">
                        <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px]">{v.trecho}</span>
                        {v.origem ?? "—"} → {v.destino ?? "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {[v.companhia, v.numero_voo].filter(Boolean).join(" ")}
                        {v.partida ? ` · Partida: ${v.partida}` : ""}
                        {v.chegada ? ` · Chegada: ${v.chegada}` : ""}
                      </div>
                      {v.observacoes && <div className="mt-0.5 text-[11px] text-muted-foreground">{v.observacoes}</div>}
                      {v.voucher_url && <VoucherLink url={v.voucher_url} />}
                    </li>
                  ))}
                </ul>
              )}
              {(exp.voo.companhia || exp.voo.localizador) && (
                <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-editavel-50 px-3 py-2">
                  <Campo label="Sua companhia" valor={exp.voo.companhia} />
                  <Campo label="Seu localizador" valor={exp.voo.localizador} mono />
                </div>
              )}
              {exp.voos_grupo.length === 0 && !exp.voo.companhia && !exp.voo.localizador && (
                <p className="text-[12px] text-muted-foreground">
                  As informações dos seus voos serão disponibilizadas aqui em breve.
                </p>
              )}
              {exp.voo.voo_interno_necessario && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-editavel-50 px-2 py-1 text-[11px] font-medium text-editavel-700">
                  <Plane className="h-3 w-3" /> Esta viagem inclui voo interno no destino.
                </p>
              )}
            </div>

            {/* Passeios e ingressos */}
            {exp.passeios.length > 0 && (
              <div>
                <SubTitulo icone={<Ticket className="h-3.5 w-3.5" />}>Passeios e ingressos</SubTitulo>
                <ul className="space-y-1.5">
                  {exp.passeios.map((p, i) => (
                    <li key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-[13px] font-medium">{p.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[p.data ? formatDate(p.data) : null, p.horario, p.local].filter(Boolean).join(" · ")}
                      </div>
                      {p.observacoes && <div className="mt-0.5 text-[11px] text-muted-foreground">{p.observacoes}</div>}
                      {p.voucher_url && <VoucherLink url={p.voucher_url} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ingressos de Machu Picchu (só os do próprio passageiro) */}
            {(exp.ingressos_mp.length > 0 || exp.ingressos_trem.length > 0) && (
              <div>
                <SubTitulo icone={<Ticket className="h-3.5 w-3.5" />}>Ingressos de Machu Picchu</SubTitulo>
                <div className="space-y-2">
                  {exp.ingressos_mp.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {exp.ingressos_mp.map((ing, i) => <IngressoLink key={i} ing={ing} />)}
                    </div>
                  )}
                  {exp.ingressos_trem.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {exp.ingressos_trem.map((ing, i) => <IngressoLink key={i} ing={ing} />)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hospedagem / quarto */}
            <div>
              <SubTitulo icone={<BedDouble className="h-3.5 w-3.5" />}>Hospedagem</SubTitulo>
              {exp.hospedagem_voucher_url && <div className="mb-2"><VoucherLink url={exp.hospedagem_voucher_url} /></div>}
              {exp.quartos.length > 0 ? (
                <ul className="space-y-1.5">
                  {exp.quartos.map((q, i) => (
                    <li key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-[13px] font-medium">
                        {q.hotel_cidade ?? "Hospedagem"} · Quarto {q.numero}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {q.tipo}
                        {(q.check_in || q.check_out) &&
                          ` · ${q.check_in ? formatDate(q.check_in) : "—"} → ${q.check_out ? formatDate(q.check_out) : "—"}`}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  Sua hospedagem será confirmada aqui antes do embarque.
                </p>
              )}
            </div>
          </div>
        </Bloco>

        {/* Links úteis */}
        {exp.links.length > 0 && (
          <Bloco id={`links-${exp.id}`} icone={<LinkIcon className="h-4 w-4" />} titulo="Links úteis">
            <div className="flex flex-wrap gap-2">
              {exp.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-editavel-700 hover:bg-accent"
                >
                  {l.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </Bloco>
        )}

        {/* Informações do destino */}
        {exp.info.length > 0 && (
          <Bloco id={`info-${exp.id}`} icone={<Info className="h-4 w-4" />} titulo="Informações do destino">
            <div className="space-y-2">
              {exp.info.map((b, i) => (
                <div key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[12px] font-semibold">{emojiInfo(b.titulo)} {b.titulo}</div>
                  <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{b.conteudo}</p>
                  {b.pdfs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {b.pdfs.map((pdf, j) => (
                        <a
                          key={j}
                          href={pdf.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-editavel-700 hover:bg-accent"
                        >
                          <Download className="h-3 w-3" /> {pdf.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Bloco>
        )}

        {/* Avisos e boas práticas */}
        {exp.avisos.length > 0 && (
          <Bloco id={`avisos-${exp.id}`} icone={<Megaphone className="h-4 w-4" />} titulo="Avisos e boas práticas">
            <div className="space-y-2">
              {exp.avisos.map((a, i) => {
                const cfg = AVISO_CFG[a.tipo] ?? AVISO_CFG.Aviso;
                return (
                  <div key={i} className={cn("rounded-lg border-l-4 bg-background px-3 py-2", cfg.border)}>
                    <div className="inline-flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                      <span>{emojiAviso(a.titulo, a.tipo)}</span> {a.titulo}
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", cfg.badge)}>{a.tipo}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{a.conteudo}</p>
                  </div>
                );
              })}
            </div>
          </Bloco>
        )}
        </div>
      </div>
    </section>
  );
}

/** Slideshow de fundo (crossfade) com as fotos das expedições da agência. */
function HeaderSlideshow({ imagens }: { imagens: string[] }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (imagens.length < 2) return;
    const id = setInterval(() => setI((p) => (p + 1) % imagens.length), 5000);
    return () => clearInterval(id);
  }, [imagens.length]);
  return (
    <div className="absolute inset-0">
      {imagens.map((src, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]",
            idx === i ? "opacity-100 ken-burns" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

/** Tela inicial: saudação + grade das próximas expedições da pessoa. */
function HomeExpedicoes({ dados, onAbrir }: { dados: AmigoDados; onAbrir: (id: string) => void }) {
  return (
    <>
      {/* Header com a foto do Machu Picchu (mesma capa do site) */}
      <div className="relative flex min-h-[44vh] items-end overflow-hidden bg-[var(--brand-dark)]">
        <HeaderSlideshow imagens={HERO_SLIDESHOW} />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-dark)] via-[var(--brand-dark)]/65 to-[var(--brand-dark)]/30" />
        <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-9 pt-24 text-white drop-shadow-[0_2px_12px_rgba(9,40,43,0.55)]">
          <span className="eyebrow text-[var(--brand-lime)]">Espaço do viajante</span>
          <h1 className="font-display mt-3 text-4xl font-bold leading-tight sm:text-5xl">Olá, {dados.primeiro_nome} 👋</h1>
          <p className="mt-2 text-[14px] text-white/90">
            {dados.expedicoes.length === 1
              ? "Toque na sua expedição para ver todos os detalhes."
              : "Escolha uma expedição para ver todos os detalhes."}
          </p>
        </div>
      </div>
      <div className="relative bg-[var(--portal-bg)]">
        <div className="incan-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <main className="relative mx-auto max-w-4xl px-4 pb-16 pt-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {dados.expedicoes.map((exp) => (
              <CardExpedicaoHome key={exp.id} exp={exp} onAbrir={onAbrir} />
            ))}
          </div>
        </main>
      </div>
    </>
  );
}

/** Card de uma expedição na tela inicial (foto + nome + datas + contador). */
function CardExpedicaoHome({ exp, onAbrir }: { exp: AmigoExpedicao; onAbrir: (id: string) => void }) {
  const img = heroDoDestino(exp.destino) ?? exp.roteiro.flatMap((d) => d.fotos).map((f) => f.url).find(Boolean) ?? null;
  const dias = daysUntil(exp.data_embarque);
  return (
    <button
      type="button"
      onClick={() => onAbrir(exp.id)}
      className="group relative flex min-h-[260px] items-end overflow-hidden rounded-3xl text-left shadow-[0_8px_30px_rgba(9,40,43,0.12)]"
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={exp.nome} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <div className="bg-brand-gradient absolute inset-0" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09282B] via-[#09282B]/40 to-transparent" />
      <div className="relative z-10 w-full p-5 text-white">
        {dias != null && dias >= 0 && (
          <span className="inline-block rounded-full bg-[var(--brand-lime)] px-3 py-1 text-[11px] font-bold text-[var(--brand-dark)]">
            {dias === 0 ? "É hoje! 🎉" : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`}
          </span>
        )}
        <h3 className="font-display mt-3 text-2xl font-bold leading-tight">{exp.nome}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/85">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {exp.destino}</span>
          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {formatDate(exp.data_embarque)} → {formatDate(exp.data_retorno)}</span>
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--brand-lime)]">
          Abrir viagem <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

const AVISO_CFG: Record<string, { emoji: string; border: string; badge: string }> = {
  "Aviso": { emoji: "⚠️", border: "border-atencao-600", badge: "bg-atencao-100 text-atencao-600" },
  "Boa prática": { emoji: "✅", border: "border-vinculado-600", badge: "bg-vinculado-100 text-vinculado-600" },
  "Dica": { emoji: "💡", border: "border-editavel-600", badge: "bg-editavel-100 text-editavel-600" },
};

/** Emoji temático para um bloco de "Informações do destino" (pelo título). */
function emojiInfo(titulo: string): string {
  const t = (titulo ?? "").toLowerCase();
  if (t.includes("document")) return "🛂";
  if (t.includes("vacina") || t.includes("saúde") || t.includes("saude")) return "💉";
  if (t.includes("seguro") || t.includes("telemedicina")) return "🛡️";
  if (t.includes("altitude") || t.includes("soroche")) return "⛰️";
  if (t.includes("clima")) return "🌤️";
  if (t.includes("moeda") || t.includes("câmbio") || t.includes("cambio")) return "💵";
  if (t.includes("tomada") || t.includes("energia") || t.includes("volt")) return "🔌";
  if (t.includes("fuso") || t.includes("horár") || t.includes("horar")) return "🕐";
  if (t.includes("internet") || t.includes("chip") || t.includes("e-sim")) return "📱";
  if (t.includes("levar") || t.includes("bagagem") || t.includes("mala")) return "🎒";
  return "📍";
}

/** Emoji temático para um aviso (pelo título), com fallback ao emoji do tipo. */
function emojiAviso(titulo: string, tipo: string): string {
  const t = (titulo ?? "").toLowerCase();
  if (t.includes("document") || t.includes("passaporte")) return "🛂";
  if (t.includes("whatsapp") || t.includes("grupo de")) return "💬";
  if (t.includes("levar") || t.includes("camada") || t.includes("roupa") || t.includes("mala")) return "🧳";
  if (t.includes("desloca") || t.includes("táxi") || t.includes("taxi") || t.includes("uber")) return "🚕";
  if (t.includes("segur")) return "🛡️";
  if (t.includes("dinheiro") || t.includes("moeda") || t.includes("câmbio")) return "💵";
  if (t.includes("altitude") || t.includes("soroche")) return "⛰️";
  return (AVISO_CFG[tipo] ?? AVISO_CFG.Aviso).emoji;
}

/** Um dia do roteiro — card editorial com foto, recolhível (toca no banner). */
function DiaRoteiro({ d, destino }: { d: AmigoRoteiroDia; destino: string }) {
  const [aberto, setAberto] = React.useState(false);
  const img = d.fotos[0]?.url ?? diaImgFallback(destino, d.dia);
  const extras = d.fotos.slice(1);
  const temDetalhe = Boolean(d.descricao || d.refeicoes || d.hospedagem || extras.length);
  return (
    <li className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(9,40,43,0.10)]">
      {/* Banner clicável (foto ou gradiente + número gigante) */}
      <button
        type="button"
        onClick={() => temDetalhe && setAberto((v) => !v)}
        aria-expanded={aberto}
        className="relative block h-52 w-full overflow-hidden text-left sm:h-60"
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={d.titulo || `Dia ${d.dia}`} className="h-full w-full object-cover" />
        ) : (
          <div className="bg-brand-gradient h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09282B] via-[#09282B]/25 to-transparent" />
        {!img && (
          <span className="num-stamp absolute right-5 top-2 text-white/20" style={{ fontSize: "6.5rem" }}>{d.dia}</span>
        )}
        <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-[#F8F6F7]/95 px-3 py-1.5 text-[#09282B] shadow backdrop-blur-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Dia {d.dia}</span>
          {d.data && (
            <>
              <span className="h-1 w-1 rounded-full bg-[#09282B]/40" />
              <span className="text-[12px] font-semibold">{formatDate(d.data)}</span>
            </>
          )}
        </div>
        {temDetalhe && (
          <span className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F6F7]/95 text-[#09282B] shadow backdrop-blur-sm">
            <ChevronRight className={cn("h-4 w-4 transition-transform", aberto && "rotate-90")} />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 p-5">
          {d.cidade && (
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] text-white/90">
              <MapPin className="h-3 w-3" /> {d.cidade}
            </div>
          )}
          {d.titulo && (
            <h4 className="font-display text-2xl font-bold leading-[1.1] text-white drop-shadow sm:text-3xl">{d.titulo}</h4>
          )}
        </div>
      </button>
      {/* Corpo recolhível */}
      {aberto && temDetalhe && (
        <div className="p-5">
          {d.descricao && <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[#09282B]/85">{d.descricao}</p>}
          {(d.refeicoes || d.hospedagem) && (
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              {d.refeicoes && <span className="rounded-full bg-[#EDF5DC] px-3 py-1 font-medium text-[#09282B]/80">🍽 {d.refeicoes}</span>}
              {d.hospedagem && <span className="rounded-full bg-[#EDF5DC] px-3 py-1 font-medium text-[#09282B]/80">🛏 {d.hospedagem}</span>}
            </div>
          )}
          {extras.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {extras.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={f.url} alt={f.legenda ?? "Foto da viagem"} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function VoucherLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-editavel-700 hover:bg-accent"
    >
      <Download className="h-3 w-3" /> Baixar voucher
    </a>
  );
}

function IngressoLink({ ing }: { ing: { nome: string; url: string } }) {
  return (
    <a
      href={ing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-editavel-700 hover:bg-accent"
    >
      <Download className="h-3 w-3 shrink-0" />
      <span className="max-w-[180px] truncate" title={ing.nome}>{ing.nome}</span>
    </a>
  );
}

function SubTitulo({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {icone}
      {children}
    </div>
  );
}

function Bloco({
  icone, titulo, sub, id, children,
}: {
  icone: React.ReactNode;
  titulo: string;
  sub?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = React.useState(true);
  return (
    <section id={id} className="scroll-mt-28">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-panel)] px-4 py-3.5 text-left backdrop-blur-sm transition-opacity hover:opacity-90"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)]">
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[20px] font-semibold leading-none text-[var(--portal-fg)]">{titulo}</h2>
          {sub && <p className="mt-1 text-[12px] text-[var(--portal-fg-soft)]">{sub}</p>}
        </div>
        <ChevronRight className={cn("h-5 w-5 shrink-0 text-[var(--portal-fg-soft)] transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && children}
    </section>
  );
}

function Campo({ label, valor, mono }: { label: string; valor: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-[13px] font-medium", mono && "font-mono")}>{valor || "—"}</div>
    </div>
  );
}
