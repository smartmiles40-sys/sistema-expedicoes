"use client";
import * as React from "react";
import {
  CompassIcon, MapPin, Calendar, Plane, LinkIcon, BedDouble, ExternalLink,
  CalendarDays, Ticket, Info, ChevronRight, Megaphone, Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import {
  entrarExpedAmigo,
  type AmigoDados, type AmigoExpedicao, type AmigoRoteiroDia,
} from "./actions";

export default function AmigoPage() {
  const [cpf, setCpf] = React.useState("");
  const [nascimento, setNascimento] = React.useState("");
  const [dados, setDados] = React.useState<AmigoDados | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const r = await entrarExpedAmigo(cpf, nascimento);
    setLoading(false);
    if (r.ok) setDados(r.dados);
    else setErro(r.error);
  }

  // ---------- Portão de acesso ----------
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
              Sua próxima aventura começa aqui.
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
              Tudo sobre a sua viagem num lugar só: voos, hospedagem e as informações
              que você precisa para embarcar tranquilo.
            </p>
          </div>
          <p className="relative z-10 text-xs text-white/40">Espaço do viajante</p>
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-lime)] opacity-[0.07] blur-3xl" />
        </div>

        <div className="flex items-center justify-center p-6">
          <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
            <div className="lg:hidden flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-dark)] text-[var(--brand-lime)]">
                <CompassIcon className="h-5 w-5" />
              </div>
              <span className="font-display text-[16px] font-semibold">Se Tu For, Eu Vou</span>
            </div>
            <div>
              <h1 className="page-title">Minha Viagem</h1>
              <p className="page-subtitle mt-1">Acesse com seu CPF e sua data de nascimento.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amigo-cpf">CPF</Label>
              <Input
                id="amigo-cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="Somente números"
                inputMode="numeric"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amigo-nasc">Data de nascimento</Label>
              <Input
                id="amigo-nasc"
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
              />
            </div>
            {erro && <p className="text-[12px] font-medium text-critico-600">{erro}</p>}
            <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Acessar minha viagem"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              É o mesmo CPF e a mesma data de nascimento que você informou na sua reserva.
              Algum dado não confere? Fale com a agência.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Área do viajante ----------
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand-gradient flex items-center justify-between px-5 py-4 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-lime)] text-[var(--brand-dark)]">
            <CompassIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-[16px] font-semibold leading-none">Minha Viagem</span>
            <div className="mt-0.5 truncate text-[13px] text-white/70">Olá, {dados.primeiro_nome} 👋</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setDados(null); setCpf(""); setNascimento(""); setErro(null); }}
          className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/20"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4">
        {dados.expedicoes.map((exp) => (
          <ViagemCard key={exp.id} exp={exp} nome={dados.nome} />
        ))}
        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Dúvidas sobre a sua viagem? Fale com a equipe da agência.
        </p>
      </main>
    </div>
  );
}

