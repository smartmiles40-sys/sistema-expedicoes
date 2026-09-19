"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { carregarAcessoPorToken, definirSenhaPorTokenAcesso } from "../actions";

type Info = { nome: string; expedicaoNome: string | null; temCpf: boolean; jaTemSenha: boolean };

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function AcessoForm() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [info, setInfo] = React.useState<Info | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [cpf, setCpf] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirma, setConfirma] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [pronto, setPronto] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!token) { setErro("Link inválido. Peça um novo à agência."); setCarregando(false); return; }
      const r = await carregarAcessoPorToken(token);
      if (!r.ok) setErro(r.error);
      else setInfo({ nome: r.nome, expedicaoNome: r.expedicaoNome, temCpf: r.temCpf, jaTemSenha: r.jaTemSenha });
      setCarregando(false);
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (senha !== confirma) { setErro("As senhas não coincidem."); return; }
    if (info && !info.temCpf && cpf.replace(/\D/g, "").length !== 11) { setErro("Informe um CPF válido."); return; }
    setEnviando(true);
    const r = await definirSenhaPorTokenAcesso(token, senha, cpf.replace(/\D/g, ""));
    setEnviando(false);
    if (!r.ok) { setErro(r.error); return; }
    setPronto(r.cpf);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="font-display text-2xl font-bold">Se Tu For, Eu Vou</div>
        <div className="text-sm text-muted-foreground">Portal do viajante · ExpedAmigo</div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {carregando ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : erro && !info ? (
          <p className="text-center text-sm text-critico-600">{erro}</p>
        ) : pronto ? (
          <div className="space-y-4 text-center">
            <div className="text-3xl">✅</div>
            <h1 className="text-lg font-semibold">Tudo pronto!</h1>
            <p className="text-sm text-muted-foreground">
              Seu login é o CPF <strong>{formatCpf(pronto)}</strong> e a senha que você acabou de criar.
            </p>
            <a href="/amigo" className="inline-block rounded-lg bg-[var(--brand-lime)] px-4 py-2 font-semibold text-[var(--brand-dark)] hover:opacity-90">
              Entrar no portal
            </a>
          </div>
        ) : info?.jaTemSenha ? (
          <div className="space-y-4 text-center">
            <h1 className="text-lg font-semibold">Você já tem acesso</h1>
            <p className="text-sm text-muted-foreground">Sua senha já foi criada. É só entrar no portal.</p>
            <a href="/amigo" className="inline-block rounded-lg bg-[var(--brand-lime)] px-4 py-2 font-semibold text-[var(--brand-dark)] hover:opacity-90">
              Entrar no portal
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="text-center">
              <h1 className="text-lg font-semibold">Olá, {info?.nome?.split(" ")[0]}! 👋</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie sua senha para acessar o portal da sua {info?.expedicaoNome ? <strong>{info.expedicaoNome}</strong> : "viagem"}.
              </p>
            </div>

            {info && !info.temCpf && (
              <div className="space-y-1">
                <label className="text-[13px] font-medium">Seu CPF</label>
                <input
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">É o seu login no portal.</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[13px] font-medium">Crie uma senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-medium">Confirme a senha</label>
              <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>

            {erro && <p className="text-[13px] text-critico-600">{erro}</p>}

            <button type="submit" disabled={enviando} className="w-full rounded-lg bg-[var(--brand-lime)] px-4 py-2.5 font-semibold text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-60">
              {enviando ? "Criando…" : "Criar senha e acessar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
