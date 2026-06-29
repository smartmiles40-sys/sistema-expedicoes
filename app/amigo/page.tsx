"use client";
import * as React from "react";
import {
  CompassIcon, MapPin, Calendar, Plane, LinkIcon, BedDouble, Sparkles, ArrowLeft, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { entrarExpedAmigo, type AmigoDados, type AmigoExpedicao } from "./actions";

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
          <ViagemCard key={exp.id} exp={exp} />
        ))}
        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Dúvidas sobre a sua viagem? Fale com a equipe da agência.
        </p>
      </main>
    </div>
  );
}

function ViagemCard({ exp }: { exp: AmigoExpedicao }) {
  const dias = daysUntil(exp.data_embarque);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Hero */}
      <div className="bg-brand-gradient px-5 py-5 text-white">
        <div className="flex items-center gap-2">
          {dias != null && dias >= 0 && (
            <span className="rounded-full bg-[var(--brand-lime)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--brand-dark)]">
              {dias === 0 ? "É hoje! 🎉" : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
        <h2 className="font-display mt-2 text-2xl font-semibold leading-tight">{exp.nome}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/75">
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {exp.destino}</span>
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-[var(--brand-lime)]" /> {formatDate(exp.data_embarque)} → {formatDate(exp.data_retorno)}</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Voos */}
        <Bloco icone={<Plane className="h-4 w-4" />} titulo="Seus voos">
          {exp.voo.companhia || exp.voo.localizador ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Companhia aérea" valor={exp.voo.companhia} />
              <Campo label="Localizador" valor={exp.voo.localizador} mono />
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              As informações dos seus voos serão disponibilizadas aqui em breve.
            </p>
          )}
          {exp.voo.voo_interno_necessario && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-editavel-50 px-2 py-1 text-[11px] font-medium text-editavel-700">
              <Plane className="h-3 w-3" /> Esta viagem inclui voo interno no destino.
            </p>
          )}
        </Bloco>

        {/* Hospedagem / quarto */}
        <Bloco icone={<BedDouble className="h-4 w-4" />} titulo="Sua hospedagem">
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

        {/* Teaser do que vem por aí (Fase 2) */}
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-lime-deep,#c0e046)]" />
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">Em breve por aqui:</span> roteiro dia a dia,
            passeios e ingressos, e as informações importantes do destino.
          </p>
        </div>
      </div>
    </section>
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
