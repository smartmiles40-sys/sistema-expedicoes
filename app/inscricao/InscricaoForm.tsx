"use client";
import * as React from "react";
import { toast } from "sonner";
import { Compass, Upload, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { cn, formatDate, mascaraTelefone } from "@/lib/utils";
import { mascaraCpf } from "@/lib/cpf";
import { SaudeCampos } from "@/app/(app)/expedicoes/[id]/passageiros/SaudeCampos";
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

// Rótulos amigáveis dos "buckets" que já temos (pra o aviso — sem mostrar valores).
const BUCKETS: { chave: string; campos: string[] }[] = [
  { chave: "dados de cadastro", campos: ["nome_completo", "data_nascimento", "email", "telefone"] },
  { chave: "endereço", campos: ["endereco_cep", "endereco_rua", "endereco_numero", "endereco_cidade", "endereco_estado"] },
  { chave: "passaporte", campos: ["passaporte", "validade_passaporte"] },
  { chave: "contato de emergência", campos: ["contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo"] },
];

export function InscricaoForm({ expedicoes }: { expedicoes: ExpedicaoOpcao[] }) {
  const [fase, setFase] = React.useState<"identificacao" | "completar" | "conflito">("identificacao");
  const [expedicaoId, setExpedicaoId] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [nascimento, setNascimento] = React.useState("");
  const [temos, setTemos] = React.useState<Set<string>>(new Set());
  const [temPassaporteAnexo, setTemPassaporteAnexo] = React.useState(false);

  const [f, setF] = React.useState({ ...CAMPOS_TEXTO_VAZIO });
  const [prefAssento, setPrefAssento] = React.useState<boolean | null>(null);
  const [prefUpgrade, setPrefUpgrade] = React.useState<string | null>(null);
  const [jaViajou, setJaViajou] = React.useState<boolean | null>(null);
  const [acompanhado, setAcompanhado] = React.useState<boolean | null>(null);
  const [divideQuarto, setDivideQuarto] = React.useState<string | null>(null);
  const [saude, setSaude] = React.useState<SaudePassageiro>({});
  const [passaporteFile, setPassaporteFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState<null | "novo" | "completou">(null);

  const set = (k: keyof typeof CAMPOS_TEXTO_VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const mostra = (key: string) => !temos.has(key);
  const precisaAnexo = !temPassaporteAnexo;

  async function identificar() {
    if (!expedicaoId) return toast.error("Selecione a expedição.");
    if (mascaraCpf(cpf).replace(/\D/g, "").length !== 11) return toast.error("Informe um CPF válido.");
    if (!nascimento) return toast.error("Informe sua data de nascimento.");
    setBusy(true);
    try {
      const r = await identificarInscricao(expedicaoId, cpf, nascimento);
      if (!r.ok) return toast.error(r.error);
      if (r.existe && r.conflito) return setFase("conflito");
      if (r.existe) {
        setTemos(new Set(r.temos));
        setTemPassaporteAnexo(r.temPassaporteAnexo);
      } else {
        setTemos(new Set());
        setTemPassaporteAnexo(false);
      }
      setFase("completar");
    } finally {
      setBusy(false);
    }
  }

  async function enviar() {
    if (precisaAnexo && !passaporteFile) return toast.error("Anexe a foto ou PDF do seu passaporte.");
    setBusy(true);
    try {
      const dados = {
        expedicao_id: expedicaoId, cpf, data_nascimento: nascimento,
        ...f,
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

  // Buckets que já temos (pra o aviso).
  const bucketsTemos = BUCKETS.filter((b) => b.campos.some((c) => temos.has(c)) || (b.chave === "passaporte" && temPassaporteAnexo)).map((b) => b.chave);

  const Header = (
    <header className="bg-brand-gradient px-4 py-6 text-white">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <Compass className="h-6 w-6" />
        <div>
          <div className="font-display text-lg font-semibold leading-none">Se Tu For, Eu Vou</div>
          <div className="text-[12px] text-white/70">Ficha de inscrição da expedição</div>
        </div>
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

  // ─── FASE 2: completar ───────────────────────────────────────────────────
  const secaoDadosVisivel = mostra("nome_completo") || mostra("email") || mostra("telefone");
  const secaoEnderecoVisivel = ["endereco_cep", "endereco_rua", "endereco_numero", "endereco_cidade", "endereco_estado"].some(mostra);
  const secaoPassaporteVisivel = mostra("passaporte") || mostra("validade_passaporte") || precisaAnexo;
  const secaoEmergenciaVisivel = ["contato_emergencia_nome", "contato_emergencia_fone", "contato_emergencia_vinculo"].some(mostra);

  return (
    <div className="min-h-screen bg-muted/30">
      {Header}
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {bucketsTemos.length > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-vinculado-600/30 bg-vinculado-50 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-vinculado-600" />
            <p className="text-[12px] text-vinculado-700">
              <strong>Já temos {bucketsTemos.join(", ")} na nossa base</strong> — não precisa preencher de novo. Complete abaixo só o que falta.
            </p>
          </div>
        )}

        {secaoDadosVisivel && (
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
        )}

        {secaoEnderecoVisivel && (
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
        )}

        {secaoPassaporteVisivel && (
          <Secao titulo="Passaporte">
            <div className="grid grid-cols-2 gap-3">
              {mostra("passaporte") && <Campo label="Número do passaporte"><Input value={f.passaporte} onChange={set("passaporte")} /></Campo>}
              {mostra("validade_passaporte") && <Campo label="Validade"><Input type="date" value={f.validade_passaporte} onChange={set("validade_passaporte")} /></Campo>}
            </div>
            {precisaAnexo ? (
              <div className="space-y-1">
                <Label className="text-[12px]">Anexo do passaporte (foto ou PDF) — obrigatório</Label>
                <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] hover:bg-accent/40",
                  passaporteFile && "border-solid border-vinculado-600/40 bg-vinculado-50")}>
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{passaporteFile ? passaporteFile.name : "Escolher arquivo"}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setPassaporteFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            ) : (
              <p className="text-[12px] text-vinculado-700">✓ Já temos seu passaporte anexado.</p>
            )}
          </Secao>
        )}

        {secaoEmergenciaVisivel && (
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
        )}

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

        <Secao titulo="Saúde">
          <p className="text-[12px] text-muted-foreground">Essas informações são confidenciais e ajudam a equipe a cuidar de você na viagem.</p>
          <SaudeCampos value={saude} onChange={setSaude} expedicaoId={null} passageiroId={null} />
        </Secao>

        <div className="pb-8">
          <Button variant="brand" className="w-full" size="lg" onClick={enviar} disabled={busy}>
            {busy ? "Enviando…" : "Enviar inscrição"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Após o envio, sua inscrição fica pendente de aprovação da equipe.</p>
        </div>
      </main>
    </div>
  );
}
