"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, IdCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { atualizarAnexoPassaporte } from "@/app/(app)/expedicoes/actions";

/**
 * Anexo do passaporte no perfil do passageiro. É 1 por PESSOA
 * (passageiros.passaporte_arquivo_id) — anexado aqui, fica disponível em TODAS as
 * expedições da pessoa (propaga via CAMPOS_PESSOAIS). Único arquivo.
 */
export function PassaporteAnexo({
  expedicaoId,
  passageiroId,
  arquivoId,
}: {
  expedicaoId: string;
  passageiroId: string;
  arquivoId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function enviar(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("expedicao_id", expedicaoId);
      fd.append("passageiro_id", passageiroId);
      fd.append("categoria", "Documentos pessoais");
      fd.append("descricao", "Passaporte — prontidão");
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { toast.error("Falha no upload", { description: json.error }); return; }
      const r = await atualizarAnexoPassaporte(passageiroId, json.id);
      if (!r.ok) { toast.error("Falha ao salvar", { description: r.error }); return; }
      toast.success("Passaporte anexado", { description: "Disponível em todas as expedições do passageiro." });
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    if (!arquivoId) return;
    setBusy(true);
    try {
      const r = await atualizarAnexoPassaporte(passageiroId, null);
      if (!r.ok) { toast.error("Falha ao remover", { description: r.error }); return; }
      toast.success("Passaporte removido");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        <IdCard className="h-4 w-4 text-editavel-600" /> Passaporte
      </div>
      {arquivoId ? (
        <div className="flex items-center gap-2 rounded-lg border border-vinculado-600/30 bg-vinculado-50 p-2">
          <span className="flex-1 text-[13px] font-semibold text-vinculado-600">✓ Anexado</span>
          <a
            href={`/api/arquivos/${arquivoId}/download?inline=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-editavel-700 hover:underline"
          >
            Ver
          </a>
          <button type="button" onClick={remover} disabled={busy} className="text-[12px] font-medium text-critico-600 hover:underline">
            Remover
          </button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="h-3 w-3" /> {busy ? "Enviando…" : "Anexar passaporte"}
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => enviar(e.target.files?.[0] ?? null)} />
      <p className="text-[11px] text-muted-foreground">Foto ou PDF. Fica disponível em todas as expedições do passageiro.</p>
    </div>
  );
}
