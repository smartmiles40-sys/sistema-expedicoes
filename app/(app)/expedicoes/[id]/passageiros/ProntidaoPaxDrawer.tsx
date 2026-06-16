"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, ShieldCheck } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { STATUS_REQUISITO, COR_PRONTIDAO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { gerarRequisitosPadrao, atualizarRequisitoCampo } from "@/app/(app)/expedicoes/actions";
import type { Semaforo } from "@/lib/prontidao/regras";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";
import type { PassageiroRequisitoRow, Tables } from "@/types/database";

const DOT: Record<Semaforo, string> = {
  ok: "bg-vinculado-600",
  atencao: "bg-atencao-600",
  bloqueio: "bg-critico-600",
  na: "bg-auto-600",
};

interface Props {
  expedicaoId: string;
  destino: string;
  item: ProntidaoPassageiro | null;
  usuarios: Tables<"usuarios">[];
  onClose: () => void;
}

/**
 * Detalhe de prontidão de um passageiro: lista o semáforo por exigência e deixa
 * editar os requisitos de instância (visto, seguro, vacina…). Substitui a antiga
 * aba "Prontidão" — agora acessível pela coluna da tabela de Passageiros.
 */
export function ProntidaoPaxDrawer({ expedicaoId, destino, item, usuarios, onClose }: Props) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<PassageiroRequisitoRow | null>(null);
  const [gerando, startGerar] = React.useTransition();

  const usuariosById = React.useMemo(
    () => new Map(usuarios.map((u) => [u.id, u.nome])),
    [usuarios],
  );

  if (!item) return null;
  const { passageiro, resultado, requisitos } = item;
  const reqById = new Map(requisitos.map((r) => [r.id, r]));
  const temInstancias = requisitos.length > 0;

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

  return (
    <>
      <Drawer open onOpenChange={(v) => !v && onClose()}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-vinculado-600" />
              {passageiro.nome_completo}
            </DrawerTitle>
            <DrawerDescription className="flex items-center gap-2">
              Prontidão de embarque
              <Badge variant={COR_PRONTIDAO[resultado.prontidao]}>{resultado.prontidao}</Badge>
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {resultado.checagens.map((c) => {
                const req = c.requisito_id ? reqById.get(c.requisito_id) : null;
                const clicavel = Boolean(req);
                return (
                  <li key={c.tipo}>
                    <button
                      type="button"
                      disabled={!clicavel}
                      onClick={() => req && setEditando(req)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left",
                        clicavel ? "hover:bg-accent/40 cursor-pointer" : "cursor-default",
                      )}
                    >
                      <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", DOT[c.semaforo])} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{c.tipo}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{c.detalhe}</span>
                      </span>
                      {clicavel && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {!temInstancias && (
              <div className="mt-3 rounded-md border border-dashed border-border p-3 text-center">
                <p className="text-[12px] text-muted-foreground mb-2">
                  Requisitos de {destino} ainda não instanciados para esta expedição.
                </p>
                <Button onClick={gerar} disabled={gerando} size="sm">
                  {gerando ? "Gerando..." : `Gerar requisitos de ${destino}`}
                </Button>
              </div>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {editando && (
        <RequisitoDrawer
          expedicaoId={expedicaoId}
          paxNome={passageiro.nome_completo}
          req={editando}
          usuarios={usuarios}
          usuariosById={usuariosById}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}

// =============================================================================
// Drawer de edição de um requisito (movido da antiga aba Prontidão)
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
