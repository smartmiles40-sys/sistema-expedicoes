"use client";
import * as React from "react";
import { Search, ShoppingBag, Plane, User, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { StatPill } from "@/components/ui/StatPill";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { formatBRL, formatDate, cn } from "@/lib/utils";
import type { ClienteCompras } from "@/lib/data/compras";

type SortKey = "nome" | "compras" | "total" | "ticket" | "primeira" | "ultima";
type Dir = "asc" | "desc";

const COLS: { key: SortKey; label: string; num: boolean; align?: "right" }[] = [
  { key: "nome", label: "Cliente", num: false },
  { key: "compras", label: "Compras", num: true, align: "right" },
  { key: "total", label: "Total gasto", num: true, align: "right" },
  { key: "ticket", label: "Ticket médio", num: true, align: "right" },
  { key: "primeira", label: "1ª compra", num: true },
  { key: "ultima", label: "Última compra", num: true },
];

const valorSort = (c: ClienteCompras, k: SortKey): string | number => {
  switch (k) {
    case "nome": return c.nome.toLowerCase();
    case "compras": return c.totalCompras;
    case "total": return c.totalGasto;
    case "ticket": return c.ticketMedio;
    case "primeira": return c.primeiraCompra ?? "";
    case "ultima": return c.ultimaCompra ?? "";
  }
};

const RECORRENCIA = [
  { id: "todos", label: "Todos", min: 0 },
  { id: "1", label: "1 compra", min: 1, max: 1 },
  { id: "2", label: "Recorrentes (2+)", min: 2 },
  { id: "5", label: "Fiéis (5+)", min: 5 },
  { id: "10", label: "VIP (10+)", min: 10 },
] as const;

/**
 * Base de clientes puxada do Bitrix (compras_bitrix). Tabela "planilha": colunas
 * ordenáveis (clique no cabeçalho → quem comprou mais/menos, maior ticket etc.),
 * filtro de recorrência e busca. Drawer com o histórico de viagens.
 */
export function ClientesTabela({ clientes }: { clientes: ClienteCompras[] }) {
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState<ClienteCompras | null>(null);
  const [sortKey, setSortKey] = React.useState<SortKey>("total");
  const [dir, setDir] = React.useState<Dir>("desc");
  const [rec, setRec] = React.useState<(typeof RECORRENCIA)[number]["id"]>("todos");

  function toggleSort(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setDir(k === "nome" ? "asc" : "desc"); } // números começam do maior
  }

  const termo = busca.trim().toLowerCase();
  const filtroRec = RECORRENCIA.find((r) => r.id === rec)!;

  const lista = React.useMemo(() => {
    let arr = clientes;
    if (termo) {
      arr = arr.filter((c) =>
        [c.nome, c.cpf, ...c.compras.map((x) => x.titulo)].filter(Boolean).join(" ").toLowerCase().includes(termo),
      );
    }
    arr = arr.filter((c) => c.totalCompras >= filtroRec.min && (!("max" in filtroRec) || c.totalCompras <= (filtroRec as { max: number }).max));
    const mult = dir === "asc" ? 1 : -1;
    return [...arr].sort((a, a2) => {
      const va = valorSort(a, sortKey), vb = valorSort(a2, sortKey);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
      return String(va).localeCompare(String(vb), "pt-BR") * mult;
    });
  }, [clientes, termo, filtroRec, sortKey, dir]);

  const totalGeral = React.useMemo(() => lista.reduce((s, c) => s + c.totalGasto, 0), [lista]);
  const totalCompras = React.useMemo(() => lista.reduce((s, c) => s + c.totalCompras, 0), [lista]);
  const temOutraMoeda = clientes.some((c) => c.moedas.some((m) => m && m !== "BRL"));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold inline-flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" /> Clientes & compras
          </h1>
          <p className="text-xs text-muted-foreground">
            Quem já comprou (Bitrix). Clique nas colunas pra ordenar — quem gastou mais, quem tem maior ticket, etc.
          </p>
        </div>
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou viagem…" className="pl-7" />
        </div>
      </div>

      {clientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <StatPill label={rec === "todos" ? "clientes" : "no filtro"} value={lista.length} variant="editavel" />
          <StatPill label="compras" value={totalCompras} variant="lista" />
          <StatPill label="faturado (soma)" value={formatBRL(totalGeral)} variant="vinculado" />
        </div>
      )}

      {/* Filtro de recorrência */}
      {clientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Recorrência:</span>
          {RECORRENCIA.map((r) => (
            <button
              key={r.id}
              onClick={() => setRec(r.id)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
                rec === r.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {clientes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20">
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma compra importada ainda"
            description="Assim que o n8n enviar as vendas do Bitrix pra cá, a base de clientes aparece aqui — com total gasto, ticket médio e histórico de viagens."
          />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground">
          Nenhum cliente com esses filtros.
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <Th>#</Th>
                  {COLS.map((c) => (
                    <ThSort key={c.key} col={c} sortKey={sortKey} dir={dir} onClick={() => toggleSort(c.key)} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((c, i) => (
                  <tr
                    key={c.chave}
                    onClick={() => setAberto(c)}
                    className="group border-b border-border hover:bg-accent/30 cursor-pointer"
                    title="Ver histórico de compras"
                  >
                    <td className="px-2.5 text-[11px] tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-2.5 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Avatar nome={c.nome} size={24} className="shrink-0" />
                        <span className="text-editavel-700 group-hover:underline">{c.nome}</span>
                        {c.totalCompras >= 10 && <Badge variant="atencao">VIP</Badge>}
                      </span>
                      {c.cpf && <span className="ml-8 block font-mono text-[10px] text-muted-foreground">{c.cpf}</span>}
                    </td>
                    <td className="px-2.5 text-right tabular-nums">{c.totalCompras}</td>
                    <td className="px-2.5 text-right tabular-nums font-semibold">
                      {formatBRL(c.totalGasto)}
                      {c.moedas.some((m) => m && m !== "BRL") && <span className="ml-1 text-[10px] text-atencao-600">*</span>}
                    </td>
                    <td className="px-2.5 text-right tabular-nums text-muted-foreground">{formatBRL(c.ticketMedio)}</td>
                    <td className="px-2.5 tabular-nums text-muted-foreground">{c.primeiraCompra ? formatDate(c.primeiraCompra) : "—"}</td>
                    <td className="px-2.5 tabular-nums text-muted-foreground">{c.ultimaCompra ? formatDate(c.ultimaCompra) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {temOutraMoeda && (
        <p className="text-[11px] text-muted-foreground">* Cliente tem compras em outra moeda; o total soma os valores como estão.</p>
      )}

      {aberto && <ClienteDrawer cliente={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

function ClienteDrawer({ cliente, onClose }: { cliente: ClienteCompras; onClose: () => void }) {
  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent width="w-[560px]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-editavel-600" /> {cliente.nome}
          </DrawerTitle>
          <DrawerDescription>
            {cliente.cpf ? `CPF ${cliente.cpf}` : "sem CPF"} · {cliente.totalCompras} compra{cliente.totalCompras === 1 ? "" : "s"}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {/* Resumo do cliente */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Resumo rotulo="Total gasto" valor={formatBRL(cliente.totalGasto)} destaque />
            <Resumo rotulo="Ticket médio" valor={formatBRL(cliente.ticketMedio)} />
            <Resumo rotulo="1ª compra" valor={cliente.primeiraCompra ? formatDate(cliente.primeiraCompra) : "—"} />
            <Resumo rotulo="Última" valor={cliente.ultimaCompra ? formatDate(cliente.ultimaCompra) : "—"} />
          </div>
          {cliente.funis.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Funis:</span>
              {cliente.funis.map((f) => <Badge key={f} variant="lista">{f}</Badge>)}
            </div>
          )}
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Plane className="h-3.5 w-3.5" /> Histórico de viagens ({cliente.compras.length})
          </h3>
          <ul className="space-y-1.5">
            {cliente.compras.map((co) => (
              <li key={co.id} className="rounded-md border border-border bg-background p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{co.titulo ?? "Negócio sem título"}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {co.data_compra && <span>{formatDate(co.data_compra)}</span>}
                      {co.funil && <Badge variant="lista">{co.funil}</Badge>}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-[13px]">
                    {co.valor != null ? formatBRL(co.valor) : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={cn("tabular-nums", destaque ? "text-[15px] font-bold" : "text-[13px] font-semibold")}>{valor}</div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </th>
  );
}

function ThSort({
  col, sortKey, dir, onClick,
}: {
  col: { key: SortKey; label: string; num: boolean; align?: "right" };
  sortKey: SortKey;
  dir: Dir;
  onClick: () => void;
}) {
  const ativo = sortKey === col.key;
  return (
    <th className={cn("whitespace-nowrap px-2.5", col.align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
          col.align === "right" && "flex-row-reverse",
          ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        title="Ordenar"
      >
        {col.label}
        {ativo ? (
          dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
