"use client";
import * as React from "react";
import { Download, Plus, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EditableCell } from "@/components/tables/EditableCell";
import { atualizarPassageiroCampo } from "@/app/(app)/expedicoes/actions";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { STATUS_RESERVA, TIPO_PASSAGEIRO } from "@/lib/constants";
import type { PassageiroRow, QuartoRow, StatusReserva } from "@/types/database";
import { toast } from "sonner";

const STATUS_VARIANT: Record<StatusReserva, "lista" | "atencao" | "vinculado" | "critico"> = {
  Lead: "lista",
  "Pré-reserva": "atencao",
  Confirmado: "vinculado",
  Cancelado: "critico",
};

interface Props {
  expedicaoId: string;
  passageiros: PassageiroRow[];
  quartos: QuartoRow[];
  dataEmbarque: string;
}

export function PassageirosTabela({ expedicaoId, passageiros, quartos, dataEmbarque }: Props) {
  const [busca, setBusca] = React.useState("");
  const [statusFiltro, setStatusFiltro] = React.useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = React.useState<string | null>(null);

  const filtrados = passageiros.filter((p) => {
    if (statusFiltro && p.status_reserva !== statusFiltro) return false;
    if (tipoFiltro && p.tipo !== tipoFiltro) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const hay = `${p.nome_completo} ${p.cpf ?? ""} ${p.passaporte ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const quartosById = new Map(quartos.map((q) => [q.id, q]));

  function exportarCSV() {
    const header = ["Nome", "Tipo", "CPF", "Passaporte", "Validade", "Email", "Telefone", "Status", "Quarto"];
    const linhas = filtrados.map((p) => [
      p.nome_completo,
      p.tipo,
      p.cpf ?? "",
      p.passaporte ?? "",
      p.validade_passaporte ?? "",
      p.email ?? "",
      p.telefone ?? "",
      p.status_reserva,
      p.quarto_id ? quartosById.get(p.quarto_id)?.numero ?? "" : "",
    ]);
    const csv = [header, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `passageiros-${expedicaoId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar pax..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-7 w-56"
            />
          </div>
          <FilterPills
            label="Status"
            options={STATUS_RESERVA}
            value={statusFiltro}
            onChange={setStatusFiltro}
          />
          <FilterPills
            label="Tipo"
            options={TIPO_PASSAGEIRO}
            value={tipoFiltro}
            onChange={setTipoFiltro}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Sync Bitrix será implementado em P7")}
          >
            <RefreshCw className="h-3 w-3" /> Importar Bitrix
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCSV}>
            <Download className="h-3 w-3" /> Exportar
          </Button>
          <Button size="sm" onClick={() => toast.info("Drawer 'Adicionar manualmente' a implementar")}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>CPF</Th>
                <Th>Passaporte</Th>
                <Th>Validade</Th>
                <Th>Quarto</Th>
                <Th>Voo</Th>
                <Th>Status</Th>
                <Th>Observações</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum passageiro encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const validadeDias = daysUntil(p.validade_passaporte);
                  const embarqueDias = daysUntil(dataEmbarque);
                  const validadeAlerta = validadeDias != null && embarqueDias != null
                    ? validadeDias - embarqueDias < 180
                    : false;
                  const quarto = p.quarto_id ? quartosById.get(p.quarto_id) : null;
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-accent/30">
                      <td className="font-medium px-2.5">{p.nome_completo}</td>
                      <td className="px-2.5">
                        <Badge variant={p.tipo === "Líder" ? "lista" : p.tipo === "Cortesia" ? "auto" : "vinculado"}>
                          {p.tipo}
                        </Badge>
                      </td>
                      <td>
                        <EditableCell
                          value={p.cpf}
                          onSave={(v) => atualizarPassageiroCampo(p.id, "cpf", v)}
                        />
                      </td>
                      <td>
                        <EditableCell
                          value={p.passaporte}
                          onSave={(v) => atualizarPassageiroCampo(p.id, "passaporte", v)}
                        />
                      </td>
                      <td>
                        <div className={cn("px-1.5", validadeAlerta && "text-critico-600 font-medium")}>
                          {p.validade_passaporte ? formatDate(p.validade_passaporte) : "—"}
                          {validadeAlerta && <span className="text-[10px] block">⚠ &lt; 6m do embarque</span>}
                        </div>
                      </td>
                      <td className="px-2.5 text-muted-foreground">
                        {quarto ? `${quarto.numero} (${quarto.tipo})` : "—"}
                      </td>
                      <td className="px-2.5 text-muted-foreground tabular-nums">
                        {p.companhia_aerea ? `${p.companhia_aerea} ${p.localizador ?? ""}` : p.voo_nacional_necessario ? "Voo nac. pendente" : "—"}
                      </td>
                      <td className="px-2.5">
                        <Badge variant={STATUS_VARIANT[p.status_reserva]}>{p.status_reserva}</Badge>
                      </td>
                      <td>
                        <EditableCell
                          value={p.observacoes}
                          onSave={(v) => atualizarPassageiroCampo(p.id, "observacoes", v)}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Clique numa célula azul pra editar. Enter salva, Esc cancela, Tab vai pra próxima.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5">
      {children}
    </th>
  );
}

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}:</span>
      <button
        onClick={() => onChange(null)}
        className={cn(
          "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
          value === null
            ? "bg-foreground text-background border-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        Todos
      </button>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? null : o)}
          className={cn(
            "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
            value === o
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
