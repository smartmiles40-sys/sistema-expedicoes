"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, ShieldCheck, Paperclip, Trash2 } from "lucide-react";
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
import { gerarRequisitosPadrao, atualizarRequisitoCampo, atualizarPassageiroCampo, criarRequisitoInstancia } from "@/app/(app)/expedicoes/actions";
import { REQUISITOS_COM_ANEXO_OBRIGATORIO, REQUISITOS_DE_COLUNA, type Semaforo } from "@/lib/prontidao/regras";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";
import type {
  PassageiroRequisitoRow, PassageiroRow, ArquivoRow, Tables,
  StatusRequisito, TipoRequisito, CategoriaArquivo,
} from "@/types/database";

const DOT: Record<Semaforo, string> = {
  ok: "bg-vinculado-600",
  atencao: "bg-atencao-600",
  bloqueio: "bg-critico-600",
  na: "bg-auto-600",
};

/** Cores da pílula de status: `off` (clarinho, clicável) e `on` (selecionado, sólido). */
const STATUS_COR: Record<StatusRequisito, { off: string; on: string }> = {
  Aprovado:    { off: "border-vinculado-600/40 bg-vinculado-50 text-vinculado-600 hover:bg-vinculado-100", on: "border-vinculado-600 bg-vinculado-600 text-white shadow-sm" },
  Dispensado:  { off: "border-vinculado-600/40 bg-vinculado-50 text-vinculado-600 hover:bg-vinculado-100", on: "border-vinculado-600 bg-vinculado-600 text-white shadow-sm" },
  Enviado:     { off: "border-editavel-600/40 bg-editavel-50 text-editavel-600 hover:bg-editavel-100", on: "border-editavel-600 bg-editavel-600 text-white shadow-sm" },
  "Em análise":{ off: "border-lista-600/40 bg-lista-50 text-lista-600 hover:bg-lista-100", on: "border-lista-600 bg-lista-600 text-white shadow-sm" },
  Pendente:    { off: "border-atencao-600/40 bg-atencao-50 text-atencao-600 hover:bg-atencao-100", on: "border-atencao-600 bg-atencao-600 text-white shadow-sm" },
  Vencido:     { off: "border-critico-600/40 bg-critico-50 text-critico-600 hover:bg-critico-100", on: "border-critico-600 bg-critico-600 text-white shadow-sm" },
  Reprovado:   { off: "border-critico-600/40 bg-critico-50 text-critico-600 hover:bg-critico-100", on: "border-critico-600 bg-critico-600 text-white shadow-sm" },
};

/** Requisitos com anexo: para onde vai o arquivo + textos amigáveis. */
const ANEXO_CONFIG: Partial<Record<TipoRequisito, { categoria: CategoriaArquivo; label: string; dica: string }>> = {
  "Documento Pessoal": {
    categoria: "Documentos pessoais",
    label: "Anexar foto do documento",
    dica: "RG, CNH ou passaporte. Anexar já deixa a exigência aprovada.",
  },
  "Aéreo Internacional": {
    categoria: "Aéreos",
    label: "Anexar voucher / bilhete aéreo",
    dica: "Anexar o voucher já deixa o aéreo internacional aprovado.",
  },
  "Aéreo Doméstico": {
    categoria: "Aéreos",
    label: "Anexar voucher / bilhete (trecho doméstico)",
    dica: "Anexar o voucher já deixa o trecho doméstico aprovado.",
  },
  Seguro: {
    categoria: "Seguros",
    label: "Anexar apólice do seguro",
    dica: "Anexar a apólice já deixa o seguro aprovado.",
  },
  Vacina: {
    categoria: "Documentos pessoais",
    label: "Anexar certificado de vacinação",
    dica: "Anexar o certificado já deixa a vacina aprovada.",
  },
};

