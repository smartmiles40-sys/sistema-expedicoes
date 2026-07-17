"use client";
import * as React from "react";
import { toast } from "sonner";
import { Upload, CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { cn, formatDate, mascaraTelefone } from "@/lib/utils";
import { mascaraCpf } from "@/lib/cpf";
import { SaudeCampos, PERGUNTAS_SAUDE } from "@/app/(app)/expedicoes/[id]/passageiros/SaudeCampos";
import type { SaudePassageiro } from "@/types/database";
import { enviarInscricao, identificarInscricao, type ExpedicaoOpcao } from "./actions";

function SimNao({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex gap-1.5">
      {([["Sim", true], ["Não", false]] as const).map(([label, v]) => (
        <button key={label} type="button" onClick={() => onChange(value === v ? null : v)}
          className={cn("rounded-md border px-3 py-1 text-[13px] transition-colors",
            value === v ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Opcoes({ opcoes, value, onChange }: { opcoes: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button key={o} type="button" onClick={() => onChange(value === o ? null : o)}
          className={cn("rounded-md border px-3 py-1 text-[13px] transition-colors",
            value === o ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[15px] font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[12px]">{label}</Label>
      {children}
    </div>
  );
}

const CAMPOS_TEXTO_VAZIO = {
  nome_completo: "", email: "", telefone: "",
  passaporte: "", validade_passaporte: "",
  endereco_cep: "", endereco_rua: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cidade: "", endereco_estado: "",
  contato_emergencia_nome: "", contato_emergencia_fone: "", contato_emergencia_vinculo: "",
  paises_visitados: "", acompanhante_nome: "",
};

export function InscricaoForm({ expedicoes }: { expedicoes: ExpedicaoOpcao[] }) {
  const [fase, setFase] = React.useState<"identificacao" | "completar" | "conflito">("identificacao");
  const [expedicaoId, setExpedicaoId] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [nascimento, setNascimento] = React.useState("");
  const [temos, setTemos] = React.useState<Set<string>>(new Set());
  const [temPassaporteAnexo, setTemPassaporteAnexo] = React.useState(false);
  const [reconhecido, setReconhecido] = React.useState(false); // achamos o cadastro (pré-preenchido)

  const [f, setF] = React.useState({ ...CAMPOS_TEXTO_VAZIO });
  const [prefAssento, setPrefAssento] = React.useState<boolean | null>(null);
  const [prefUpgrade, setPrefUpgrade] = React.useState<string | null>(null);
  const [jaViajou, setJaViajou] = React.useState<boolean | null>(null);
  const [acompanhado, setAcompanhado] = React.useState<boolean | null>(null);
  const [divideQuarto, setDivideQuarto] = React.useState<string | null>(null);
  const [saude, setSaude] = React.useState<SaudePassageiro>({});
  const [passaporteFile, setPassaporteFile] = React.useState<File | null>(null);
  const [possuiPassaporte, setPossuiPassaporte] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState<null | "novo" | "completou">(null);
  const [passo, setPasso] = React.useState(0); // etapa atual do wizard (fase "completar")

  const set = (k: keyof typeof CAMPOS_TEXTO_VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const mostra = (key: string) => !temos.has(key);
  const precisaAnexo = !temPassaporteAnexo;
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v ?? "").trim());

  // "Tudo obrigatório": lista os campos VISÍVEIS ainda não preenchidos da etapa.
  // Só valida o que aparece — dado que já temos do cliente não é exigido de novo.
  function faltasDoPasso(titulo: string): string[] {
    const faltas: string[] = [];
    const exige = (cond: boolean, label: string) => { if (cond) faltas.push(label); };
    const digitos = (v: string) => (v ?? "").replace(/\D/g, "");
    if (titulo === "Dados pessoais") {
      if (mostra("nome_completo")) exige(!f.nome_completo.trim(), "Nome completo");
      if (mostra("email")) exige(!emailOk(f.email), "E-mail válido");
      if (mostra("telefone")) exige(digitos(f.telefone).length < 10, "Telefone");
    } else if (titulo === "Endereço") {
      if (mostra("endereco_cep")) exige(!f.endereco_cep.trim(), "CEP");
      if (mostra("endereco_rua")) exige(!f.endereco_rua.trim(), "Logradouro");
      if (mostra("endereco_numero")) exige(!f.endereco_numero.trim(), "Número");
      exige(!f.endereco_bairro.trim(), "Bairro");
      if (mostra("endereco_cidade")) exige(!f.endereco_cidade.trim(), "Cidade");
      if (mostra("endereco_estado")) exige(!f.endereco_estado.trim(), "Estado (UF)");
    } else if (titulo === "Passaporte") {
      if (precisaAnexo) {
        exige(possuiPassaporte === null, "Responder se possui passaporte");
        if (possuiPassaporte === true) {
          if (mostra("passaporte")) exige(!f.passaporte.trim(), "Número do passaporte");
          if (mostra("validade_passaporte")) exige(!f.validade_passaporte, "Validade do passaporte");
          exige(!passaporteFile, "Anexo do passaporte");
        }
      } else {
        if (mostra("passaporte")) exige(!f.passaporte.trim(), "Número do passaporte");
        if (mostra("validade_passaporte")) exige(!f.validade_passaporte, "Validade do passaporte");
      }
    } else if (titulo === "Contato de emergência") {
      if (mostra("contato_emergencia_nome")) exige(!f.contato_emergencia_nome.trim(), "Nome do contato de emergência");
      if (mostra("contato_emergencia_fone")) exige(digitos(f.contato_emergencia_fone).length < 10, "Telefone do contato de emergência");
      if (mostra("contato_emergencia_vinculo")) exige(!f.contato_emergencia_vinculo.trim(), "Vínculo do contato de emergência");
    } else if (titulo === "Sua viagem") {
      exige(prefAssento === null, "Deseja marcar assento?");
      exige(!prefUpgrade, "Deseja upgrade de classe?");
      exige(jaViajou === null, "Já viajou internacionalmente?");
      if (jaViajou === true) exige(!f.paises_visitados.trim(), "Países visitados");
      exige(acompanhado === null, "Vai acompanhado(a)?");
      if (acompanhado === true) {
        exige(!f.acompanhante_nome.trim(), "Nome do acompanhante");
        exige(!divideQuarto, "Dividir quarto");
      }
    } else if (titulo === "Saúde") {
      const sv = (k: string) => ((saude as Record<string, string | undefined>)[k] ?? "").trim();
      for (const q of PERGUNTAS_SAUDE) {
        const v = sv(q.campo);
        if (v !== "Sim" && v !== "Não") { faltas.push(q.pergunta); continue; }
        if (v === "Sim" && q.detalheCampo) exige(!sv(q.detalheCampo), q.detalhePergunta ?? "Detalhe");
      }
    }
    return faltas;
  }

  async function identificar() {
    if (!expedicaoId) return toast.error("Selecione a expedição.");
    if (mascaraCpf(cpf).replace(/\D/g, "").length !== 11) return toast.error("Informe um CPF válido.");
    if (!nascimento) return toast.error("Informe sua data de nascimento.");
    setBusy(true);
    try {
      const r = await identificarInscricao(expedicaoId, cpf, nascimento);
      if (!r.ok) return toast.error(r.error);
      if (r.existe && r.conflito) return setFase("conflito");
      // Mostra TODOS os campos (temos vazio); se achamos o cadastro, pré-preenche.
      setTemos(new Set());
      if (r.existe) {
        const v = r.valores;
        setF({
          nome_completo: v.nome_completo, email: v.email, telefone: v.telefone,
          passaporte: v.passaporte, validade_passaporte: v.validade_passaporte,
          endereco_cep: v.endereco_cep, endereco_rua: v.endereco_rua, endereco_numero: v.endereco_numero,
          endereco_complemento: v.endereco_complemento, endereco_bairro: v.endereco_bairro,
          endereco_cidade: v.endereco_cidade, endereco_estado: v.endereco_estado,
          contato_emergencia_nome: v.contato_emergencia_nome, contato_emergencia_fone: v.contato_emergencia_fone,
          contato_emergencia_vinculo: v.contato_emergencia_vinculo,
          paises_visitados: v.paises_visitados, acompanhante_nome: v.acompanhante_nome,
        });
        setPrefAssento(v.pref_marcar_assento);
        setPrefUpgrade(v.pref_upgrade_classe);
        setJaViajou(v.ja_viajou_internacional);
        setAcompanhado(v.acompanhante_nome ? true : null);
        setDivideQuarto(v.acompanhante_divide_quarto);
        setSaude(v.saude ?? {});
        setPossuiPassaporte(v.passaporte || v.validade_passaporte ? true : null);
        setTemPassaporteAnexo(r.temPassaporteAnexo);
        setReconhecido(true);
      } else {
        setF({ ...CAMPOS_TEXTO_VAZIO });
        setTemPassaporteAnexo(false);
        setReconhecido(false);
      }
      setPasso(0);
      setFase("completar");
    } finally {
      setBusy(false);
    }
  }

  async function enviar() {
    // "Tudo obrigatório": valida todas as etapas e pula pra primeira incompleta.
    for (let i = 0; i < passos.length; i++) {
      const faltas = faltasDoPasso(passos[i].titulo);
      if (faltas.length) {
        setPasso(i);
        toast.error(`Complete "${passos[i].titulo}": ` + faltas.slice(0, 4).join(", ") + (faltas.length > 4 ? "…" : ""));
        return;
      }
    }
    setBusy(true);
    try {
      const dados = {
        expedicao_id: expedicaoId, cpf, data_nascimento: nascimento,
        ...f,
        possui_passaporte: possuiPassaporte,
        pref_marcar_assento: prefAssento,
        pref_upgrade_classe: prefUpgrade,
        ja_viajou_internacional: jaViajou,
        acompanhante_nome: acompanhado ? f.acompanhante_nome : "",
        acompanhante_divide_quarto: acompanhado ? divideQuarto : null,
        saude,
      };
      const fd = new FormData();
      fd.append("dados", JSON.stringify(dados));
      if (passaporteFile) fd.append("passaporte", passaporteFile);
      const r = await enviarInscricao(fd);
      if (r.ok) setOk(r.completou ? "completou" : "novo");
      else toast.error("Não foi possível enviar", { description: r.error });
    } catch {
      toast.error("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const Header = (
    <header className="bg-brand-gradient px-4 py-6 text-white">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Logo tone="dark" className="h-6 w-auto" />
        <div className="text-[12px] text-white/70">Ficha de inscrição da expedição</div>
      </div>
    </header>
  );

  if (ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-vinculado-600" />
        <h1 className="mt-4 text-xl font-semibold">{ok === "completou" ? "Dados completados! 🎉" : "Inscrição enviada! 🎉"}</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Recebemos seus dados. Nossa equipe vai revisar e confirmar em breve. Qualquer dúvida, fale com a agência.
        </p>
      </div>
    );
  }

  if (fase === "conflito") {
    return (
      <div className="min-h-screen bg-muted/30">
        {Header}
        <main className="mx-auto max-w-lg p-4">
          <div className="rounded-2xl border border-critico-500/40 bg-critico-50 p-5 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-critico-600" />
            <h2 className="mt-3 text-[15px] font-semibold">Os dados não conferem</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              O CPF e a data de nascimento não batem com o nosso cadastro. Confira os dados ou fale com a agência.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setFase("identificacao")}>Voltar</Button>
          </div>
        </main>
      </div>
    );
  }

  // ─── FASE 1: identificação ───────────────────────────────────────────────
  if (fase === "identificacao") {
    return (
      <div className="min-h-screen bg-muted/30">
        {Header}
        <main className="mx-auto max-w-lg space-y-4 p-4">
          <Secao titulo="Vamos começar">
            <p className="text-[12px] text-muted-foreground">Identifique sua expedição e você. Depois pedimos só o que ainda falta.</p>
            <Campo label="Qual expedição você comprou?">
              <select value={expedicaoId} onChange={(e) => setExpedicaoId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]">
                <option value="">Selecione…</option>
                {expedicoes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome} — {e.destino} · {formatDate(e.data_embarque)}</option>
                ))}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="CPF">
                <Input value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
              </Campo>
              <Campo label="Data de nascimento">
                <Input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
              </Campo>
            </div>
            <Button variant="brand" className="w-full" onClick={identificar} disabled={busy}>
              {busy ? "Verificando…" : <>Continuar <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </Secao>
        </main>
      </div>
    );
  }

  // ─── FASE 2: completar (em ETAPAS / wizard) ──────────────────────────────
  const secaoDadosVisivel = mostra("nome_completo") || mostra("email") || mostra("telefone");
  const secaoEnderecoVisivel = ["endereco_cep", "endereco_rua", "endereco_numero", "endereco_cidade", "endereco_estado"].some(mostra);
  const secaoPassaporteVisivel = mostra("passaporte") || mostra("validade_passaporte") || precisaAnexo;
  const secaoEmergenciaVisivel = ["contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo"].some(mostra);

  // Monta só as etapas que fazem sentido (pula o que já temos).
  const passos: { titulo: string; node: React.ReactNode }[] = [];

  if (secaoDadosVisivel) passos.push({
    titulo: "Dados pessoais",
    node: (
      <Secao titulo="Dados pessoais">
        {mostra("nome_completo") && <Campo label="Nome completo"><Input value={f.nome_completo} onChange={set("nome_completo")} /></Campo>}
        <div className="grid grid-cols-2 gap-3">
          {mostra("email") && <Campo label="E-mail"><Input type="email" value={f.email} onChange={set("email")} /></Campo>}
          {mostra("telefone") && (
            <Campo label="Telefone / WhatsApp">
              <Input value={f.telefone} onChange={(e) => setF((p) => ({ ...p, telefone: mascaraTelefone(e.target.value) }))} inputMode="tel" placeholder="(00) 00000-0000" />
            </Campo>
          )}
        </div>
      </Secao>
    ),
  });

  if (secaoEnderecoVisivel) passos.push({
    titulo: "Endereço",
    node: (
      <Secao titulo="Endereço">
        <div className="grid grid-cols-2 gap-3">
          {mostra("endereco_cep") && <Campo label="CEP"><Input value={f.endereco_cep} onChange={set("endereco_cep")} inputMode="numeric" /></Campo>}
          {mostra("endereco_cidade") && <Campo label="Cidade"><Input value={f.endereco_cidade} onChange={set("endereco_cidade")} /></Campo>}
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          {mostra("endereco_rua") && <Campo label="Logradouro"><Input value={f.endereco_rua} onChange={set("endereco_rua")} /></Campo>}
          {mostra("endereco_numero") && <Campo label="Número"><Input value={f.endereco_numero} onChange={set("endereco_numero")} /></Campo>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Complemento"><Input value={f.endereco_complemento} onChange={set("endereco_complemento")} /></Campo>
          <Campo label="Bairro"><Input value={f.endereco_bairro} onChange={set("endereco_bairro")} /></Campo>
        </div>
        {mostra("endereco_estado") && <Campo label="Estado (UF)"><Input value={f.endereco_estado} onChange={set("endereco_estado")} maxLength={20} /></Campo>}
      </Secao>
    ),
  });

  if (secaoPassaporteVisivel) passos.push({
    titulo: "Passaporte",
    node: (
      <Secao titulo="Passaporte">
        {precisaAnexo ? (
          <>
            <Campo label="Você possui passaporte?">
              <SimNao value={possuiPassaporte} onChange={setPossuiPassaporte} />
            </Campo>
            {possuiPassaporte === true && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {mostra("passaporte") && <Campo label="Número do passaporte"><Input value={f.passaporte} onChange={set("passaporte")} /></Campo>}
                  {mostra("validade_passaporte") && <Campo label="Validade"><Input type="date" value={f.validade_passaporte} onChange={set("validade_passaporte")} /></Campo>}
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Anexo do passaporte (foto ou PDF) — obrigatório</Label>
                  <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] hover:bg-accent/40",
                    passaporteFile && "border-solid border-vinculado-600/40 bg-vinculado-50")}>
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="truncate">{passaporteFile ? passaporteFile.name : "Escolher arquivo"}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setPassaporteFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </>
            )}
            {possuiPassaporte === false && (
              <p className="text-[12px] text-muted-foreground">Sem problema! Assim que você tirar o passaporte, é só enviar para a agência — a gente acompanha.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-[12px] text-vinculado-700">✓ Já temos seu passaporte anexado.</p>
            {(mostra("passaporte") || mostra("validade_passaporte")) && (
              <div className="grid grid-cols-2 gap-3">
                {mostra("passaporte") && <Campo label="Número do passaporte"><Input value={f.passaporte} onChange={set("passaporte")} /></Campo>}
                {mostra("validade_passaporte") && <Campo label="Validade"><Input type="date" value={f.validade_passaporte} onChange={set("validade_passaporte")} /></Campo>}
              </div>
            )}
          </>
        )}
      </Secao>
    ),
  });

  if (secaoEmergenciaVisivel) passos.push({
    titulo: "Contato de emergência",
    node: (
      <Secao titulo="Contato de emergência">
        <div className="grid grid-cols-2 gap-3">
          {mostra("contato_emergencia_nome") && <Campo label="Nome"><Input value={f.contato_emergencia_nome} onChange={set("contato_emergencia_nome")} /></Campo>}
          {mostra("contato_emergencia_fone") && (
            <Campo label="Telefone">
              <Input value={f.contato_emergencia_fone} onChange={(e) => setF((p) => ({ ...p, contato_emergencia_fone: mascaraTelefone(e.target.value) }))} inputMode="tel" placeholder="(00) 00000-0000" />
            </Campo>
          )}
        </div>
        {mostra("contato_emergencia_vinculo") && (
          <Campo label="Vínculo com você"><Input value={f.contato_emergencia_vinculo} onChange={set("contato_emergencia_vinculo")} placeholder="Ex.: mãe, pai, irmão, cônjuge, amigo(a)…" /></Campo>
        )}
      </Secao>
    ),
  });

  passos.push({
    titulo: "Sua viagem",
    node: (
      <div className="space-y-4">
        <Secao titulo="Preferências de voo">
          <Campo label="Deseja marcar assento?"><SimNao value={prefAssento} onChange={setPrefAssento} /></Campo>
          <Campo label="Deseja upgrade de classe?"><Opcoes opcoes={["Não", "Executiva", "Primeira classe"]} value={prefUpgrade} onChange={setPrefUpgrade} /></Campo>
        </Secao>
        <Secao titulo="Experiência de viagem">
          <Campo label="Você já realizou viagens internacionais / visitou outros países?"><SimNao value={jaViajou} onChange={setJaViajou} /></Campo>
          {jaViajou && <Campo label="Quais países você já visitou?"><Input value={f.paises_visitados} onChange={set("paises_visitados")} /></Campo>}
        </Secao>
        <Secao titulo="Acompanhante">
          <Campo label="Você irá nesta expedição acompanhado(a)?"><SimNao value={acompanhado} onChange={setAcompanhado} /></Campo>
          {acompanhado && (
            <>
              <Campo label="Nome do(a) acompanhante"><Input value={f.acompanhante_nome} onChange={set("acompanhante_nome")} /></Campo>
              <Campo label="Vocês pretendem dividir quarto/cama?">
                <Opcoes opcoes={["Dividir quarto e cama", "Dividir só o quarto", "Não dividir"]} value={divideQuarto} onChange={setDivideQuarto} />
              </Campo>
            </>
          )}
        </Secao>
      </div>
    ),
  });

  passos.push({
    titulo: "Saúde",
    node: (
      <Secao titulo="Saúde">
        <p className="text-[12px] text-muted-foreground">Essas informações são confidenciais e ajudam a equipe a cuidar de você na viagem.</p>
        <SaudeCampos value={saude} onChange={setSaude} expedicaoId={null} passageiroId={null} />
      </Secao>
    ),
  });

  const idx = Math.min(passo, passos.length - 1);
  const passoAtual = passos[idx];
  const ultimo = idx >= passos.length - 1;
  const pct = Math.round(((idx + 1) / passos.length) * 100);

  const avancar = () => {
    const faltas = faltasDoPasso(passoAtual.titulo);
    if (faltas.length) {
      toast.error("Falta preencher: " + faltas.slice(0, 4).join(", ") + (faltas.length > 4 ? "…" : ""));
      return;
    }
    setPasso(Math.min(idx + 1, passos.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const voltar = () => {
    setPasso(Math.max(0, idx - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {Header}
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {idx === 0 && reconhecido && (
          <div className="flex items-start gap-2 rounded-2xl border border-vinculado-600/30 bg-vinculado-50 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-vinculado-600" />
            <p className="text-[12px] text-vinculado-700">
              <strong>Encontramos seu cadastro!</strong> Já preenchemos com o que temos — confira e atualize o que precisar antes de enviar.
            </p>
          </div>
        )}

        {/* Progresso das etapas */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Etapa {idx + 1} de {passos.length}</span>
            <span className="font-semibold text-foreground">{passoAtual.titulo}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[var(--brand-lime-deep)] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Todos os campos são obrigatórios.</p>
        </div>

        {passoAtual.node}

        <div className="flex items-center justify-between gap-3 pb-8 pt-1">
          {idx > 0 ? (
            <Button variant="outline" onClick={voltar} disabled={busy}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <span />
          )}
          {ultimo ? (
            <Button variant="brand" size="lg" onClick={enviar} disabled={busy}>
              {busy ? "Enviando…" : "Enviar inscrição"}
            </Button>
          ) : (
            <Button variant="brand" onClick={avancar} disabled={busy}>
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
