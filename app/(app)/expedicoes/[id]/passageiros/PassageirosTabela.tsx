"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, RefreshCw, Search, Upload, UserPlus, Users, Crown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { StatPill } from "@/components/ui/StatPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EditableCell } from "@/components/tables/EditableCell";
import { atualizarPassageiroCampo } from "@/app/(app)/expedicoes/actions";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { formatDate, daysUntil, cn, aniversarioNaViagem } from "@/lib/utils";
import { STATUS_RESERVA, TIPO_PASSAGEIRO, COR_PRONTIDAO } from "@/lib/constants";
import type { ArquivoRow, PassageiroRow, QuartoRow, StatusReserva, UsuarioRow } from "@/types/database";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";
import type { PessoaAgregada } from "@/lib/data/pessoas";
import { toast } from "sonner";
import { NovoPassageiroDrawer } from "./NovoPassageiroDrawer";
import { EditarPassageiroDrawer } from "./EditarPassageiroDrawer";
import { ImportarPassageirosDrawer } from "./ImportarPassageirosDrawer";
import { AdicionarExistenteDrawer } from "./AdicionarExistenteDrawer";
import { ProntidaoPaxDrawer } from "./ProntidaoPaxDrawer";
import { FidelidadeBadge } from "./FidelidadeBadge";
import { cpfDigitos } from "@/lib/csv/passageiros-import";

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
  arquivos: ArquivoRow[];
  dataEmbarque: string;
  dataRetorno: string;
  destino: string;
  prontidao: ProntidaoPassageiro[];
  usuarios: UsuarioRow[];
  pessoas: PessoaAgregada[];
  /** passageiro_id → posição cronológica desta expedição na história da pessoa. */
  posicoesFidelidade: Record<string, number>;
}