/** Botão de opção Sim/Não (verde = sim, cinza = não), estilo pílula. */
function OpcaoBtn({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor: "sim" | "nao";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const on =
    cor === "sim"
      ? "border-vinculado-600 bg-vinculado-600 text-white shadow-sm"
      : "border-auto-600 bg-auto-600 text-white shadow-sm";
  const off =
    cor === "sim"
      ? "border-vinculado-600/40 bg-vinculado-50 text-vinculado-600 hover:bg-vinculado-100"
      : "border-auto-600/40 bg-auto-50 text-auto-600 hover:bg-auto-100";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors", ativo ? on : off)}
    >
      {ativo ? "✓ " : ""}
      {children}
    </button>
  );
}

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
  const [criando, startCriar] = React.useTransition();

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
          const ehColuna = REQUISITOS_DE_COLUNA.has(c.tipo);
          // Requisito de instância que ainda não foi criado (e não é coluna nem
          // dispensado/N-A): clicar cria a instância e abre pra editar.
          const podeCriar = !req && !ehContrato && !ehColuna && c.semaforo !== "na";
          const clicavel = Boolean(req) || ehContrato || podeCriar;
          return (
            <li key={c.tipo}>
              <button
                type="button"
                disabled={!clicavel || criando}
                onClick={() => {
                  if (req) {
                    setEditando(req);
                  } else if (ehContrato) {
                    setContratoOpen(true);
                  } else if (podeCriar) {
                    startCriar(async () => {
                      const r = await criarRequisitoInstancia(passageiro.id, expedicaoId, destino, c.tipo);
                      if (r.ok) setEditando(r.requisito);
                      else toast.error("Não foi possível abrir o requisito", { description: r.error });
                      router.refresh();
                    });
                  }
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
          arquivos={arquivos}
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
  expedicaoId, paxNome, req, usuarios, usuariosById, arquivos, onClose,
}: {
  expedicaoId: string;
  paxNome: string;
  req: PassageiroRequisitoRow;
  usuarios: Tables<"usuarios">[];
  usuariosById: Map<string, string>;
  arquivos: ArquivoRow[];
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
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const exigeAnexo = REQUISITOS_COM_ANEXO_OBRIGATORIO.has(req.tipo);
  const anexoCfg = ANEXO_CONFIG[req.tipo];
  const ehAereo = req.tipo === "Aéreo Internacional" || req.tipo === "Aéreo Doméstico";
  const ehDomestico = req.tipo === "Aéreo Doméstico";
  const ehVacina = req.tipo === "Vacina";
  const ehSeguro = req.tipo === "Seguro";
  // Pergunta "necessário/contratado?" (Não = dispensa): Aéreo Doméstico, Vacina, Seguro.
  const temNecessario = ehDomestico || ehVacina || ehSeguro;
  // Pergunta "Comprado com a gente?": só os aéreos.
  const mostraComprado = ehAereo;
  // Questionário (perguntas Sim/Não + anexo): aéreos, vacina e seguro.
  const ehQuestionario = ehAereo || ehVacina || ehSeguro;
  // "Só anexo" = sem perguntas, só o arquivo: Documento Pessoal.
  const soAnexo = req.tipo === "Documento Pessoal";
  // Perguntas Sim/Não.
  const [necessario, setNecessario] = React.useState(!(temNecessario && req.status === "Dispensado"));
  const [comprado, setComprado] = React.useState<boolean | null>(
    req.observacoes?.includes("Comprado com a gente: Sim") ? true
      : req.observacoes?.includes("Comprado com a gente: Não") ? false
        : null,
  );
  const previewUrl = arquivoId ? `/api/arquivos/${arquivoId}/download?inline=1` : null;

  async function anexarDocumento(file: File) {
    setAnexando(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expedicao_id", expedicaoId);
    fd.append("passageiro_id", req.passageiro_id);
    fd.append("categoria", anexoCfg?.categoria ?? "Documentos pessoais");
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

  // --- Anexo MÚLTIPLO (aéreos): vários arquivos na categoria do requisito ------
  const arquivosDaCategoria = arquivos.filter(
    (a) =>
      a.passageiro_id === req.passageiro_id &&
      a.categoria === (anexoCfg?.categoria ?? "Outros") &&
      // Internacional e doméstico dividem a categoria "Aéreos"; separa pela
      // descrição (gravada como "<tipo> — prontidão" no upload).
      (!ehAereo || (a.descricao ?? "").startsWith(req.tipo)),
  );

  async function anexarMultiplos(files: FileList) {
    setAnexando(true);
    let primeiroId: string | null = null;
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("expedicao_id", expedicaoId);
      fd.append("passageiro_id", req.passageiro_id);
      fd.append("categoria", anexoCfg?.categoria ?? "Aéreos");
      fd.append("descricao", `${req.tipo} — prontidão`);
      try {
        const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (json.ok && json.id) {
          if (!primeiroId) primeiroId = json.id;
        } else {
          toast.error(`Falhou: ${f.name}`, { description: json.error });
        }
      } catch {
        toast.error(`Falha de rede: ${f.name}`);
      }
    }
    // arquivo_id (= "tem comprovante") aponta pra qualquer um dos anexos.
    if (!arquivoId && primeiroId) {
      await atualizarRequisitoCampo(req.id, expedicaoId, "arquivo_id", primeiroId);
      setArquivoId(primeiroId);
    }
    setAnexando(false);
    toast.success("Anexo(s) enviado(s)");
    router.refresh();
  }

  async function apagarArquivo(arq: ArquivoRow) {
    const res = await fetch(`/api/arquivos/${arq.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: false, error: "resposta inválida" }));
    if (!res.ok || !json.ok) {
      toast.error("Erro ao apagar", { description: json.error });
      return;
    }
    // Se apaguei o que marcava o comprovante, aponta pra outro (ou nenhum).
    if (arq.id === arquivoId) {
      const novo = arquivosDaCategoria.find((a) => a.id !== arq.id)?.id ?? null;
      await atualizarRequisitoCampo(req.id, expedicaoId, "arquivo_id", novo);
      setArquivoId(novo);
    }
    toast.success("Arquivo apagado");
    router.refresh();
  }

  /** Imagem abre no lightbox (pop-up); PDF/outros abrem em nova aba. */
  function verArquivo(arq: ArquivoRow) {
    const url = `/api/arquivos/${arq.id}/download?inline=1`;
    if (arq.mime?.startsWith("image/")) {
      setPreviewErro(false);
      setLightbox(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  const arquivoDoReq = arquivos.find((a) => a.id === arquivoId) ?? null;

  async function salvar() {
    setSalvando(true);

    // Status/observações efetivos conforme o modo do requisito.
    let statusFinal: typeof status = status;
    let obsFinal: string | null = observacoes || null;
    if (ehQuestionario) {
      if (temNecessario && !necessario) {
        statusFinal = "Dispensado";
        obsFinal = ehVacina ? "Vacina não necessária" : ehSeguro ? "Seguro não contratado" : "Trecho doméstico não necessário";
      } else {
        statusFinal = arquivoId ? "Aprovado" : "Pendente";
        if (mostraComprado) {
          obsFinal = comprado == null ? obsFinal : `Comprado com a gente: ${comprado ? "Sim" : "Não"}`;
        }
      }
    }

    const mudancas: [string, unknown][] = [];
    if (statusFinal !== req.status) mudancas.push(["status", statusFinal]);
    if (!soAnexo && (validade || null) !== (req.validade?.slice(0, 10) ?? null)) mudancas.push(["validade", validade || null]);
    if (!soAnexo && (numero || null) !== (req.numero ?? null)) mudancas.push(["numero", numero || null]);
    const respValor = responsavel === "_none" ? null : responsavel;
    if (respValor !== req.responsavel_id) mudancas.push(["responsavel_id", respValor]);
    if ((obsFinal ?? null) !== (req.observacoes ?? null)) mudancas.push(["observacoes", obsFinal]);

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

  const anexoBlock = exigeAnexo ? (
    <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3">
      <Label>{anexoCfg?.label ?? "Documento anexado"}</Label>
      {arquivoId && previewUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-vinculado-600/30 bg-vinculado-50 p-2">
          <span className="flex-1 text-[13px] font-semibold text-vinculado-600">✓ Anexado</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (arquivoDoReq) verArquivo(arquivoDoReq);
              else if (previewUrl) { setPreviewErro(false); setLightbox(previewUrl); }
            }}
          >
            Ver
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={removerAnexo}>Remover</Button>
        </div>
      ) : (
        <label
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-5 text-[13px] cursor-pointer hover:bg-accent/40",
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
          <Paperclip className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{anexando ? "Anexando..." : (anexoCfg?.label ?? "Anexar arquivo")}</span>
          <span className="text-[11px] text-muted-foreground">imagem ou PDF</span>
        </label>
      )}
      <p className="text-[11px] text-muted-foreground">{anexoCfg?.dica ?? "Obrigatório para a prontidão."}</p>
    </div>
  ) : null;

  const anexoMultiplo = (
    <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3">
      <Label>{anexoCfg?.label ?? "Anexos"}</Label>
      {arquivosDaCategoria.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
          {arquivosDaCategoria.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.nome}</span>
              <button
                type="button"
                onClick={() => verArquivo(a)}
                className="font-medium text-editavel-700 hover:underline"
              >
                Ver
              </button>
              <button
                type="button"
                aria-label="Apagar"
                onClick={() => apagarArquivo(a)}
                className="text-muted-foreground hover:text-critico-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-4 text-[13px] cursor-pointer hover:bg-accent/40",
          anexando && "opacity-60 pointer-events-none",
        )}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          disabled={anexando}
          onChange={(e) => {
            if (e.target.files?.length) anexarMultiplos(e.target.files);
            e.target.value = "";
          }}
        />
        <Paperclip className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">
          {anexando ? "Anexando..." : arquivosDaCategoria.length ? "Anexar mais" : (anexoCfg?.label ?? "Anexar arquivo")}
        </span>
        <span className="text-[11px] text-muted-foreground">pode selecionar vários · imagem ou PDF</span>
      </label>
      <p className="text-[11px] text-muted-foreground">{anexoCfg?.dica ?? "Anexar o voucher já deixa aprovado."}</p>
    </div>
  );

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
          {/* QUESTIONÁRIO (aéreos + vacina): perguntas Sim/Não + anexo obrigatório */}
          {ehQuestionario ? (
            <>
              {temNecessario && (
                <div className="space-y-1.5 rounded-xl border border-editavel-600/30 bg-editavel-50/50 p-3">
                  <Label className="text-editavel-600">{ehVacina ? "É necessária a vacina?" : ehSeguro ? "Seguro contratado?" : "É necessário aéreo doméstico?"}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <OpcaoBtn ativo={necessario} cor="sim" onClick={() => setNecessario(true)}>Sim</OpcaoBtn>
                    <OpcaoBtn ativo={!necessario} cor="nao" onClick={() => setNecessario(false)}>Não — dispensar</OpcaoBtn>
                  </div>
                </div>
              )}
              {(!temNecessario || necessario) && (
                <>
                  {mostraComprado && (
                    <div className="space-y-1.5 rounded-xl border border-editavel-600/30 bg-editavel-50/50 p-3">
                      <Label className="text-editavel-600">Aéreo comprado com a gente?</Label>
                      <div className="flex flex-wrap gap-1.5">
                        <OpcaoBtn ativo={comprado === true} cor="sim" onClick={() => setComprado(true)}>Sim</OpcaoBtn>
                        <OpcaoBtn ativo={comprado === false} cor="nao" onClick={() => setComprado(false)}>Não</OpcaoBtn>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Em qualquer caso, o voucher é obrigatório.</p>
                    </div>
                  )}
                  {ehAereo ? anexoMultiplo : anexoBlock}
                  {ehAereo && (
                    <div className="space-y-1">
                      <Label htmlFor="req-loc">Localizador (opcional)</Label>
                      <Input id="req-loc" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex.: ABC123" />
                    </div>
                  )}
                </>
              )}
            </>
          ) : soAnexo ? (
            anexoBlock
          ) : (
            <>
              <div className="space-y-1.5 rounded-xl border border-editavel-600/30 bg-editavel-50/50 p-3">
                <Label className="text-editavel-600">Status — toque numa opção 👇</Label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_REQUISITO.map((s) => {
                    const sel = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                          sel ? STATUS_COR[s].on : STATUS_COR[s].off,
                        )}
                      >
                        {sel ? "✓ " : ""}{s}
                      </button>
                    );
                  })}
                </div>
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
                <Label htmlFor="req-obs">Observações</Label>
                <textarea
                  id="req-obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
                />
              </div>
            </>
          )}

          {/* Responsável (todos os modos) */}
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

    {lightbox && typeof document !== "undefined" &&
      createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {previewErro ? (
            <a
              href={lightbox}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-background px-4 py-3 text-[13px] text-editavel-700 hover:underline"
            >
              Abrir arquivo em nova aba
            </a>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={lightbox}
              alt="Anexo"
              onError={() => setPreviewErro(true)}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-xl"
            />
          )}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-background/90 px-3 py-1 text-[13px] font-medium hover:bg-background"
          >
            Fechar
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
