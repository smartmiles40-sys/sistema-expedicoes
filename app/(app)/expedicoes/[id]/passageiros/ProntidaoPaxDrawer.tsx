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
import { Drive } from "@/components/arquivos/Drive";
import { STATUS_REQUISITO, COR_PRONTIDAO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { gerarRequisitosPadrao, atualizarRequisitoCampo, atualizarPassageiroCampo } from "@/app/(app)/expedicoes/actions";
import { REQUISITOS_COM_ANEXO_OBRIGATORIO, type Semaforo } from "@/lib/prontidao/regras";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";
import type { PassageiroRequisitoRow, PassageiroRow, ArquivoRow, Tables } from "@/types/database";

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
  arquivos: ArquivoRow[];
  onClose: () => void;
}

/**
 * Detalhe de prontidão de um passageiro: lista o semáforo por exigência e deixa
 * editar os requisitos de instância (visto, seguro, vacina…). Substitui a antiga
 * aba "Prontidão" — agora acessível pela coluna da tabela de Passageiros.
 */
export function ProntidaoPaxDrawer({ expedicaoId, destino, item, usuarios, arquivos, onClose }: Props) {
  if (!item) return null;
  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-vinculado-600" />
            {item.passageiro.nome_completo}
          </DrawerTitle>
          <DrawerDescription className="flex items-center gap-2">
            Prontidão de embarque
            <Badge variant={COR_PRONTIDAO[item.resultado.prontidao]}>{item.resultado.prontidao}</Badge>
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <ProntidaoConteudo
            expedicaoId={expedicaoId}
            destino={destino}
            item={item}
            usuarios={usuarios}
            arquivos={arquivos}
          />
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Conteúdo da prontidão (lista de exigências + edição/anexo). Reutilizável:
 * aparece no ProntidaoPaxDrawer (badge da tabela) e embutido no
 * EditarPassageiroDrawer (clique no nome do passageiro). Os sub-drawers de
 * edição (Requisito/Contrato) portalam pro body, então funcionam aninhados.
 */
export function ProntidaoConteudo({
  expedicaoId,
  destino,
  item,
  usuarios,
  arquivos,
  showBadge = false,
}: {
  expedicaoId: string;
  destino: string;
  item: ProntidaoPassageiro;
  usuarios: Tables<"usuarios">[];
  arquivos: ArquivoRow[];
  showBadge?: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<PassageiroRequisitoRow | null>(null);
  const [contratoOpen, setContratoOpen] = React.useState(false);
  const [gerando, startGerar] = React.useTransition();

  const usuariosById = React.useMemo(
    () => new Map(usuarios.map((u) => [u.id, u.nome])),
    [usuarios],
  );

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
      {showBadge && (
        <div className="flex items-center gap-2">
          <Badge variant={COR_PRONTIDAO[resultado.prontidao]}>{resultado.prontidao}</Badge>
          <span className="text-[12px] text-muted-foreground">Status geral de embarque</span>
        </div>
      )}
      <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
        {resultado.checagens.map((c) => {
          const req = c.requisito_id ? reqById.get(c.requisito_id) : null;
          const ehContrato = c.tipo === "Contrato";
          const clicavel = Boolean(req) || ehContrato;
          return (
            <li key={c.tipo}>
              <button
                type="button"
                disabled={!clicavel}
                onClick={() => {
                  if (req) setEditando(req);
                  else if (ehContrato) setContratoOpen(true);
                }}
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

      {contratoOpen && (
        <ContratoDrawer
          expedicaoId={expedicaoId}
          passageiro={passageiro}
          arquivos={arquivos}
          onClose={() => setContratoOpen(false)}
        />
      )}
    </>
  );
}

// =============================================================================
// Drawer do Contrato — marcar assinado + anexar o arquivo do contrato
// =============================================================================
function ContratoDrawer({
  expedicaoId, passageiro, arquivos, onClose,
}: {
  expedicaoId: string;
  passageiro: PassageiroRow;
  arquivos: ArquivoRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [assinado, setAssinado] = React.useState(passageiro.contrato_assinado ?? false);
  const [salvando, setSalvando] = React.useState(false);

  async function toggle(valor: boolean) {
    setAssinado(valor);
    setSalvando(true);
    const r = await atualizarPassageiroCampo(passageiro.id, "contrato_assinado", valor);
    setSalvando(false);
    if (r.ok) {
      toast.success(valor ? "Contrato marcado como assinado" : "Marcação de contrato removida");
      router.refresh();
    } else {
      setAssinado(!valor);
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  const arquivosDoPax = arquivos.filter((a) => a.passageiro_id === passageiro.id);

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Contrato — {passageiro.nome_completo}</DrawerTitle>
          <DrawerDescription>Marque a assinatura e anexe o contrato do passageiro.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <label className="flex items-center gap-2.5 rounded-md border border-border p-3 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={assinado}
              disabled={salvando}
              onChange={(e) => toggle(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="font-medium">Contrato assinado</span>
          </label>

          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">Arquivo do contrato</h3>
            <p className="text-[11px] text-muted-foreground">
              Anexe o PDF/imagem do contrato assinado. Fica na pasta &quot;Contrato&quot; do passageiro.
            </p>
            <Drive
              expedicaoId={expedicaoId}
              passageiroId={passageiro.id}
              arquivos={arquivosDoPax}
              categorias={["Contrato"]}
              pastaInicial="Contrato"
            />
          </div>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
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
  const [arquivoId, setArquivoId] = React.useState(req.arquivo_id);
  const [anexando, setAnexando] = React.useState(false);
  const [previewErro, setPreviewErro] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const exigeAnexo = REQUISITOS_COM_ANEXO_OBRIGATORIO.has(req.tipo);
  const previewUrl = arquivoId ? `/api/arquivos/${arquivoId}/download?inline=1` : null;

  async function anexarDocumento(file: File) {
    setAnexando(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expedicao_id", expedicaoId);
    fd.append("passageiro_id", req.passageiro_id);
    fd.append("categoria", "Documentos pessoais");
    fd.append("descricao", `${req.tipo} — prontidão`);
    let json: { ok: boolean; id?: string; error?: string };
    try {
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      json = await res.json();
    } catch {
      json = { ok: false, error: "Falha de rede no upload" };
    }
    if (!json.ok || !json.id) {
      toast.error("Erro ao anexar", { description: json.error });
      setAnexando(false);
      return;
    }
    const r = await atualizarRequisitoCampo(req.id, expedicaoId, "arquivo_id", json.id);
    setAnexando(false);
    if (!r.ok) {
      toast.error("Erro ao vincular o anexo", { description: r.error });
      return;
    }
    setArquivoId(json.id);
    setPreviewErro(false);
    toast.success("Documento anexado");
    router.refresh();
  }

  async function removerAnexo() {
    const r = await atualizarRequisitoCampo(req.id, expedicaoId, "arquivo_id", null);
    if (!r.ok) {
      toast.error("Erro ao remover o anexo", { description: r.error });
      return;
    }
    setArquivoId(null);
    toast.success("Anexo removido");
    router.refresh();
  }

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
    <>
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

          {exigeAnexo && (
            <div className="space-y-1">
              <Label>Documento anexado</Label>
              {arquivoId && previewUrl ? (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <span className="flex-1 text-[13px] text-vinculado-700">Documento anexado</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLightboxOpen(true)}>
                    Ver documento
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={removerAnexo}>
                    Remover
                  </Button>
                </div>
              ) : (
                <label
                  className={cn(
                    "flex items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-[13px] cursor-pointer hover:bg-accent/40",
                    anexando && "opacity-60 pointer-events-none",
                  )}
                >
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={anexando}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) anexarDocumento(f);
                      e.target.value = "";
                    }}
                  />
                  {anexando ? "Anexando..." : "Anexar foto do documento"}
                </label>
              )}
              <p className="text-[11px] text-muted-foreground">
                Obrigatório para a prontidão. Fica na pasta &quot;Documentos pessoais&quot; do passageiro.
              </p>
            </div>
          )}

          {!exigeAnexo && (
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
          )}

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

          {!exigeAnexo && (
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
          )}

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

    {lightboxOpen && previewUrl && (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
        onClick={() => setLightboxOpen(false)}
      >
        {previewErro ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-md bg-background px-4 py-3 text-[13px] text-editavel-700 hover:underline"
          >
            Abrir documento (PDF) em nova aba
          </a>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Documento anexado"
            onError={() => setPreviewErro(true)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-xl"
          />
        )}
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="absolute top-4 right-4 rounded-full bg-background/90 px-3 py-1 text-[13px] font-medium hover:bg-background"
        >
          Fechar
        </button>
      </div>
    )}
    </>
  );
}
