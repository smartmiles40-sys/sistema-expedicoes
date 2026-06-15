"use client";
import * as React from "react";
import Link from "next/link";
import { Search, User, Plane, ArrowRight, Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ImportarPassageirosDrawer } from "@/app/(app)/expedicoes/[id]/passageiros/ImportarPassageirosDrawer";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody,
} from "@/components/ui/Drawer";
import { formatDate, formatBRL, daysUntil, cn } from "@/lib/utils";
import type { StatusReserva } from "@/types/database";
import type { PessoaAgregada } from "@/lib/data/pessoas";

const RESERVA_VARIANT: Record<StatusReserva, "vinculado" | "atencao" | "auto" | "critico"> = {
  Confirmado: "vinculado",
  "Pré-reserva": "atencao",
  Lead: "auto",
  Cancelado: "critico",
};

/** Idade em anos a partir da data de nascimento (ISO). */
function idade(nascimentoIso: string | null): number | null {
  if (!nascimentoIso) return null;
  const dias = daysUntil(nascimentoIso);
  if (dias == null) return null;
  return Math.floor(-dias / 365.25);
}

export function PassageirosGlobalTabela({
  pessoas,
  expedicoes,
}: {
  pessoas: PessoaAgregada[];
  expedicoes: { codigo: string; nome: string }[];
}) {
  const [busca, setBusca] = React.useState("");
  const [aberta, setAberta] = React.useState<PessoaAgregada | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? pessoas.filter((p) =>
        [p.nome_completo, p.cpf ?? "", p.email ?? "", p.passaporte ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(termo),
      )
    : pessoas;

  const totalParticipacoes = pessoas.reduce((s, p) => s + p.totalExpedicoes, 0);

  return (
    <div className="space-y-3">
      {/* Barra de busca + resumo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail…"
            className="pl-7"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {pessoas.length} pessoa{pessoas.length === 1 ? "" : "s"} · {totalParticipacoes} participaç{totalParticipacoes === 1 ? "ão" : "ões"} em expedições
          </p>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-3 w-3" /> Importar CSV
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>Nome</Th>
                <Th>CPF</Th>
                <Th>Idade</Th>
                <Th>Passaporte</Th>
                <Th>Validade</Th>
                <Th>E-mail</Th>
                <Th>Telefone</Th>
                <Th center>Expedições</Th>
                <Th center>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-8">
                    {pessoas.length === 0 ? "Nenhum passageiro cadastrado ainda." : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              ) : (
                filtradas.map((p) => {
                  const id = idade(p.data_nascimento);
                  return (
                    <tr key={p.chave} className="border-b border-border hover:bg-accent/30">
                      <td className="px-2.5 font-medium whitespace-nowrap">{p.nome_completo}</td>
                      <td className="px-2.5 tabular-nums font-mono text-[12px] text-muted-foreground">{p.cpf ?? "—"}</td>
                      <td className="px-2.5 tabular-nums">{id != null ? `${id}` : "—"}</td>
                      <td className="px-2.5 font-mono text-[12px]">
                        {p.passaporte ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2.5 tabular-nums text-muted-foreground">
                        {p.validade_passaporte ? formatDate(p.validade_passaporte) : "—"}
                      </td>
                      <td className="px-2.5 text-[12px] text-muted-foreground">{p.email ?? "—"}</td>
                      <td className="px-2.5 text-[12px] text-muted-foreground whitespace-nowrap">{p.telefone ?? "—"}</td>
                      <td className="px-2.5 text-center">
                        <Badge variant={p.totalExpedicoes > 0 ? "lista" : "auto"}>{p.totalExpedicoes}</Badge>
                      </td>
                      <td className="px-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setAberta(p)}
                          className="text-[12px] text-editavel-600 hover:underline"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aberta && (
        <PessoaDrawer pessoa={aberta} onClose={() => setAberta(null)} />
      )}

      <ImportarPassageirosDrawer
        modo="global"
        expedicoes={expedicoes}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={cn(
      "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5",
      center ? "text-center" : "text-left",
    )}>
      {children}
    </th>
  );
}

function PessoaDrawer({ pessoa, onClose }: { pessoa: PessoaAgregada; onClose: () => void }) {
  const id = idade(pessoa.data_nascimento);
  const saldo = pessoa.totalContratadoBrl - pessoa.totalPagoBrl;

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent width="w-[520px]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-editavel-600" /> {pessoa.nome_completo}
          </DrawerTitle>
          <DrawerDescription>
            {pessoa.totalExpedicoes} expediç{pessoa.totalExpedicoes === 1 ? "ão" : "ões"} ·{" "}
            {id != null ? `${id} anos` : "idade não informada"}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {/* Dados pessoais */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Dados pessoais
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              <Campo rotulo="CPF" valor={pessoa.cpf} mono />
              <Campo rotulo="Nascimento" valor={pessoa.data_nascimento ? formatDate(pessoa.data_nascimento) : null} />
              <Campo rotulo="Passaporte" valor={pessoa.passaporte} mono />
              <Campo rotulo="Validade passaporte" valor={pessoa.validade_passaporte ? formatDate(pessoa.validade_passaporte) : null} />
              <Campo rotulo="E-mail" valor={pessoa.email} />
              <Campo rotulo="Telefone" valor={pessoa.telefone} />
            </dl>
          </section>

          {/* Financeiro consolidado */}
          <section className="rounded-md border border-border p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Financeiro (somatório de todas as expedições)
            </h3>
            <div className="grid grid-cols-3 gap-2 text-[13px]">
              <div>
                <div className="text-[11px] text-muted-foreground">Contratado</div>
                <div className="tabular-nums font-medium">{formatBRL(pessoa.totalContratadoBrl, 0)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Pago</div>
                <div className="tabular-nums font-medium">{formatBRL(pessoa.totalPagoBrl, 0)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Saldo</div>
                <div className={cn("tabular-nums font-medium", saldo > 0 ? "text-atencao-600" : "text-vinculado-600")}>
                  {formatBRL(saldo, 0)}
                </div>
              </div>
            </div>
          </section>

          {/* Histórico de expedições */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Plane className="h-3.5 w-3.5" /> Expedições ({pessoa.expedicoes.length})
            </h3>
            <ul className="space-y-1">
              {pessoa.expedicoes.map((e, i) => (
                <li key={`${e.expedicao_id}-${i}`}>
                  <Link
                    href={`/expedicoes/${e.expedicao_id}/passageiros`}
                    className="flex items-center justify-between rounded-md border border-border p-2 hover:bg-accent transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{e.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.destino} · {formatDate(e.data_embarque)}
                        {e.tipo !== "Pagante" && ` · ${e.tipo}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={RESERVA_VARIANT[e.status_reserva]}>{e.status_reserva}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
      <dd className={cn("truncate", mono && "font-mono text-[12px]", !valor && "text-muted-foreground")}>
        {valor || "—"}
      </dd>
    </div>
  );
}
