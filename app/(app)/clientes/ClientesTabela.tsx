"use client";
import * as React from "react";
import { Search, ShoppingBag, Plane, User } from "lucide-react";
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

/**
 * Base de clientes puxada do Bitrix: cada pessoa que já FECHOU (negócio ganho),
 * com nº de compras, total gasto e o histórico de viagens. Fonte: compras_bitrix
 * (alimentada pelo n8n). Ordenada por quem mais gastou.
 */
export function ClientesTabela({ clientes }: { clientes: ClienteCompras[] }) {
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState<ClienteCompras | null>(null);

  const termo = busca.trim().toLowerCase();
  const filtrados = React.useMemo(() => {
    if (!termo) return clientes;
    return clientes.filter((c) =>
      [c.nome, c.cpf, ...c.compras.map((x) => x.titulo)].filter(Boolean).join(" ").toLowerCase().includes(termo),
    );
  }, [clientes, termo]);

  const totalGeral = React.useMemo(() => clientes.reduce((s, c) => s + c.totalGasto, 0), [clientes]);
  const totalCompras = React.useMemo(() => clientes.reduce((s, c) => s + c.totalCompras, 0), [clientes]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold inline-flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" /> Clientes & compras
          </h1>
          <p className="text-xs text-muted-foreground">
            Quem já comprou com a agência (negócios ganhos no Bitrix) e o histórico de viagens.
          </p>
        </div>
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou viagem…" className="pl-7" />
        </div>
      </div>

      {clientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <StatPill label="clientes" value={clientes.length} variant="editavel" />
          <StatPill label="compras" value={totalCompras} variant="lista" />
          <StatPill label="faturado (soma)" value={formatBRL(totalGeral)} variant="vinculado" />
        </div>
      )}

      {clientes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20">
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma compra importada ainda"
            description="Assim que o n8n enviar os negócios ganhos do Bitrix pra cá, a base de clientes aparece aqui — com total gasto e histórico de viagens de cada um."
          />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground">
          Nenhum cliente para a busca.
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <Th>Cliente</Th>
                  <Th>CPF</Th>
                  <Th className="text-right">Compras</Th>
                  <Th className="text-right">Total gasto</Th>
                  <Th>Última compra</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.chave}
                    onClick={() => setAberto(c)}
                    className="group border-b border-border hover:bg-accent/30 cursor-pointer"
                    title="Ver histórico de compras"
                  >
                    <td className="px-2.5 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Avatar nome={c.nome} size={24} className="shrink-0" />
                        <span className="text-editavel-700 group-hover:underline">{c.nome}</span>
                      </span>
                    </td>
                    <td className="px-2.5 font-mono text-[12px] tabular-nums text-muted-foreground">{c.cpf ?? "—"}</td>
                    <td className="px-2.5 text-right tabular-nums">{c.totalCompras}</td>
                    <td className="px-2.5 text-right tabular-nums font-semibold">
                      {formatBRL(c.totalGasto)}
                      {c.moedas.some((m) => m && m !== "BRL") && <span className="ml-1 text-[10px] text-atencao-600">*</span>}
                    </td>
                    <td className="px-2.5 tabular-nums text-muted-foreground">{c.ultimaCompra ? formatDate(c.ultimaCompra) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {clientes.some((c) => c.moedas.some((m) => m && m !== "BRL")) && (
        <p className="text-[11px] text-muted-foreground">* Cliente tem compras em outra moeda; o total soma os valores como estão.</p>
      )}

      {aberto && <ClienteDrawer cliente={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

function ClienteDrawer({ cliente, onClose }: { cliente: ClienteCompras; onClose: () => void }) {
  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent width="w-[520px]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-editavel-600" /> {cliente.nome}
          </DrawerTitle>
          <DrawerDescription>
            {cliente.cpf ? `CPF ${cliente.cpf} · ` : ""}
            {cliente.totalCompras} compra{cliente.totalCompras === 1 ? "" : "s"} · total {formatBRL(cliente.totalGasto)}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
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

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </th>
  );
}
