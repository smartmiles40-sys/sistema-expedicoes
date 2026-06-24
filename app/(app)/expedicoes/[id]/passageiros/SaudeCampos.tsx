"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils";
import type { SaudePassageiro } from "@/types/database";

type SaudeCampoKey = keyof SaudePassageiro;

/** Perguntas do bloco Saúde — Sim/Não + detalhe condicional (quando "Sim"). */
export const PERGUNTAS_SAUDE: {
  campo: SaudeCampoKey;
  pergunta: string;
  detalheCampo?: SaudeCampoKey;
  detalhePergunta?: string;
}[] = [
  { campo: "problema_saude", pergunta: "Você possui algum problema de saúde relevante?", detalheCampo: "problema_saude_qual", detalhePergunta: "Qual seria o problema de saúde?" },
  { campo: "medicamento_diario", pergunta: "Você toma algum medicamento diariamente?", detalheCampo: "medicamento_diario_qual", detalhePergunta: "Qual seria o medicamento?" },
  { campo: "alergia_medicamento", pergunta: "Possui alergia a medicamento?", detalheCampo: "alergia_medicamento_qual", detalhePergunta: "Qual medicamento você tem alergia?" },
  { campo: "alergia_alimentar", pergunta: "Possui alergia alimentar?", detalheCampo: "alergia_alimentar_qual", detalhePergunta: "Qual seria o alimento que você tem alergia?" },
  { campo: "restricao_alimentar", pergunta: "Possui restrição alimentar?", detalheCampo: "restricao_alimentar_qual", detalhePergunta: "Qual alimento você possui restrição alimentar?" },
  { campo: "limitacao_fisica", pergunta: "Possui limitação física que possa impactar caminhadas ou deslocamentos?", detalheCampo: "limitacao_fisica_qual", detalhePergunta: "Qual limitação física?" },
  { campo: "cirurgia_importante", pergunta: "Já realizou alguma cirurgia importante?", detalheCampo: "cirurgia_qual", detalhePergunta: "Qual cirurgia e quando?" },
  { campo: "vacina_febre_amarela", pergunta: "Você possui o Certificado Internacional de Vacinação contra Febre Amarela?" },
];

/**
 * Questionário de saúde reutilizável (controlado por value/onChange). Usado no
 * drawer da expedição (EditarPassageiroDrawer) e no perfil global (PessoaDrawer).
 * O anexo do certificado de Febre Amarela só aparece quando há expedição/passageiro
 * âncora (precisa pra subir o arquivo).
 */
export function SaudeCampos({
  value,
  onChange,
  expedicaoId,
  passageiroId,
}: {
  value: SaudePassageiro;
  onChange: (next: SaudePassageiro) => void;
  expedicaoId: string | null;
  passageiroId: string | null;
}) {
  const setCampo = (campo: SaudeCampoKey, v: string) => onChange({ ...value, [campo]: v });
  return (
    <div className="space-y-2.5">
      {PERGUNTAS_SAUDE.map((q) => {
        const val = value[q.campo] ?? "";
        return (
          <div key={q.campo} className="space-y-1.5 rounded-md border border-border/70 p-2.5">
            <Label className="text-[12px] leading-snug">{q.pergunta}</Label>
            <div className="flex gap-1.5">
              {(["Sim", "Não"] as const).map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setCampo(q.campo, val === opt ? "" : opt)}
                  className={cn(
                    "px-3 py-1 rounded-md border text-[12px] transition-colors",
                    val === opt ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            {q.detalheCampo && val === "Sim" && (
              <div className="space-y-1 pt-0.5">
                <Label className="text-[11px] text-muted-foreground">{q.detalhePergunta}</Label>
                <Input
                  value={value[q.detalheCampo] ?? ""}
                  onChange={(e) => setCampo(q.detalheCampo as SaudeCampoKey, e.target.value)}
                />
              </div>
            )}
            {q.campo === "vacina_febre_amarela" && val === "Sim" && expedicaoId && passageiroId && (
              <AnexoCertificado
                expedicaoId={expedicaoId}
                passageiroId={passageiroId}
                arquivoId={value.vacina_febre_amarela_arquivo_id ?? ""}
                onChange={(id) => setCampo("vacina_febre_amarela_arquivo_id", id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Anexar/ver/remover o Certificado de Vacinação (Febre Amarela) num pop-up. */
function AnexoCertificado({
  expedicaoId,
  passageiroId,
  arquivoId,
  onChange,
}: {
  expedicaoId: string;
  passageiroId: string;
  arquivoId: string;
  onChange: (id: string) => void;
}) {
  const [anexando, setAnexando] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [previewErro, setPreviewErro] = React.useState(false);
  const previewUrl = arquivoId ? `/api/arquivos/${arquivoId}/download?inline=1` : null;

  async function anexar(file: File) {
    setAnexando(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expedicao_id", expedicaoId);
    fd.append("passageiro_id", passageiroId);
    fd.append("categoria", "Documentos pessoais");
    fd.append("descricao", "Certificado Internacional de Vacinação — Febre Amarela");
    let json: { ok: boolean; id?: string; error?: string };
    try {
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      json = await res.json();
    } catch {
      json = { ok: false, error: "Falha de rede no upload" };
    }
    setAnexando(false);
    if (!json.ok || !json.id) {
      toast.error("Erro ao anexar", { description: json.error });
      return;
    }
    onChange(json.id);
    toast.success("Certificado anexado — clique em Salvar para confirmar");
  }

  return (
    <>
      <div className="space-y-1 pt-1">
        <Label className="text-[11px] text-muted-foreground">Certificado da vacina (anexo)</Label>
        {arquivoId ? (
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <span className="flex-1 truncate text-[13px] text-vinculado-700">Certificado anexado</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewErro(false);
                setLightboxOpen(true);
              }}
            >
              Ver
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
              Remover
            </Button>
          </div>
        ) : (
          <label
            className={cn(
              "flex items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-[13px] cursor-pointer hover:bg-accent/40",
              anexando && "opacity-60 pointer-events-none",
            )}
          >
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={anexando}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) anexar(f);
                e.target.value = "";
              }}
            />
            {anexando ? "Anexando..." : "Anexar certificado"}
          </label>
        )}
      </div>

      {lightboxOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {previewErro ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-background px-4 py-3 text-[13px] text-editavel-700 hover:underline"
            >
              Abrir certificado (PDF) em nova aba
            </a>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Certificado de vacinação (Febre Amarela)"
              onError={() => setPreviewErro(true)}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-xl"
            />
          )}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-background/90 px-3 py-1 text-[13px] font-medium hover:bg-background"
          >
            Fechar
          </button>
        </div>
      )}
    </>
  );
}