function ViagemCard({ exp, nome }: { exp: AmigoExpedicao; nome: string }) {
  // Sempre recolhida ao logar — o viajante abre a viagem que quiser.
  const [aberta, setAberta] = React.useState(false);
  const [gerandoPdf, setGerandoPdf] = React.useState(false);
  const dias = daysUntil(exp.data_embarque);

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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Hero (clicável para recolher/expandir) */}
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="bg-brand-gradient block w-full px-5 py-5 text-left text-white"
      >
        <div className="flex items-center gap-2">
          {dias != null && dias >= 0 && (
            <span className="rounded-full bg-[var(--brand-lime)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--brand-dark)]">
              {dias === 0 ? "É hoje! 🎉" : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`}
            </span>
          )}
          <ChevronRight className={cn("ml-auto h-5 w-5 shrink-0 transition-transform", aberta && "rotate-90")} />
        </div>
        <h2 className="font-display mt-2 text-2xl font-semibold leading-tight">{exp.nome}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/75">
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {exp.destino}</span>
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {formatDate(exp.data_embarque)} → {formatDate(exp.data_retorno)}</span>
        </div>
      </button>

      {/* Barra de ação: baixar PDF (sempre visível) */}
      <div className="flex justify-end border-b border-border bg-muted/20 px-4 py-2">
        <button
          type="button"
          onClick={baixarPdf}
          disabled={gerandoPdf}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-editavel-700 hover:bg-accent disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" /> {gerandoPdf ? "Gerando PDF…" : "Baixar PDF da viagem"}
        </button>
      </div>

      {aberta && (
      <div className="space-y-4 p-4">
        {/* Roteiro dia a dia */}
        {exp.roteiro.length > 0 && (
          <Bloco icone={<CalendarDays className="h-4 w-4" />} titulo="Roteiro dia a dia (previsto)">
            <ol className="space-y-1.5">
              {exp.roteiro.map((d, i) => (
                <DiaRoteiro key={i} d={d} />
              ))}
            </ol>
          </Bloco>
        )}

        {/* Vouchers — voos + passeios/ingressos + hospedagem num só item */}
        <Bloco icone={<Ticket className="h-4 w-4" />} titulo="Vouchers">
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

            {/* Hospedagem / quarto */}
            <div>
              <SubTitulo icone={<BedDouble className="h-3.5 w-3.5" />}>Hospedagem</SubTitulo>
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
          <Bloco icone={<LinkIcon className="h-4 w-4" />} titulo="Links úteis">
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
          <Bloco icone={<Info className="h-4 w-4" />} titulo="Informações do destino">
            <div className="space-y-2">
              {exp.info.map((b, i) => (
                <div key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[12px] font-semibold">{b.titulo}</div>
                  <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{b.conteudo}</p>
                </div>
              ))}
            </div>
          </Bloco>
        )}

        {/* Avisos e boas práticas */}
        {exp.avisos.length > 0 && (
          <Bloco icone={<Megaphone className="h-4 w-4" />} titulo="Avisos e boas práticas">
            <div className="space-y-2">
              {exp.avisos.map((a, i) => {
                const cfg = AVISO_CFG[a.tipo] ?? AVISO_CFG.Aviso;
                return (
                  <div key={i} className={cn("rounded-lg border-l-4 bg-background px-3 py-2", cfg.border)}>
                    <div className="inline-flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                      <span>{cfg.emoji}</span> {a.titulo}
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
      )}
    </section>
  );
}

const AVISO_CFG: Record<string, { emoji: string; border: string; badge: string }> = {
  "Aviso": { emoji: "⚠️", border: "border-atencao-600", badge: "bg-atencao-100 text-atencao-600" },
  "Boa prática": { emoji: "✅", border: "border-vinculado-600", badge: "bg-vinculado-100 text-vinculado-600" },
  "Dica": { emoji: "💡", border: "border-editavel-600", badge: "bg-editavel-100 text-editavel-600" },
};

/** Um dia do roteiro — recolhível (abre detalhes + fotos ao tocar). */
function DiaRoteiro({ d }: { d: AmigoRoteiroDia }) {
  const [aberto, setAberto] = React.useState(false);
  const temDetalhe = Boolean(d.descricao || d.refeicoes || d.hospedagem || d.fotos.length);
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">
            Dia {d.dia}{d.titulo ? ` · ${d.titulo}` : ""}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {[d.data ? formatDate(d.data) : null, d.cidade].filter(Boolean).join(" · ")}
            {d.fotos.length ? ` · ${d.fotos.length} foto${d.fotos.length === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        {temDetalhe && (
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-90")} />
        )}
      </button>
      {aberto && temDetalhe && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          {d.descricao && <p className="text-[12px] text-muted-foreground">{d.descricao}</p>}
          {(d.refeicoes || d.hospedagem) && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {d.refeicoes && <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">🍽 {d.refeicoes}</span>}
              {d.hospedagem && <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">🛏 {d.hospedagem}</span>}
            </div>
          )}
          {d.fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {d.fotos.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.url}
                  alt={f.legenda ?? "Foto da viagem"}
                  className="aspect-square w-full rounded-lg object-cover"
                />
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

function SubTitulo({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {icone}
      {children}
    </div>
  );
}

function Bloco({
  icone, titulo, children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
        <span className="text-[var(--brand-dark)]">{icone}</span>
        {titulo}
      </div>
      {children}
    </div>
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
