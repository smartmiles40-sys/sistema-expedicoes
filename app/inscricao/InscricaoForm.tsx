"use client";
import * as React from "react";
import { toast } from "sonner";
import { Compass, Upload, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { cn, formatDate, mascaraTelefone } from "@/lib/utils";
import { mascaraCpf } from "@/lib/cpf";
import { SaudeCampos } from "@/app/(app)/expedicoes/[id]/passageiros/SaudeCampos";
import type { SaudePassageiro } from "@/types/database";
import { enviarInscricao, type ExpedicaoOpcao } from "./actions";

/** Grupo Sim/Não → boolean|null. */
function SimNao({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex gap-1.5">
      {([["Sim", true], ["Não", false]] as const).map(([label, v]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(value === v ? null : v)}
          className={cn(
            "rounded-md border px-3 py-1 text-[13px] transition-colors",
            value === v ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Grupo de opções de texto (chips). */
function Opcoes({ opcoes, value, onChange }: { opcoes: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          className={cn(
            "rounded-md border px-3 py-1 text-[13px] transition-colors",
            value === o ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
          )}
        >
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
  nome_completo: "", cpf: "", data_nascimento: "", email: "", telefone: "",
  passaporte: "", validade_passaporte: "",
  endereco_cep: "", endereco_rua: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cidade: "", endereco_estado: "",
  contato_emergencia_nome: "", contato_emergencia_fone: "", contato_emergencia_vinculo: "",
  paises_visitados: "", acompanhante_nome: "",
};

export function InscricaoForm({ expedicoes }: { expedicoes: ExpedicaoOpcao[] }) {
  const [expedicaoId, setExpedicaoId] = React.useState("");
  const [f, setF] = React.useState({ ...CAMPOS_TEXTO_VAZIO });
  const [prefAssento, setPrefAssento] = React.useState<boolean | null>(null);
  const [prefUpgrade, setPrefUpgrade] = React.useState<string | null>(null);
  const [jaViajou, setJaViajou] = React.useState<boolean | null>(null);
  const [acompanhado, setAcompanhado] = React.useState<boolean | null>(null);
  const [divideQuarto, setDivideQuarto] = React.useState<string | null>(null);
  const [saude, setSaude] = React.useState<SaudePassageiro>({});
  const [passaporteFile, setPassaporteFile] = React.useState<File | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [ok, setOk] = React.useState(false);

  const set = (k: keyof typeof CAMPOS_TEXTO_VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function enviar() {
    if (!expedicaoId) return toast.error("Selecione a expedição desejada.");
    if (!passaporteFile) return toast.error("Anexe a foto ou PDF do seu passaporte.");
    setEnviando(true);
    try {
      const dados = {
        expedicao_id: expedicaoId,
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
      fd.append("passaporte", passaporteFile);
      const r = await enviarInscricao(fd);
      if (r.ok) setOk(true);
      else toast.error("Não foi possível enviar", { description: r.error });
    } catch {
      toast.error("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-vinculado-600" />
        <h1 className="mt-4 text-xl font-semibold">Inscrição enviada! 🎉</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Recebemos seus dados. Nossa equipe vai revisar e confirmar sua inscrição em breve. Qualquer dúvida, fale com a agência.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-brand-gradient px-4 py-6 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Compass className="h-6 w-6" />
          <div>
            <div className="font-display text-lg font-semibold leading-none">Se Tu For, Eu Vou</div>
            <div className="text-[12px] text-white/70">Ficha de inscrição da expedição</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Secao titulo="Sua expedição">
          <Campo label="Qual expedição você quer participar?">
            <select
              value={expedicaoId}
              onChange={(e) => setExpedicaoId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
            >
              <option value="">Selecione…</option>
              {expedicoes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} — {e.destino} · {formatDate(e.data_embarque)}
                </option>
              ))}
            </select>
          </Campo>
        </Secao>

        <Secao titulo="Dados pessoais">
          <Campo label="Nome completo"><Input value={f.nome_completo} onChange={set("nome_completo")} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CPF">
              <Input
                value={f.cpf}
                onChange={(e) => setF((p) => ({ ...p, cpf: mascaraCpf(e.target.value) }))}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </Campo>
            <Campo label="Data de nascimento"><Input type="date" value={f.data_nascimento} onChange={set("data_nascimento")} /></Campo>
            <Campo label="E-mail"><Input type="email" value={f.email} onChange={set("email")} /></Campo>
            <Campo label="Telefone / WhatsApp">
              <Input
                value={f.telefone}
                onChange={(e) => setF((p) => ({ ...p, telefone: mascaraTelefone(e.target.value) }))}
                inputMode="tel"
                placeholder="(00) 00000-0000"
              />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="Endereço">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CEP"><Input value={f.endereco_cep} onChange={set("endereco_cep")} inputMode="numeric" /></Campo>
            <Campo label="Cidade"><Input value={f.endereco_cidade} onChange={set("endereco_cidade")} /></Campo>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Campo label="Logradouro"><Input value={f.endereco_rua} onChange={set("endereco_rua")} /></Campo>
            <Campo label="Número"><Input value={f.endereco_numero} onChange={set("endereco_numero")} /></Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Complemento"><Input value={f.endereco_complemento} onChange={set("endereco_complemento")} /></Campo>
            <Campo label="Bairro"><Input value={f.endereco_bairro} onChange={set("endereco_bairro")} /></Campo>
          </div>
          <Campo label="Estado (UF)"><Input value={f.endereco_estado} onChange={set("endereco_estado")} maxLength={20} /></Campo>
        </Secao>

        <Secao titulo="Passaporte">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Número do passaporte"><Input value={f.passaporte} onChange={set("passaporte")} /></Campo>
            <Campo label="Validade"><Input type="date" value={f.validade_passaporte} onChange={set("validade_passaporte")} /></Campo>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px]">Anexo do passaporte (foto ou PDF) — obrigatório</Label>
            <label className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] hover:bg-accent/40",
              passaporteFile && "border-solid border-vinculado-600/40 bg-vinculado-50",
            )}>
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{passaporteFile ? passaporteFile.name : "Escolher arquivo"}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setPassaporteFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </Secao>

        <Secao titulo="Contato de emergência">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome"><Input value={f.contato_emergencia_nome} onChange={set("contato_emergencia_nome")} /></Campo>
            <Campo label="Telefone">
              <Input
                value={f.contato_emergencia_fone}
                onChange={(e) => setF((p) => ({ ...p, contato_emergencia_fone: mascaraTelefone(e.target.value) }))}
                inputMode="tel"
                placeholder="(00) 00000-0000"
              />
            </Campo>
          </div>
          <Campo label="Vínculo com você">
            <Input value={f.contato_emergencia_vinculo} onChange={set("contato_emergencia_vinculo")} placeholder="Ex.: mãe, pai, irmão, cônjuge, amigo(a)…" />
          </Campo>
        </Secao>

        <Secao titulo="Preferências de voo">
          <Campo label="Deseja marcar assento?"><SimNao value={prefAssento} onChange={setPrefAssento} /></Campo>
          <Campo label="Deseja upgrade de classe?">
            <Opcoes opcoes={["Não", "Executiva", "Primeira classe"]} value={prefUpgrade} onChange={setPrefUpgrade} />
          </Campo>
        </Secao>

        <Secao titulo="Experiência de viagem">
          <Campo label="Você já realizou viagens internacionais / visitou outros países?">
            <SimNao value={jaViajou} onChange={setJaViajou} />
          </Campo>
          {jaViajou && (
            <Campo label="Quais países você já visitou?"><Input value={f.paises_visitados} onChange={set("paises_visitados")} /></Campo>
          )}
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
          <Button variant="brand" className="w-full" size="lg" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar inscrição"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Após o envio, sua inscrição fica pendente de aprovação da equipe.
          </p>
        </div>
      </main>
    </div>
  );
}
