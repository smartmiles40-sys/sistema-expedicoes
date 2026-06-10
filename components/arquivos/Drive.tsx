"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Plane,
  IdCard,
  Ticket,
  Stamp,
  ShieldCheck,
  Building,
  Receipt,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CATEGORIA_ARQUIVO, type CategoriaArquivo } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ArquivoRow } from "@/types/database";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

const ICONES: Record<CategoriaArquivo, React.ComponentType<{ className?: string }>> = {
  Aéreos: Plane,
  "Documentos pessoais": IdCard,
  Bilhetes: Ticket,
  Vistos: Stamp,
  Seguros: ShieldCheck,
  Hospedagem: Building,
  Vouchers: Receipt,
  Outros: Folder,
};

interface Props {
  expedicaoId: string;
  passageiroId?: string | null;
  arquivos: ArquivoRow[];
  /** Categorias que aparecem como pastas. Default = todas. */
  categorias?: readonly CategoriaArquivo[];
}

export function Drive({ expedicaoId, passageiroId, arquivos, categorias = CATEGORIA_ARQUIVO }: Props) {
  const router = useRouter();
  const [pastaAtiva, setPastaAtiva] = React.useState<CategoriaArquivo | "Todos">("Todos");
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useRealtimeRefresh({
    subscriptions: [
      {
        table: "arquivos",
        filter: `expedicao_id=eq.${expedicaoId}`,
        // Se for Drive de um passageiro específico, ignora eventos de outros pax.
        onChange: passageiroId
          ? (payload) => {
              const row = (payload.new ?? payload.old) as { passageiro_id?: string | null };
              return row?.passageiro_id === passageiroId;
            }
          : undefined,
      },
    ],
  });

  const filtrados = pastaAtiva === "Todos" ? arquivos : arquivos.filter((a) => a.categoria === pastaAtiva);
  const contagem = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const a of arquivos) m.set(a.categoria, (m.get(a.categoria) ?? 0) + 1);
    return m;
  }, [arquivos]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("expedicao_id", expedicaoId);
        if (passageiroId) fd.append("passageiro_id", passageiroId);
        fd.append("categoria", pastaAtiva === "Todos" ? "Outros" : pastaAtiva);
        const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(`Falhou: ${f.name}`, { description: json.error });
        }
      }
      toast.success(`${list.length} arquivo${list.length > 1 ? "s" : ""} enviado${list.length > 1 ? "s" : ""}`);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function deletar(arq: ArquivoRow) {
    if (!confirm(`Apagar "${arq.nome}"?`)) return;
    const res = await fetch(`/api/arquivos/${arq.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      toast.error("Erro ao apagar", { description: json.error });
      return;
    }
    toast.success("Arquivo apagado");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Pastas */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <PastaChip
          label="Todos"
          ativa={pastaAtiva === "Todos"}
          count={arquivos.length}
          onClick={() => setPastaAtiva("Todos")}
        />
        {categorias.map((cat) => {
          const Icon = ICONES[cat];
          return (
            <PastaChip
              key={cat}
              label={cat}
              ativa={pastaAtiva === cat}
              count={contagem.get(cat) ?? 0}
              onClick={() => setPastaAtiva(cat)}
              icon={<Icon className="h-3.5 w-3.5" />}
            />
          );
        })}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-md border-2 border-dashed p-4 transition-colors",
          dragOver ? "border-foreground bg-muted/40" : "border-border bg-muted/20",
          uploading && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            Arraste arquivos aqui ou clique pra selecionar
            {pastaAtiva !== "Todos" && (
              <span>
                · pasta: <strong className="text-foreground">{pastaAtiva}</strong>
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="h-3 w-3" /> {uploading ? "Enviando..." : "Selecionar arquivos"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border rounded-md">
          {pastaAtiva === "Todos" ? "Nenhum arquivo ainda." : `Nenhum arquivo em ${pastaAtiva}.`}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border overflow-hidden bg-background">
          {filtrados.map((a) => {
            const Icon = ICONES[a.categoria as CategoriaArquivo] ?? FileText;
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{a.nome}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>{a.categoria}</span>
                    {a.tamanho_bytes != null && <span>· {formatSize(a.tamanho_bytes)}</span>}
                    <span>· {new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <a
                  href={`/api/arquivos/${a.id}/download`}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => deletar(a)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-critico-600"
                  title="Apagar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PastaChip({
  label,
  ativa,
  count,
  onClick,
  icon,
}: {
  label: string;
  ativa: boolean;
  count: number;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] transition-all",
        ativa
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground hover:border-foreground/40 hover:bg-muted/50",
      )}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-semibold tabular-nums px-1",
            ativa ? "bg-background/20 text-background" : "bg-foreground text-background",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
