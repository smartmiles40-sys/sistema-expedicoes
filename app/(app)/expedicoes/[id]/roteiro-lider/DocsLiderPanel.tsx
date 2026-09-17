"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MARCADOR_DOC_LIDER } from "@/lib/constants";

type Doc = { id: string; nome: string; mime: string | null };

/**
 * Documentos da EXPEDIÇÃO para a Área do Líder (ex.: manual do líder).
 * Sobem via /api/arquivos/upload (categoria "Outros" + descrição = MARCADOR_DOC_LIDER,
 * sem passageiro_id). Aparecem na seção "Documentos da expedição" do /lider.
 */
export function DocsLiderPanel({
  expedicaoId,
  docs,
}: {
  expedicaoId: string;
  docs: Doc[];
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
      fd.append("categoria", "Outros");
      fd.append("descricao", MARCADOR_DOC_LIDER);
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { toast.error("Falha no upload", { description: json.error }); return; }
      toast.success("Documento adicionado", { description: "Já aparece na Área do Líder." });
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Remover "${nome}" da Área do Líder?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/arquivos/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) { toast.error("Falha ao remover", { description: json.error }); return; }
      toast.success("Documento removido");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-editavel-600" />
        <h3 className="text-[14px] font-semibold">Documentos da Área do Líder</h3>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        PDFs da expedição para os líderes (ex.: manual do líder). Aparecem na seção
        “Documentos da expedição” do portal do líder e ficam disponíveis offline.
      </p>

      {docs.length > 0 ? (
        <ul className="mb-3 divide-y divide-border rounded-lg border border-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[13px]" title={d.nome}>{d.nome}</span>
              <a
                href={`/api/arquivos/${d.id}/download?inline=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-editavel-700 hover:underline"
              >
                Ver
              </a>
              <button
                type="button"
                onClick={() => remover(d.id, d.nome)}
                disabled={busy}
                className="text-[12px] font-medium text-critico-600 hover:underline disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground">
          Nenhum documento ainda.
        </p>
      )}

      <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload className="h-3 w-3" /> {busy ? "Enviando…" : "Adicionar PDF"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => enviar(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
