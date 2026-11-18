"use client";

import * as React from "react";
import { toast } from "sonner";
import { Sparkles, Copy, FileText, FolderArchive, Loader2, Check } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerTitle, DrawerDescription, DrawerTrigger,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { extrairDossieClaude } from "@/app/(app)/expedicoes/[id]/extrair-actions";

type Dossie = {
  nomeBase: string;
  markdown: string;
  arquivos: { id: string; caminho: string; tamanho: number | null }[];
  idsPessoais: string[];
};

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Botão "Extrair p/ Claude": monta o dossiê (roteiro, voos, passeios, hospedagem,
 * rooming, vouchers, documentos por passageiro) pra colar na Claude e fazer o
 * double check. Variante "hero" = no banner escuro da expedição.
 */
export function ExtrairDadosClaude({
  expedicaoId,
  passageiroId,
  variante = "padrao",
}: {
  expedicaoId: string;
  passageiroId?: string;
  variante?: "padrao" | "hero";
}) {
  const [aberto, setAberto] = React.useState(false);
  const [dossie, setDossie] = React.useState<Dossie | null>(null);
  const [carregando, setCarregando] = React.useState(false);
  const [copiado, setCopiado] = React.useState(false);
  const [comPessoais, setComPessoais] = React.useState(true);
  const [zipando, setZipando] = React.useState<{ feitos: number; total: number } | null>(null);

  const carregar = React.useCallback(async () => {
    setCarregando(true);
    const r = await extrairDossieClaude(expedicaoId, passageiroId ?? null);
    setCarregando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setDossie(r.dossie);
  }, [expedicaoId, passageiroId]);

  function abrirFechar(v: boolean) {
    setAberto(v);
    if (v) {
      setDossie(null);
      setCopiado(false);
      void carregar();
    }
  }

  const arquivosZip = React.useMemo(() => {
    if (!dossie) return [];
    const pess = new Set(dossie.idsPessoais);
    return comPessoais ? dossie.arquivos : dossie.arquivos.filter((a) => !pess.has(a.id));
  }, [dossie, comPessoais]);
  const tamanhoZip = arquivosZip.reduce((s, a) => s + (a.tamanho ?? 0), 0);

  async function copiar() {
    if (!dossie) return;
    try {
      await navigator.clipboard.writeText(dossie.markdown);
      setCopiado(true);
      toast.success("Texto copiado — é só colar na Claude");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar; use 'Baixar texto'");
    }
  }

  async function baixarZip() {
    if (!dossie) return;
    const { zip, strToU8 } = await import("fflate");
    const arquivos: Record<string, Uint8Array> = {
      "00-LEIA-PRIMEIRO-dossie.md": strToU8(dossie.markdown),
    };
    const falhas: string[] = [];
    setZipando({ feitos: 0, total: arquivosZip.length });
    let feitos = 0;
    // 4 downloads em paralelo
    const fila = [...arquivosZip];
    async function trabalhador() {
      for (let item = fila.shift(); item; item = fila.shift()) {
        try {
          const r = await fetch(`/api/arquivos/${item.id}/download`);
          if (!r.ok) throw new Error(String(r.status));
          arquivos[item.caminho] = new Uint8Array(await r.arrayBuffer());
        } catch {
          falhas.push(item.caminho);
        }
        feitos++;
        setZipando({ feitos, total: arquivosZip.length });
      }
    }
    await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
    if (falhas.length) {
      arquivos["00-arquivos-que-falharam.txt"] = strToU8(
        "Estes arquivos não puderam ser baixados:\n" + falhas.join("\n"),
      );
    }
    zip(arquivos, { level: 0 }, (err, data) => {
      setZipando(null);
      if (err) {
        toast.error("Falha ao montar o ZIP");
        return;
      }
      baixar(new Blob([data as BlobPart], { type: "application/zip" }), `${dossie.nomeBase}.zip`);
      if (falhas.length) toast.warning(`${falhas.length} arquivo(s) não baixaram (lista dentro do ZIP)`);
      else toast.success("ZIP baixado");
    });
  }

  return (
    <Drawer open={aberto} onOpenChange={abrirFechar}>
      <DrawerTrigger asChild>
        {variante === "hero" ? (
          <button
            className="inline-flex items-center gap-1.5 self-center rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Extrair todos os dados pra conferir na Claude"
          >
            <Sparkles className="h-3.5 w-3.5" /> Extrair p/ Claude
          </button>
        ) : (
          <Button variant="outline" size="sm" title="Extrair os dados deste passageiro pra conferir na Claude">
            <Sparkles className="h-3.5 w-3.5" /> Extrair p/ Claude
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent width="w-[520px]">
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
          <div>
            <DrawerTitle className="text-base font-semibold">Extrair dados para a Claude</DrawerTitle>
            <DrawerDescription className="mt-1 text-[13px] text-muted-foreground">
              {passageiroId
                ? "Tudo deste passageiro: roteiro que ele vê, voos, passeios, hospedagem, quarto, vouchers e documentos."
                : "Tudo da viagem: roteiro dia a dia, voos, passeios, hospedagem/rooming, vouchers e os documentos de cada passageiro."}{" "}
              O texto já vem com as instruções do double check.
            </DrawerDescription>
          </div>

          {carregando || !dossie ? (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Juntando os dados…
            </div>
          ) : (
            <>
              <ol className="space-y-3 text-[13px]">
                <Passo n={1} titulo="Só o texto (rápido)">
                  <p className="text-muted-foreground">
                    Copie e cole numa conversa nova da Claude. Ela confere o que está cadastrado e aponta o que falta.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="brand" onClick={copiar}>
                      {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiado ? "Copiado" : "Copiar texto"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        baixar(new Blob([dossie.markdown], { type: "text/markdown;charset=utf-8" }), `${dossie.nomeBase}.md`)
                      }
                    >
                      <FileText className="h-3.5 w-3.5" /> Baixar texto (.md)
                    </Button>
                  </div>
                </Passo>
                <Passo n={2} titulo="Texto + vouchers e documentos (conferência completa)">
                  <p className="text-muted-foreground">
                    Baixa um ZIP com o texto e os {dossie.arquivos.length} arquivo(s) organizados em pastas. Descompacte e
                    arraste o <b>00-LEIA-PRIMEIRO-dossie.md</b> + os PDFs que quiser conferir pra Claude — aí ela lê os
                    vouchers e compara datas, nomes e hotéis com o roteiro.
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={comPessoais} onChange={(e) => setComPessoais(e.target.checked)} />
                    Incluir documentos pessoais (passaporte, vacina)
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={baixarZip} disabled={!!zipando || !arquivosZip.length}>
                      {zipando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderArchive className="h-3.5 w-3.5" />}
                      {zipando ? `Baixando ${zipando.feitos}/${zipando.total}…` : `Baixar ZIP (${arquivosZip.length} arquivos${tamanhoZip >= 100 * 1024 ? ` · ~${mb(tamanhoZip)}` : ""})`}
                    </Button>
                  </div>
                </Passo>
              </ol>

              <div className="rounded-lg border border-atencao-600/30 bg-atencao-100/40 p-2.5 text-[12px] text-muted-foreground">
                Contém dados pessoais de clientes (LGPD). Use só na conta da Claude da agência e não compartilhe o arquivo fora do time.
              </div>

              <div className="min-h-0 flex-1">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Prévia do texto</div>
                <pre className={cn("max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed")}>
                  {dossie.markdown}
                </pre>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-lime)] text-[11px] text-[var(--brand-dark)]">
          {n}
        </span>
        {titulo}
      </div>
      {children}
    </li>
  );
}