export function PassageirosTabela({ expedicaoId, passageiros, quartos, arquivos, dataEmbarque, dataRetorno, destino, prontidao, usuarios, pessoas, posicoesFidelidade }: Props) {
  const [busca, setBusca] = React.useState("");
  const [statusFiltro, setStatusFiltro] = React.useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [existenteOpen, setExistenteOpen] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [prontidaoPaxId, setProntidaoPaxId] = React.useState<string | null>(null);

  // Abre o perfil automaticamente quando chega de outra tela com ?editar=<id>
  // (ex.: clicar no nome do passageiro em /avisos). Limpa o param em seguida
  // pra não reabrir o drawer toda vez que o usuário fechá-lo.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editarParam = searchParams.get("editar");
  React.useEffect(() => {
    if (editarParam && passageiros.some((p) => p.id === editarParam)) {
      setEditandoId(editarParam);
      router.replace(pathname, { scroll: false });
    }
  }, [editarParam, passageiros, router, pathname]);
  const prontidaoByPax = React.useMemo(
    () => new Map(prontidao.map((p) => [p.passageiro.id, p])),
    [prontidao],
  );
  const prontidaoSelecionada = prontidaoPaxId ? prontidaoByPax.get(prontidaoPaxId) ?? null : null;
  const cpfsExistentes = React.useMemo(
    () => passageiros.map((p) => cpfDigitos(p.cpf)).filter((c): c is string => Boolean(c)),
    [passageiros],
  );
  const passageiroEditando = editandoId ? passageiros.find((p) => p.id === editandoId) ?? null : null;

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "passageiros", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "arquivos", filter: `expedicao_id=eq.${expedicaoId}` },
    ],
  });

  const indiceById = React.useMemo(() => {
    const ordenados = [...passageiros].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    );
    return new Map(ordenados.map((p, i) => [p.id, i + 1]));
  }, [passageiros]);

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

  // Líderes primeiro; dentro de cada grupo, mantém a ordem de cadastro (indiceById).
  const ordenados = [...filtrados].sort((a, b) => {
    const liderA = a.tipo === "Líder" ? 0 : 1;
    const liderB = b.tipo === "Líder" ? 0 : 1;
    if (liderA !== liderB) return liderA - liderB;
    return (indiceById.get(a.id) ?? 0) - (indiceById.get(b.id) ?? 0);
  });

  const quartosById = new Map(quartos.map((q) => [q.id, q]));

  // Duas caixas: Líderes (equipe) em cima e ExpedAmigos (passageiros) embaixo.
  const lideres = ordenados.filter((p) => p.tipo === "Líder");
  const expedAmigos = ordenados.filter((p) => p.tipo !== "Líder");
  const temLideres = passageiros.some((p) => p.tipo === "Líder");

  function renderLinha(p: PassageiroRow) {
    const validadeDias = daysUntil(p.validade_passaporte);
    const embarqueDias = daysUntil(dataEmbarque);
    const validadeAlerta = validadeDias != null && embarqueDias != null ? validadeDias - embarqueDias < 180 : false;
    const quarto = p.quarto_id ? quartosById.get(p.quarto_id) : null;
    const aniv = aniversarioNaViagem(p.data_nascimento, dataEmbarque, dataRetorno);
    return (
      <tr key={p.id} className="border-b border-border hover:bg-accent/30">
        <td className="px-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
          #{String(indiceById.get(p.id) ?? "").padStart(3, "0")}
        </td>
        <td className="font-medium px-2.5">
          <div className="flex items-center gap-2">
            <Avatar nome={p.nome_completo} size={24} className="shrink-0" src={p.foto_arquivo_id ? `/api/arquivos/${p.foto_arquivo_id}/download?inline=1` : undefined} />
            <button
              type="button"
              onClick={() => setEditandoId(p.id)}
              title="Abrir perfil do passageiro"
              className="text-left text-editavel-700 hover:underline"
            >
              {p.nome_completo}
            </button>
            <FidelidadeBadge posicao={posicoesFidelidade[p.id]} />
            {aniv && (
              <span
                title={`Faz aniversário durante a viagem — ${formatDate(aniv.data)}${aniv.idade != null ? ` (${aniv.idade} anos)` : ""}`}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-lista-100 px-1.5 py-0.5 text-[10px] font-medium text-lista-600"
              >
                🎂 {formatDate(aniv.data, "dd/MM")}
              </span>
            )}
          </div>
        </td>
        <td className="px-2.5">
          <Badge variant={p.tipo === "Líder" ? "lista" : p.tipo === "Cortesia" ? "auto" : "vinculado"}>
            {p.tipo}
          </Badge>
        </td>
        <td>
          <EditableCell value={p.cpf} onSave={(v) => atualizarPassageiroCampo(p.id, "cpf", v)} />
        </td>
        <td>
          <EditableCell value={p.passaporte} onSave={(v) => atualizarPassageiroCampo(p.id, "passaporte", v)} />
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
        <td className="px-2.5">
          <Badge variant={STATUS_VARIANT[p.status_reserva]}>{p.status_reserva}</Badge>
        </td>
        <td className="px-2.5">
          {(() => {
            const pr = prontidaoByPax.get(p.id);
            if (!pr) return <span className="text-muted-foreground">—</span>;
            return (
              <button
                type="button"
                onClick={() => setProntidaoPaxId(p.id)}
                title="Ver requisitos de embarque"
                className="rounded-sm focus:outline-none focus:ring-2 focus:ring-editavel-600"
              >
                <Badge variant={COR_PRONTIDAO[pr.resultado.prontidao]}>{pr.resultado.prontidao}</Badge>
              </button>
            );
          })()}
        </td>
        <td>
          <EditableCell value={p.observacoes} onSave={(v) => atualizarPassageiroCampo(p.id, "observacoes", v)} placeholder="—" />
        </td>
      </tr>
    );
  }

  function SecaoPax({ titulo, linhas, vazio }: { titulo: React.ReactNode; linhas: PassageiroRow[]; vazio: string }) {
    return (
      <div className="rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">{titulo}</div>
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>ID</Th>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>CPF</Th>
                <Th>Passaporte</Th>
                <Th>Validade</Th>
                <Th>Quarto</Th>
                <Th>Status</Th>
                <Th>Prontidão</Th>
                <Th>Observações</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-muted-foreground py-6 text-[12px]">{vazio}</td>
                </tr>
              ) : (
                linhas.map(renderLinha)
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function exportarCSV() {
    const header = ["Nome", "Tipo", "CPF", "Passaporte", "Validade", "Email", "Telefone", "Status", "Quarto"];
    const linhas = ordenados.map((p) => [
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
          <LiveBadge status={realtimeStatus} />
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
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3 w-3" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExistenteOpen(true)}>
            <UserPlus className="h-3 w-3" /> Adicionar existente
          </Button>
          <Button variant="brand" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      </div>

      {passageiros.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <StatPill label="Total" value={passageiros.length} />
          <StatPill label="Confirmados" value={passageiros.filter((p) => p.status_reserva === "Confirmado").length} variant="vinculado" />
          <StatPill label="Pré-reserva" value={passageiros.filter((p) => p.status_reserva === "Pré-reserva").length} variant="atencao" />
          <StatPill label="Leads" value={passageiros.filter((p) => p.status_reserva === "Lead").length} variant="lista" />
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <StatPill label="Aptos" value={prontidao.filter((p) => p.resultado.prontidao === "Apto").length} variant="vinculado" />
          <StatPill label="Atenção" value={prontidao.filter((p) => p.resultado.prontidao === "Atenção").length} variant="atencao" />
          <StatPill label="Bloqueados" value={prontidao.filter((p) => p.resultado.prontidao === "Bloqueado").length} variant="critico" />
        </div>
      )}

      {passageiros.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20">
          <EmptyState
            icon={Users}
            title="Nenhum passageiro ainda"
            description="Adicione manualmente, importe de uma planilha (CSV) ou puxe alguém que já está na base da agência."
            actionLabel="Adicionar passageiro"
            onAction={() => setDrawerOpen(true)}
          />
        </div>
      ) : (
        <>
          {temLideres && (
            <SecaoPax
              titulo={
                <>
                  <Crown className="h-4 w-4 text-[var(--brand-dark)]" />
                  <span className="text-[13px] font-semibold">Líderes</span>
                  <Badge variant="lista">{lideres.length}</Badge>
                  <span className="text-[11px] text-muted-foreground">não contam na ocupação</span>
                </>
              }
              linhas={lideres}
              vazio="Nenhum líder no filtro atual."
            />
          )}
          <SecaoPax
            titulo={
              <>
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-semibold">ExpedAmigos</span>
                <Badge variant="auto">{expedAmigos.length}</Badge>
                <span className="text-[11px] text-muted-foreground">passageiros</span>
              </>
            }
            linhas={expedAmigos}
            vazio="Nenhum passageiro no filtro atual."
          />
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Clique numa célula azul pra editar. Enter salva, Esc cancela, Tab vai pra próxima.
      </p>

      <NovoPassageiroDrawer
        expedicaoId={expedicaoId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <ImportarPassageirosDrawer
        modo="expedicao"
        expedicaoId={expedicaoId}
        cpfsExistentes={cpfsExistentes}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <AdicionarExistenteDrawer
        expedicaoId={expedicaoId}
        pessoas={pessoas}
        cpfsExistentes={cpfsExistentes}
        open={existenteOpen}
        onOpenChange={setExistenteOpen}
      />

      <EditarPassageiroDrawer
        expedicaoId={expedicaoId}
        passageiro={passageiroEditando}
        arquivos={arquivos}
        destino={destino}
        dataEmbarque={dataEmbarque}
        dataRetorno={dataRetorno}
        prontidao={passageiroEditando ? prontidaoByPax.get(passageiroEditando.id) ?? null : null}
        usuarios={usuarios}
        posicaoFidelidade={passageiroEditando ? posicoesFidelidade[passageiroEditando.id] ?? null : null}
        onOpenChange={(open) => !open && setEditandoId(null)}
      />

      <ProntidaoPaxDrawer
        expedicaoId={expedicaoId}
        destino={destino}
        item={prontidaoSelecionada}
        usuarios={usuarios}
        arquivos={arquivos}
        onClose={() => setProntidaoPaxId(null)}
      />
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
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
