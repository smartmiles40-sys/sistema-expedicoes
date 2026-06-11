"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { STATUS_REQUISITO, COR_PRONTIDAO } from "@/lib/constants";
import { cn, daysUntil } from "@/lib/utils";
import { gerarRequisitosPadrao, atualizarRequisitoCampo } from "@/app/(app)/expedicoes/actions";
import type { Semaforo, ResultadoProntidao } from "@/lib/prontidao/regras";
import type { PassageiroRow, PassageiroRequisitoRow, TipoRequisito, Tables } from "@/types/database";

type Linha = {
  passageiro: PassageiroRow;
  resultado: ResultadoProntidao;
  requisitos: PassageiroRequisitoRow[];
};

interface Props {
  expedicaoId: string;
  destino: string;
  dataEmbarque: string;
  linhas: Linha[];
  usuarios: Tables<"usuarios">[];
}

const LABEL_CURTO: Record<TipoRequisito, string> = {
  Passaporte: "Passap.",
  RG: "RG",
  Visto: "Visto",
  Vacina: "Vacina",
  Seguro: "Seguro",
  "Aéreo Internacional": "Aéreo Int.",
  "Aéreo Doméstico": "Aéreo Dom.",
  Contrato: "Contrato",
  "Autorização de Menor": "Menor",
  Pagamento: "Financ.",
  "Dados Pessoais": "Cadastro",
};

const DOT: Record<Semaforo, string> = {
  ok: "bg-vinculado-600",
  atencao: "bg-atencao-600",
  bloqueio: "bg-critico-600",
  na: "bg-auto-600",
};

type Filtro = "todos" | "atencao" | "bloqueados";

