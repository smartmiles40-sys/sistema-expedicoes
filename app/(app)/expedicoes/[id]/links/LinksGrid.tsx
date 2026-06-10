"use client";
import * as React from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  Presentation,
  Globe,
  Folder,
  Video,
  MessageCircle,
  Link as LinkIcon,
  Pencil,
  Plus,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { excluirLink } from "@/app/(app)/expedicoes/actions";
import { cn } from "@/lib/utils";
import type { LinkExpedicaoRow } from "@/types/database";
import { LinkDrawer } from "./LinkDrawer";

interface Props {
  expedicaoId: string;
  links: LinkExpedicaoRow[];
}

/** Detecta o ícone apropriado pela URL ou label. */
function pickIcon(label: string, url: string): React.ComponentType<{ className?: string }> {
  const text = `${label} ${url}`.toLowerCase();
  if (/docs\.google\.com\/spreadsheets|sheet|planilha|excel|airtable/.test(text)) return FileSpreadsheet;
  if (/docs\.google\.com\/presentation|slides|presentation|apresenta|canva|figma/.test(text)) return Presentation;
  if (/drive\.google|dropbox|onedrive|pasta|folder/.test(text)) return Folder;
  if (/youtube|vimeo|video/.test(text)) return Video;
  if (/whatsapp|wa\.me|chat\.whatsapp|telegram|t\.me/.test(text)) return MessageCircle;
  if (/landing|^lp|setuforeu|site|domain/.test(text)) return Globe;
  return LinkIcon;
}

/** Normaliza URL pra mostrar mais limpa (sem protocolo, sem trailing). */
function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.host + u.pathname + u.search).replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function LinksGrid({ expedicaoId, links }: Props) {
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const linkEditando = editandoId ? links.find((l) => l.id === editandoId) ?? null : null;

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "links_expedicao", filter: `expedicao_id=eq.${expedicaoId}` },
    ],
  });

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Links da expedição</h2>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {links.length === 0
              ? "Nenhum link ainda — adicione o primeiro."
              : `${links.length} link${links.length === 1 ? "" : "s"} cadastrado${links.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3 w-3" /> Novo link
        </Button>
      </div>

      {links.length === 0 ? (
        <EmptyState onCreate={() => setNovoOpen(true)} />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {links.map((l) => {
            const Icon = pickIcon(l.label, l.url);
            return (
              <li
                key={l.id}
                className={cn(
                  "group rounded-md border border-border bg-background hover:border-foreground/40 transition-colors",
                  "flex items-center gap-2 p-2.5",
                )}
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 flex-1 min-w-0"
                  title={l.url}
                >
                  <span className="flex items-center justify-center h-9 w-9 rounded-md bg-muted/60 text-foreground shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] font-medium truncate inline-flex items-center gap-1">
                      {l.label}
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate font-mono">
                      {prettyUrl(l.url)}
                    </span>
                  </span>
                </a>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => copiar(l.url)}
                    aria-label="Copiar URL"
                    title="Copiar"
                    className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(l.id)}
                    aria-label="Editar link"
                    title="Editar"
                    className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <ConfirmDeleteButton
                    ariaLabel="Excluir link"
                    title={`Excluir "${l.label}"?`}
                    description="Esta ação não pode ser desfeita."
                    successMessage="Link excluído"
                    onConfirm={() => excluirLink(l.id, expedicaoId)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <LinkDrawer
        expedicaoId={expedicaoId}
        link={linkEditando}
        novoOpen={novoOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNovoOpen(false);
            setEditandoId(null);
          }
        }}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-md bg-muted/20">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
        <LinkIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nenhum link cadastrado</p>
      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm text-center">
        Cole aqui apresentação, landing page, planilha financeira, drive, grupo do WhatsApp — qualquer
        URL relevante pra essa expedição.
      </p>
      <Button size="sm" onClick={onCreate} className="mt-3">
        <Plus className="h-3 w-3" /> Adicionar primeiro link
      </Button>
    </div>
  );
}
