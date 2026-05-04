"use client";
import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TIPO_FORNECEDOR, STATUS_FORNECEDOR } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { FornecedorRow, StatusFornecedor } from "@/types/database";
import { toast } from "sonner";

const STATUS_VARIANT: Record<StatusFornecedor, "vinculado" | "atencao" | "critico"> = {
  Ativo: "vinculado",
  Pausado: "atencao",
  Bloqueado: "critico",
};

interface Props {
  fornecedores: FornecedorRow[];
  historico: Record<string, number>;
}

export function FornecedoresTabela({ fornecedores, historico }: Props) {
  const [busca, setBusca] = React.useState("");
  const [tipoFiltro, setTipoFiltro] = React.useState<string | null>(null);

  const filtrados = fornecedores.filter((f) => {
    if (tipoFiltro && f.tipo !== tipoFiltro) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const hay = `${f.nome} ${f.contato_nome ?? ""} ${f.destino_cidade ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Fornecedores</h1>
          <p className="text-xs text-muted-foreground">
            {filtrados.length} de {fornecedores.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-7 w-56"
            />
          </div>
          <Button onClick={() => toast.info("Drawer 'Novo Fornecedor' a implementar")}>
            <Plus className="h-3.5 w-3.5" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      {/* Tipo filtros */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo:</span>
        <Chip active={tipoFiltro === null} onClick={() => setTipoFiltro(null)}>Todos</Chip>
        {TIPO_FORNECEDOR.map((t) => (
          <Chip key={t} active={tipoFiltro === t} onClick={() => setTipoFiltro(tipoFiltro === t ? null : t)}>
            {t}
          </Chip>
        ))}
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Cidade / Destino</Th>
                <Th>Contato</Th>
                <Th>WhatsApp</Th>
                <Th>Moeda</Th>
                <Th>Status</Th>
                <Th className="text-right">Histórico</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum fornecedor.
                  </td>
                </tr>
              ) : (
                filtrados.map((f) => (
                  <tr key={f.id} className="border-b border-border hover:bg-accent/30">
                    <td className="px-2.5 font-medium">{f.nome}</td>
                    <td className="px-2.5"><Badge variant="lista">{f.tipo}</Badge></td>
                    <td className="px-2.5 text-muted-foreground">{f.destino_cidade ?? "—"}</td>
                    <td className="px-2.5">
                      <div className="text-[12px]">{f.contato_nome ?? "—"}</div>
                      {f.contato_email && <div className="text-[10px] text-muted-foreground">{f.contato_email}</div>}
                    </td>
                    <td className="px-2.5 tabular-nums text-[12px]">{f.contato_whatsapp ?? "—"}</td>
                    <td className="px-2.5 font-mono text-xs">{f.moeda_padrao}</td>
                    <td className="px-2.5"><Badge variant={STATUS_VARIANT[f.status]}>{f.status}</Badge></td>
                    <td className="px-2.5 text-right tabular-nums text-muted-foreground">
                      {historico[f.id] ?? 0} expediç{(historico[f.id] ?? 0) === 1 ? "ão" : "ões"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5", className)}>
      {children}
    </th>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
        active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