export function ProntidaoTabela({ expedicaoId, destino, dataEmbarque, linhas, usuarios }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = React.useState<Filtro>("todos");
  const [editing, setEditing] = React.useState<{ pax: string; req: PassageiroRequisitoRow } | null>(null);
  const [gerando, startGerar] = React.useTransition();

  const usuariosById = React.useMemo(
    () => new Map(usuarios.map((u) => [u.id, u.nome])),
    [usuarios],
  );

  // Cabeçalhos = ordem das checagens (igual pra todos os pax).
  const colunas = linhas[0]?.resultado.checagens.map((c) => c.tipo) ?? [];
  const temInstancias = linhas.some((l) => l.requisitos.length > 0);

  const total = linhas.length;
  const aptos = linhas.filter((l) => l.resultado.prontidao === "Apto").length;
  const atencao = linhas.filter((l) => l.resultado.prontidao === "Atenção").length;
  const bloqueados = linhas.filter((l) => l.resultado.prontidao === "Bloqueado").length;
  const pct = total ? Math.round((aptos / total) * 100) : 0;
  const dias = daysUntil(dataEmbarque);

  const linhasFiltradas = linhas.filter((l) => {
    if (filtro === "bloqueados") return l.resultado.prontidao === "Bloqueado";
    if (filtro === "atencao") return l.resultado.prontidao !== "Apto";
    return true;
  });

  function gerar() {
    startGerar(async () => {
      const r = await gerarRequisitosPadrao(expedicaoId);
      if (r.ok) {
        toast.success(`Requisitos gerados (${r.total} itens)`);
        router.refresh();
      } else {
        toast.error("Erro ao gerar requisitos", { description: r.error });
      }
    });
  }

  if (total === 0) {
    return (
      <div className="rounded-md border border-border bg-background p-10 text-center text-muted-foreground">
        Sem passageiros nessa expedição ainda. Adicione passageiros para acompanhar a prontidão de embarque.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-vinculado-600" />
            <div>
              <h2 className="text-base font-semibold leading-tight">Prontidão de Embarque</h2>
              <p className="text-[11px] text-muted-foreground">
                {dias != null
                  ? dias >= 0 ? `Embarque em ${dias} dia(s)` : `Embarcou há ${-dias} dia(s)`
                  : "Sem data de embarque"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[13px]">
            <Resumo dot={DOT.ok} label="Aptos" valor={aptos} />
            <Resumo dot={DOT.atencao} label="Atenção" valor={atencao} />
            <Resumo dot={DOT.bloqueio} label="Bloqueados" valor={bloqueados} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-vinculado-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
            {aptos}/{total} aptos · {pct}%
          </span>
        </div>
      </div>

      {/* Filtros + gerar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["todos", "atencao", "bloqueados"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors",
                filtro === f
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "todos" ? "Todos" : f === "atencao" ? "Com pendência" : "Só bloqueados"}
            </button>
          ))}
        </div>
        {!temInstancias && (
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? "Gerando..." : `Gerar requisitos de ${destino}`}
          </Button>
        )}
      </div>

      {/* Tabela-semáforo */}
      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5 sticky left-0 bg-muted/40">
                  Passageiro
                </th>
                {colunas.map((tipo) => (
                  <th key={tipo} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2" title={tipo}>
                    {LABEL_CURTO[tipo]}
                  </th>
                ))}
                <th className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5">
                  Prontidão
                </th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map(({ passageiro, resultado, requisitos }) => {
                const reqById = new Map(requisitos.map((r) => [r.id, r]));
                return (
                  <tr key={passageiro.id} className="border-b border-border hover:bg-accent/30">
                    <td className="px-2.5 font-medium whitespace-nowrap sticky left-0 bg-background">
                      {passageiro.nome_completo}
                      {passageiro.tipo !== "Pagante" && (
                        <span className="ml-1 text-[10px] text-muted-foreground">({passageiro.tipo})</span>
                      )}
                    </td>
                    {resultado.checagens.map((c) => {
                      const req = c.requisito_id ? reqById.get(c.requisito_id) : null;
                      const clicavel = Boolean(req);
                      return (
                        <td key={c.tipo} className="px-2 text-center">
                          <button
                            type="button"
                            disabled={!clicavel}
                            onClick={() => req && setEditing({ pax: passageiro.nome_completo, req })}
                            title={`${c.descricao}\n${c.detalhe}${clicavel ? "\n(clique para editar)" : ""}`}
                            className={cn(
                              "inline-flex h-2.5 w-2.5 rounded-full align-middle",
                              DOT[c.semaforo],
                              clicavel ? "cursor-pointer ring-offset-1 hover:ring-2 hover:ring-foreground/30" : "cursor-default",
                            )}
                          >
                            <span className="sr-only">{c.semaforo}</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2.5 text-center">
                      <Badge variant={COR_PRONTIDAO[resultado.prontidao]}>
                        {resultado.prontidao}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <Legenda cor={DOT.ok} txt="OK" />
        <Legenda cor={DOT.atencao} txt="Atenção" />
        <Legenda cor={DOT.bloqueio} txt="Bloqueio" />
        <Legenda cor={DOT.na} txt="Dispensado/n/a" />
        <span className="ml-auto">Clique numa bolinha de requisito para verificar/editar.</span>
      </div>

      {editing && (
        <RequisitoDrawer
          expedicaoId={expedicaoId}
          paxNome={editing.pax}
          req={editing.req}
          usuarios={usuarios}
          usuariosById={usuariosById}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Resumo({ dot, label, valor }: { dot: string; label: string; valor: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full", dot)} />
      <span className="tabular-nums font-semibold">{valor}</span>
      <span className="text-muted-foreground text-[12px]">{label}</span>
    </div>
  );
}

function Legenda({ cor, txt }: { cor: string; txt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full", cor)} />
      {txt}
    </span>
  );
}

// =============================================================================
// Drawer de edição de um requisito
// =============================================================================
function RequisitoDrawer({
  expedicaoId, paxNome, req, usuarios, usuariosById, onClose,
}: {
  expedicaoId: string;
  paxNome: string;
  req: PassageiroRequisitoRow;
  usuarios: Tables<"usuarios">[];
  usuariosById: Map<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(req.status);
  const [validade, setValidade] = React.useState(req.validade?.slice(0, 10) ?? "");
  const [numero, setNumero] = React.useState(req.numero ?? "");
  const [responsavel, setResponsavel] = React.useState(req.responsavel_id ?? "_none");
  const [observacoes, setObservacoes] = React.useState(req.observacoes ?? "");
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    setSalvando(true);
    const mudancas: [string, unknown][] = [];
    if (status !== req.status) mudancas.push(["status", status]);
    if ((validade || null) !== (req.validade?.slice(0, 10) ?? null)) mudancas.push(["validade", validade || null]);
    if ((numero || null) !== (req.numero ?? null)) mudancas.push(["numero", numero || null]);
    const respValor = responsavel === "_none" ? null : responsavel;
    if (respValor !== req.responsavel_id) mudancas.push(["responsavel_id", respValor]);
    if ((observacoes || null) !== (req.observacoes ?? null)) mudancas.push(["observacoes", observacoes || null]);

    if (mudancas.length === 0) {
      onClose();
      setSalvando(false);
      return;
    }
    for (const [campo, valor] of mudancas) {
      const r = await atualizarRequisitoCampo(req.id, expedicaoId, campo, valor);
      if (!r.ok) {
        toast.error("Erro ao salvar", { description: r.error });
        setSalvando(false);
        return;
      }
    }
    toast.success("Requisito atualizado");
    setSalvando(false);
    onClose();
    router.refresh();
  }

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{req.tipo}</DrawerTitle>
          <DrawerDescription>
            {paxNome} — {req.descricao}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_REQUISITO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="req-validade">Validade</Label>
              <Input id="req-validade" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-numero">Número / Localizador</Label>
              <Input id="req-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="nº apólice, visto…" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Responsável</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— sem responsável —</SelectItem>
                {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="req-obs">Observações</Label>
            <textarea
              id="req-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
            />
          </div>

          {req.verificado_em && (
            <p className="text-[11px] text-muted-foreground">
              Verificado em {req.verificado_em.slice(0, 10)}
              {req.verificado_por && usuariosById.get(req.verificado_por)
                ? ` por ${usuariosById.get(req.verificado_por)}`
                : ""}
            </p>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
