"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building, Download, Pencil, User, Plus, GripVertical, AlertTriangle, CheckCircle2, Wand2, Users, Link2, BedDouble, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import {
  excluirQuarto,
  excluirTrechoRooming,
  alocarPassageiro,
  desalocarPassageiro,
  desfazerConexao,
  alocarConexaoNoQuarto,
  conectarPassageiros,
} from "@/app/(app)/expedicoes/actions";
import { CAPACIDADE_QUARTO } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import type { PassageiroRow, QuartoRow, AlocacaoQuartoRow } from "@/types/database";
import { toast } from "sonner";
import { NovoQuartoDrawer } from "./NovoQuartoDrawer";
import { QuartosAutomaticosDrawer } from "./QuartosAutomaticosDrawer";
import { EditarQuartoDrawer } from "./EditarQuartoDrawer";
import { DuplicarHotelDrawer } from "./DuplicarHotelDrawer";
import { ConexaoViagemDrawer } from "./ConexaoViagemDrawer";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { grupoEgito, type GrupoEgito } from "@/lib/dev-grupos-egito"; // ⚠️ local/temporário (preview G1/G2 Egito)

interface Props {
  expedicaoId: string;
  passageiros: PassageiroRow[];
  quartos: QuartoRow[];
  alocacoes: AlocacaoQuartoRow[];
}

const CAPACIDADE = CAPACIDADE_QUARTO;

/** Cores estáveis por conexão (dot ao lado do pax / na lista de conexões). */
const CORES_CONEXAO = ["#2563eb", "#16a34a", "#db2777", "#d97706", "#7c3aed", "#0891b2", "#ca8a04", "#e11d48"];

/**
 * Chave do hotel/trecho: mesmo hotel/cidade + mesmas datas de check-in/out.
 * Normaliza o nome do hotel (trim + colapsa espaços) e as datas (só AAAA-MM-DD)
 * pra diferenças bobas (espaço no fim, "Hungharda " vs "Hungharda") NÃO separarem
 * o mesmo hotel em dois trechos — o que fazia um quarto editado "pular" de seção.
 */
function trechoKey(q: { hotel_cidade: string | null; check_in: string | null; check_out: string | null }): string {
  const hotel = (q.hotel_cidade ?? "").trim().replace(/\s+/g, " ");
  return `${hotel}|${(q.check_in ?? "").slice(0, 10)}|${(q.check_out ?? "").slice(0, 10)}`;
}

/** Normaliza nome pra casar acompanhante (minúsculas, sem acento, espaços colapsados). */
function normalizarNome(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

type Trecho = {
  key: string;
  hotel_cidade: string | null;
  check_in: string | null;
  check_out: string | null;
  quartos: QuartoRow[];
};

export function RoomingBoard({ expedicaoId, passageiros, quartos, alocacoes }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [autoOpen, setAutoOpen] = React.useState(false);
  // Quando setado, o drawer de auto-criação abre com hotel/datas pré-preenchidos
  // (botão "Adicionar quarto" numa seção/hotel existente). null = criar do zero.
  const [autoPrefill, setAutoPrefill] = React.useState<{ hotel_cidade: string; check_in: string; check_out: string } | null>(null);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  // Duplicar um hotel inteiro (quartos + pax) para um novo hotel/datas.
  const [duplicarOrigem, setDuplicarOrigem] = React.useState<{ quartoIds: string[]; hotelOrigem: string | null } | null>(null);
  // null = fechado; { membros } = aberto (vazio cria, preenchido edita).
  const [conexaoDrawer, setConexaoDrawer] = React.useState<{ membros: string[] } | null>(null);
  // Trechos (hotéis) recolhidos — guarda as chaves recolhidas (expandido por padrão).
  const [trechosRecolhidos, setTrechosRecolhidos] = React.useState<Set<string>>(new Set());
  const toggleTrecho = (key: string) =>
    setTrechosRecolhidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  // ⚠️ local/temporário: grupo (G1/G2) de cada pax, pra separar o rooming em seções.
  const grupoDoPax = React.useCallback((p: PassageiroRow) => grupoEgito(p.nome_completo), []);
  const quartoEditando = editandoId ? quartos.find((q) => q.id === editandoId) ?? null : null;

  // Cópia local das alocações pra atualização otimista do drag.
  const [localAloc, setLocalAloc] = React.useState(alocacoes);
  React.useEffect(() => setLocalAloc(alocacoes), [alocacoes]);

  const realtimeStatus = useRealtimeRefresh({
    subscriptions: [
      { table: "quartos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiros", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiro_quarto" },
    ],
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const dndId = React.useId();

  const paxAtivos = React.useMemo(
    () => passageiros.filter((p) => p.status_reserva !== "Cancelado"),
    [passageiros],
  );
  const paxById = React.useMemo(() => new Map(passageiros.map((p) => [p.id, p])), [passageiros]);

  // ⚠️ local/temporário: há passageiros mapeados a G1/G2? (liga as seções por grupo)
  const temGrupos = React.useMemo(() => paxAtivos.some((p) => grupoDoPax(p)), [paxAtivos, grupoDoPax]);

  // Conexões "viajam juntas": grupos de pax (≥2) com o mesmo conexao_viagem_id.
  const conexoes = React.useMemo(() => {
    const m = new Map<string, PassageiroRow[]>();
    for (const p of paxAtivos) {
      if (!p.conexao_viagem_id) continue;
      const arr = m.get(p.conexao_viagem_id) ?? [];
      arr.push(p);
      m.set(p.conexao_viagem_id, arr);
    }
    return [...m.entries()]
      .filter(([, membros]) => membros.length >= 2)
      .map(([id, membros], i) => ({ id, membros, cor: CORES_CONEXAO[i % CORES_CONEXAO.length] }));
  }, [paxAtivos]);

  // paxId -> { cor, nomesCompanheiros } pra marcar o card no board.
  const conexaoByPax = React.useMemo(() => {
    const m = new Map<string, { cor: string; companheiros: string }>();
    for (const c of conexoes) {
      for (const membro of c.membros) {
        const outros = c.membros.filter((x) => x.id !== membro.id).map((x) => x.nome_completo);
        m.set(membro.id, { cor: c.cor, companheiros: outros.join(", ") });
      }
    }
    return m;
  }, [conexoes]);

  // Acompanhantes indicados na inscrição: tenta casar o nome com um pax da expedição.
  const acompanhantes = React.useMemo(() => {
    return paxAtivos
      .filter((p) => (p.acompanhante_nome ?? "").trim())
      .map((p) => {
        const alvo = normalizarNome(p.acompanhante_nome!);
        const candidatos = paxAtivos.filter((o) => {
          if (o.id === p.id) return false;
          const n = normalizarNome(o.nome_completo);
          return n === alvo || n.includes(alvo) || alvo.includes(n);
        });
        const candidato = candidatos.length === 1 ? candidatos[0] : null;
        const jaConectados =
          !!candidato && !!p.conexao_viagem_id && p.conexao_viagem_id === candidato.conexao_viagem_id;
        return { pax: p, candidato, varios: candidatos.length > 1, jaConectados };
      });
  }, [paxAtivos]);

  async function vincularAcompanhante(paxId: string, candidatoId: string) {
    const r = await conectarPassageiros(expedicaoId, [paxId, candidatoId]);
    if (r.ok) {
      toast.success("Vinculados como 'viajam juntas'");
      router.refresh();
    } else {
      toast.error("Não foi possível vincular", { description: r.error });
    }
  }

  // paxId -> ids de TODOS os membros da conexão (inclui ele). Vazio se sem conexão.
  // Usado para mover/remover a conexão como um bloco (não pode ficar separada).
  const membrosConexaoByPax = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of conexoes) {
      const ids = c.membros.map((x) => x.id);
      for (const id of ids) m.set(id, ids);
    }
    return m;
  }, [conexoes]);

  // Trechos (hotéis) ordenados por check-in.
  const trechos: Trecho[] = React.useMemo(() => {
    const map = new Map<string, Trecho>();
    for (const q of quartos) {
      const k = trechoKey(q);
      if (!map.has(k)) {
        map.set(k, { key: k, hotel_cidade: q.hotel_cidade, check_in: q.check_in, check_out: q.check_out, quartos: [] });
      }
      map.get(k)!.quartos.push(q);
    }
    return Array.from(map.values()).sort((a, b) => (a.check_in ?? "").localeCompare(b.check_in ?? ""));
  }, [quartos]);

  // quarto_id -> paxIds alocados
  const ocupantesPorQuarto = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const q of quartos) m.set(q.id, []);
    for (const a of localAloc) {
      const arr = m.get(a.quarto_id);
      if (arr && paxById.has(a.passageiro_id)) arr.push(a.passageiro_id);
    }
    return m;
  }, [quartos, localAloc, paxById]);

  /** Quarto em que o pax está dentro de um trecho (ou null). */
  function quartoDoPaxNoTrecho(paxId: string, trecho: Trecho): string | null {
    const ids = new Set(trecho.quartos.map((q) => q.id));
    return localAloc.find((a) => a.passageiro_id === paxId && ids.has(a.quarto_id))?.quarto_id ?? null;
  }

  /** Pax sem quarto num trecho (não-cancelados, sem alocação naquele hotel). */
  function semQuartoNoTrecho(trecho: Trecho): PassageiroRow[] {
    return paxAtivos.filter((p) => !quartoDoPaxNoTrecho(p.id, trecho));
  }

  /** ⚠️ local/temporário: grupo "dominante" de um hotel/trecho, pelos hóspedes alocados.
   *  Retorna "G1"/"G2" se todos são do mesmo grupo, "misto" se há dos dois, null se nenhum mapeado. */
  function grupoDoTrecho(trecho: Trecho): GrupoEgito | "misto" | null {
    const ids = new Set(trecho.quartos.map((q) => q.id));
    const grupos = new Set<GrupoEgito>();
    for (const a of localAloc) {
      if (!ids.has(a.quarto_id)) continue;
      const p = paxById.get(a.passageiro_id);
      const g = p ? grupoDoPax(p) : null;
      if (g) grupos.add(g);
    }
    if (grupos.size === 0) return null;
    if (grupos.size > 1) return "misto";
    return [...grupos][0];
  }

  /** ⚠️ local/temporário: grupo de um quarto pelos hóspedes alocados. G1 tem
   *  precedência (quarto com qualquer pax do G1 conta como G1); senão G2; senão null. */
  function grupoDoQuarto(q: QuartoRow): GrupoEgito | null {
    const ocup = ocupantesPorQuarto.get(q.id) ?? [];
    let temG2 = false;
    for (const id of ocup) {
      const p = paxById.get(id);
      const g = p ? grupoDoPax(p) : null;
      if (g === "G1") return "G1";
      if (g === "G2") temG2 = true;
    }
    return temG2 ? "G2" : null;
  }
  /** Ordem de exibição: G1 (0) → G2 (1) → sem grupo (2). */
  const prioridadeQuarto = (q: QuartoRow) => {
    const g = grupoDoQuarto(q);
    return g === "G1" ? 0 : g === "G2" ? 1 : 2;
  };

  /** Onde os membros de uma conexão estão dentro de um trecho. */
  function conexaoNoTrecho(membros: PassageiroRow[], trecho: Trecho) {
    const porQuarto = new Map<string, number>();
    let semQuarto = 0;
    for (const m of membros) {
      const q = quartoDoPaxNoTrecho(m.id, trecho);
      if (q) porQuarto.set(q, (porQuarto.get(q) ?? 0) + 1);
      else semQuarto++;
    }
    let quartoAncora: string | null = null;
    let max = 0;
    for (const [q, n] of porQuarto) if (n > max) { max = n; quartoAncora = q; }
    const juntos = semQuarto === 0 && porQuarto.size === 1;
    return { porQuarto, semQuarto, quartoAncora, juntos };
  }

  async function juntarConexao(membros: PassageiroRow[], quartoId: string) {
    const r = await alocarConexaoNoQuarto(membros.map((m) => m.id), quartoId, expedicaoId);
    if (!r.ok) {
      toast.error("Não foi possível juntar", { description: r.error });
      return;
    }
    toast.success("Conexão alocada no mesmo quarto");
    router.refresh();
  }

  async function alocar(paxId: string, quartoId: string) {
    const quarto = quartos.find((q) => q.id === quartoId);
    if (!quarto) return;
    // Quem viaja junto vai junto: aloca a conexão inteira (ou só o pax, se sozinho).
    const membros = membrosConexaoByPax.get(paxId) ?? [paxId];
    const cap = CAPACIDADE[quarto.tipo] ?? 1;
    const ocupFixos = (ocupantesPorQuarto.get(quartoId) ?? []).filter((id) => !membros.includes(id)).length;
    if (ocupFixos + membros.length > cap) {
      toast.error(membros.length > 1 ? "A conexão não cabe junta" : "Quarto cheio", {
        description:
          membros.length > 1
            ? `São ${membros.length} pessoas que viajam juntas e o quarto (${quarto.tipo}) comporta ${cap}. Use um quarto maior ou desfaça a conexão.`
            : `${quarto.tipo} comporta no máximo ${cap} ${cap === 1 ? "pessoa" : "pessoas"}.`,
      });
      return;
    }
    const trecho = trechos.find((t) => t.quartos.some((q) => q.id === quartoId));
    const idsTrecho = new Set(trecho ? trecho.quartos.map((q) => q.id) : [quartoId]);
    const anterior = localAloc;
    setLocalAloc((prev) => [
      ...prev.filter((a) => !(membros.includes(a.passageiro_id) && idsTrecho.has(a.quarto_id))),
      ...membros.map((pid) => ({ id: `tmp-${pid}-${quartoId}`, passageiro_id: pid, quarto_id: quartoId, created_at: "" })),
    ]);
    const r =
      membros.length > 1
        ? await alocarConexaoNoQuarto(membros, quartoId, expedicaoId)
        : await alocarPassageiro(paxId, quartoId, expedicaoId);
    if (!r.ok) {
      setLocalAloc(anterior);
      toast.error("Erro ao alocar", { description: r.error });
      return;
    }
    router.refresh();
  }

  async function desalocar(paxId: string, quartoId: string) {
    const anterior = localAloc;
    setLocalAloc((prev) => prev.filter((a) => !(a.passageiro_id === paxId && a.quarto_id === quartoId)));
    const r = await desalocarPassageiro(paxId, quartoId, expedicaoId);
    if (!r.ok) {
      setLocalAloc(anterior);
      toast.error("Erro ao remover do quarto", { description: r.error });
      return;
    }
    router.refresh();
  }

  /** Tira a conexão inteira do quarto num trecho (juntos saem juntos). */
  async function desalocarConexao(membros: string[], trecho: Trecho) {
    const idsTrecho = new Set(trecho.quartos.map((q) => q.id));
    const anterior = localAloc;
    const aRemover = membros
      .map((m) => ({ m, q: anterior.find((a) => a.passageiro_id === m && idsTrecho.has(a.quarto_id))?.quarto_id }))
      .filter((x): x is { m: string; q: string } => Boolean(x.q));
    if (!aRemover.length) return;
    setLocalAloc((prev) => prev.filter((a) => !(membros.includes(a.passageiro_id) && idsTrecho.has(a.quarto_id))));
    for (const { m, q } of aRemover) {
      const r = await desalocarPassageiro(m, q, expedicaoId);
      if (!r.ok) {
        setLocalAloc(anterior);
        toast.error("Erro ao remover do quarto", { description: r.error });
        return;
      }
    }
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const paxId = String(active.id).split("::")[1];
    const overId = String(over.id);
    if (overId.startsWith("sem::")) {
      const trecho = trechos.find((t) => t.key === overId.slice(5));
      if (!trecho) return;
      const membros = membrosConexaoByPax.get(paxId);
      if (membros && membros.length > 1) {
        desalocarConexao(membros, trecho);
      } else {
        const atual = quartoDoPaxNoTrecho(paxId, trecho);
        if (atual) desalocar(paxId, atual);
      }
    } else {
      alocar(paxId, overId);
    }
  }

  // Obrigatoriedade: todo pax deve ter quarto em TODOS os hotéis.
  const pendencias = React.useMemo(
    () => trechos.map((t) => ({ trecho: t, faltam: semQuartoNoTrecho(t).length })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trechos, localAloc, paxAtivos],
  );
  const totalFaltam = pendencias.reduce((s, p) => s + p.faltam, 0);

  // Conexões que ficaram em quartos DIFERENTES dentro de um hotel (proibido).
  const conexoesSeparadas = React.useMemo(() => {
    const out: { trecho: Trecho; conexao: (typeof conexoes)[number]; quartoAncora: string | null }[] = [];
    for (const t of trechos) {
      for (const c of conexoes) {
        const st = conexaoNoTrecho(c.membros, t);
        if (st.porQuarto.size > 1) out.push({ trecho: t, conexao: c, quartoAncora: st.quartoAncora });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trechos, conexoes, localAloc]);

  const completo =
    trechos.length > 0 && totalFaltam === 0 && paxAtivos.length > 0 && conexoesSeparadas.length === 0;

  async function exportarExcel() {
    if (!completo) {
      toast.error("Rooming incompleto", {
        description: conexoesSeparadas.length
          ? "Há pessoas que viajam juntas em quartos diferentes. Junte-as antes de exportar."
          : "Aloque todos os passageiros em todos os hotéis antes de exportar.",
      });
      return;
    }
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sistema de Expedições";

    const AZUL = "FF2563EB";
    const borda = { style: "thin" as const, color: { argb: "FFE2E8F0" } };
    const todasBordas = { top: borda, left: borda, bottom: borda, right: borda };
    // Separador entre quartos: linha dupla (mais grossa) na base do último ocupante.
    const separador = { style: "double" as const, color: { argb: "FF334155" } };

    // Nome de aba: <=31 chars, sem caracteres proibidos, sem duplicar.
    const usados = new Set<string>();
    const nomeAba = (base: string) => {
      const limpo = (base || "Hotel").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Hotel";
      let cand = limpo;
      let i = 2;
      while (usados.has(cand.toLowerCase())) cand = `${limpo} ${i++}`.slice(0, 31);
      usados.add(cand.toLowerCase());
      return cand;
    };

    for (const t of trechos) {
      const ws = wb.addWorksheet(nomeAba(t.hotel_cidade ?? "Hotel"));
      ws.columns = [{ width: 16 }, { width: 16 }, { width: 34 }, { width: 12 }];

      ws.mergeCells("A1:D1");
      const titulo = ws.getCell("A1");
      titulo.value = `Rooming — ${t.hotel_cidade ?? "Hotel"}`;
      titulo.font = { bold: true, size: 14 };

      ws.mergeCells("A2:D2");
      const sub = ws.getCell("A2");
      sub.value = `Check-in: ${t.check_in ? formatDate(t.check_in) : "—"}    •    Check-out: ${t.check_out ? formatDate(t.check_out) : "—"}`;
      sub.font = { italic: true, color: { argb: "FF64748B" } };

      const head = ws.getRow(4);
      head.values = ["Quarto", "Tipo do quarto", "Passageiro", "Tipo"];
      head.height = 18;
      for (let col = 1; col <= 4; col++) {
        const c = head.getCell(col);
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
        c.alignment = { vertical: "middle" };
        c.border = todasBordas;
      }

      let r = 5;
      for (const q of t.quartos) {
        const ocup = (ocupantesPorQuarto.get(q.id) ?? []).map((id) => paxById.get(id)).filter(Boolean) as PassageiroRow[];
        const linhas: (PassageiroRow | null)[] = ocup.length ? ocup : [null];
        linhas.forEach((p, i) => {
          const ultima = i === linhas.length - 1;
          const row = ws.getRow(r);
          row.getCell(1).value = i === 0 ? `Quarto ${q.numero}` : "";
          row.getCell(2).value = i === 0 ? q.tipo : "";
          row.getCell(3).value = p ? p.nome_completo : "(vazio)";
          row.getCell(4).value = p ? p.tipo : "";
          for (let col = 1; col <= 4; col++) {
            const c = row.getCell(col);
            c.border = { top: borda, left: borda, bottom: ultima ? separador : borda, right: borda };
            if (col <= 2 && i === 0) c.font = { bold: true };
            if (!p) c.font = { italic: true, color: { argb: "FF94A3B8" } };
          }
          r++;
        });
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rooming.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rooming exportado (.xlsx)");
  }

  // ⚠️ local/temporário: ordena os hotéis por grupo (G1 em cima, G2 embaixo) e injeta
  // um cabeçalho "Grupo 1"/"Grupo 2" antes do primeiro hotel de cada grupo. Sem grupos
  // mapeados, cai no fluxo normal (uma lista só, por check-in).
  const prioridadeGrupo = (g: GrupoEgito | "misto" | null) =>
    g === "G1" ? 0 : g === "G2" ? 1 : g === "misto" ? 2 : 3;
  type ItemRender =
    | { tipo: "cabecalho"; key: string; grupo: GrupoEgito | "misto" }
    | { tipo: "trecho"; t: Trecho };
  const itensComGrupo: ItemRender[] = (() => {
    if (!temGrupos) return trechos.map((t) => ({ tipo: "trecho", t }) as ItemRender);
    const comGrupo = trechos.map((t) => ({ t, g: grupoDoTrecho(t) }));
    comGrupo.sort((a, b) => {
      const d = prioridadeGrupo(a.g) - prioridadeGrupo(b.g);
      return d !== 0 ? d : (a.t.check_in ?? "").localeCompare(b.t.check_in ?? "");
    });
    const itens: ItemRender[] = [];
    let ultimaPrioridade: number | null = null;
    for (const { t, g } of comGrupo) {
      const pr = prioridadeGrupo(g);
      if (pr !== ultimaPrioridade) {
        if (g) itens.push({ tipo: "cabecalho", key: `head-${pr}`, grupo: g });
        ultimaPrioridade = pr;
      }
      itens.push({ tipo: "trecho", t });
    }
    return itens;
  })();

  return (
    <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Rooming list</h2>
              <LiveBadge status={realtimeStatus} />
            </div>
            <p className="text-xs text-muted-foreground">
              {trechos.length} hotel(éis) · {quartos.length} quartos · {paxAtivos.length} passageiros · arraste para alocar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportarExcel}
              disabled={!completo}
              title={completo ? "Exportar rooming" : "Aloque todos em todos os hotéis para liberar a exportação"}
            >
              <Download className="h-3 w-3" /> Exportar Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAutoPrefill(null); setAutoOpen(true); }}>
              <Wand2 className="h-3 w-3" /> Criar quartos automáticos
            </Button>
            <Button variant="brand" size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="h-3 w-3" /> Novo quarto
            </Button>
          </div>
        </div>

        {/* Faixa de status da obrigatoriedade */}
        {trechos.length > 0 && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border p-2.5 text-[12px]",
              completo
                ? "border-vinculado-600/40 bg-vinculado-100/40 text-vinculado-700"
                : conexoesSeparadas.length
                  ? "border-critico-600/40 bg-critico-100/40 text-critico-700"
                  : "border-atencao-600/40 bg-atencao-100/40 text-atencao-700",
            )}
          >
            {completo ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
            {completo ? (
              <span>Todos os passageiros estão alocados em todos os hotéis. Exportação liberada. ✅</span>
            ) : (
              <div className="space-y-1.5">
                {conexoesSeparadas.length > 0 && (
                  <div>
                    <strong>Quem viaja junto não pode ficar em quartos separados.</strong> Junte antes de exportar:
                    <ul className="mt-1 list-disc list-inside">
                      {conexoesSeparadas.map(({ trecho, conexao }) => (
                        <li key={`${trecho.key}-${conexao.id}`}>
                          {trecho.hotel_cidade ?? "—"}: {conexao.membros.map((m) => m.nome_completo.split(" ")[0]).join(" + ")} em quartos diferentes
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {totalFaltam > 0 && (
                  <div>
                    <strong>Faltam alocar {totalFaltam} no total.</strong> A exportação fica bloqueada até todos terem quarto em cada hotel:
                    <ul className="mt-1 list-disc list-inside">
                      {pendencias.filter((p) => p.faltam > 0).map((p) => (
                        <li key={p.trecho.key}>{p.trecho.hotel_cidade ?? "—"}: {p.faltam} sem quarto</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conexões "viajam juntas" (mesmo quarto) */}
        <section className="rounded-md border border-border">
          <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-[13px]">Viajam juntas</span>
              <span className="text-[11px] text-muted-foreground">ficam no mesmo quarto</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConexaoDrawer({ membros: [] })}>
              <Link2 className="h-3 w-3" /> Nova conexão
            </Button>
          </header>
          <div className="p-3">
            {conexoes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Marque pessoas que viajam juntas (casal, família). Elas são tratadas como bloco: ao
                alocar uma, todas vão para o mesmo quarto — e o sistema <strong>impede</strong> deixá-las
                em quartos separados.
              </p>
            ) : (
              <div className="space-y-1.5">
                {conexoes.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.cor }} />
                    <span className="text-[12px] truncate flex-1">{c.membros.map((m) => m.nome_completo).join(" · ")}</span>
                    <Badge variant="auto">{c.membros.length}</Badge>
                    <button
                      type="button"
                      onClick={() => setConexaoDrawer({ membros: c.membros.map((m) => m.id) })}
                      className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
                    >
                      Editar
                    </button>
                    <ConfirmDeleteButton
                      ariaLabel="Desfazer conexão"
                      triggerLabel="Desfazer"
                      title="Desfazer esta conexão?"
                      description="As pessoas deixam de ser tratadas como grupo de quarto. As alocações atuais de quarto não mudam."
                      successMessage="Conexão desfeita"
                      onConfirm={() => desfazerConexao(expedicaoId, c.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Acompanhantes indicados na inscrição (sugestão de conexão) */}
        {acompanhantes.length > 0 && (
          <section className="rounded-md border border-border">
            <header className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
              <BedDouble className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-[13px] font-semibold">Acompanhantes indicados</span>
              <span className="text-[11px] text-muted-foreground">informado na inscrição</span>
            </header>
            <div className="space-y-1.5 p-3">
              {acompanhantes.map(({ pax, candidato, varios, jaConectados }) => (
                <div key={pax.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
                  <span className="text-[12px]">
                    <strong>{pax.nome_completo.split(" ")[0]}</strong> quer viajar com <strong>{pax.acompanhante_nome}</strong>
                  </span>
                  {pax.acompanhante_divide_quarto && <Badge variant="lista">{pax.acompanhante_divide_quarto}</Badge>}
                  <span className="flex-1" />
                  {jaConectados ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-vinculado-600"><CheckCircle2 className="h-3 w-3" /> vinculados</span>
                  ) : candidato ? (
                    <>
                      <span className="text-[11px] text-muted-foreground">→ {candidato.nome_completo}</span>
                      <Button variant="outline" size="sm" onClick={() => vincularAcompanhante(pax.id, candidato.id)}>
                        <Link2 className="h-3 w-3" /> Vincular
                      </Button>
                    </>
                  ) : varios ? (
                    <span className="text-[11px] text-atencao-600">vários possíveis — use &quot;Nova conexão&quot;</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">ainda não está na expedição</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {trechos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20">
            <EmptyState
              icon={BedDouble}
              title="Monte o rooming por hotel"
              description="Crie os quartos (com hotel e datas de check-in/out) e depois arraste os passageiros para distribuí-los. O jeito rápido é gerar vários de uma vez."
              actionLabel="Criar quartos automáticos"
              onAction={() => { setAutoPrefill(null); setAutoOpen(true); }}
            />
          </div>
        ) : (
          itensComGrupo.map((item) => {
            if (item.tipo === "cabecalho") {
              return (
                <div key={item.key} className="flex items-center gap-2 pt-2 first:pt-0">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-bold",
                      item.grupo === "G1"
                        ? "bg-editavel-100 text-editavel-700"
                        : item.grupo === "G2"
                          ? "bg-lista-100 text-lista-600"
                          : "bg-atencao-100 text-atencao-700",
                    )}
                  >
                    {item.grupo === "G1" ? "Grupo 1" : item.grupo === "G2" ? "Grupo 2" : "Ambos os grupos"}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              );
            }
            const t = item.t;
            const grupoTrecho = grupoDoTrecho(t);
            const sem = semQuartoNoTrecho(t);
            const recolhido = trechosRecolhidos.has(t.key);
            return (
              <section key={t.key} className="rounded-md border border-border">
                <header className={`flex items-center justify-between gap-2 bg-muted/30 px-3 py-2 flex-wrap${recolhido ? "" : " border-b border-border"}`}>
                  <button
                    type="button"
                    onClick={() => toggleTrecho(t.key)}
                    title={recolhido ? "Expandir hotel" : "Recolher hotel"}
                    aria-expanded={!recolhido}
                    className="flex items-center gap-2 min-w-0 text-left rounded-md hover:bg-muted/50 -mx-1 px-1 py-0.5 transition-colors"
                  >
                    {recolhido ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-[13px] truncate">{t.hotel_cidade ?? "Hotel"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.check_in ? formatDate(t.check_in) : "?"} → {t.check_out ? formatDate(t.check_out) : "?"}
                    </span>
                    {recolhido && (
                      <span className="text-[11px] text-muted-foreground">· {t.quartos.length} quarto(s)</span>
                    )}
                    {grupoTrecho && (
                      <span
                        title={grupoTrecho === "misto" ? "Hotel com pax dos dois grupos" : `Hotel do ${grupoTrecho === "G1" ? "Grupo 1" : "Grupo 2"}`}
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          grupoTrecho === "G1"
                            ? "bg-editavel-100 text-editavel-700"
                            : grupoTrecho === "G2"
                              ? "bg-lista-100 text-lista-600"
                              : "bg-atencao-100 text-atencao-700",
                        )}
                      >
                        {grupoTrecho === "misto" ? "G1+G2" : grupoTrecho}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant={sem.length === 0 ? "vinculado" : "atencao"}>
                      {paxAtivos.length - sem.length}/{paxAtivos.length} alocados
                    </Badge>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoPrefill({
                          hotel_cidade: t.hotel_cidade ?? "",
                          check_in: t.check_in ?? "",
                          check_out: t.check_out ?? "",
                        });
                        setAutoOpen(true);
                      }}
                      title="Adicionar quartos a este hotel (mesmas datas)"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" /> Adicionar quarto
                    </button>
                    {t.quartos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDuplicarOrigem({ quartoIds: t.quartos.map((q) => q.id), hotelOrigem: t.hotel_cidade })}
                        title="Duplicar todos os quartos deste hotel (com os mesmos pax) para outro hotel"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                      >
                        <Copy className="h-3 w-3" /> Duplicar hotel
                      </button>
                    )}
                    {t.quartos.length > 0 && (
                      <ConfirmDeleteButton
                        ariaLabel="Excluir reserva do hotel"
                        triggerLabel="Excluir hotel"
                        triggerClassName="border border-border bg-background text-[11px] font-medium"
                        title={`Excluir a reserva de "${t.hotel_cidade ?? "Hotel"}"?`}
                        description={`Serão excluídos os ${t.quartos.length} quarto(s) deste hotel e todas as alocações de passageiros neles. Esta ação não pode ser desfeita.`}
                        successMessage="Reserva do hotel excluída"
                        onConfirm={() => excluirTrechoRooming(expedicaoId, t.quartos.map((q) => q.id))}
                      />
                    )}
                  </div>
                </header>

                {!recolhido && (
                <>
                {/* Status das conexões neste hotel */}
                {conexoes.length > 0 && (
                  <div className="border-b border-border bg-background px-3 py-2 space-y-1">
                    {conexoes.map((c) => {
                      const st = conexaoNoTrecho(c.membros, t);
                      const ancoraNum = st.quartoAncora ? quartos.find((q) => q.id === st.quartoAncora)?.numero : null;
                      const nenhumAlocado = st.porQuarto.size === 0;
                      return (
                        <div key={c.id} className="flex items-center gap-2 text-[11px]">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.cor }} />
                          <span className="truncate text-muted-foreground">
                            {c.membros.map((m) => m.nome_completo.split(" ")[0]).join(" + ")}
                          </span>
                          {st.juntos ? (
                            <Badge variant="vinculado">juntos{ancoraNum ? ` · Quarto ${ancoraNum}` : ""}</Badge>
                          ) : nenhumAlocado ? (
                            <span className="text-muted-foreground">a alocar</span>
                          ) : (
                            <>
                              <Badge variant="critico">separados</Badge>
                              {st.quartoAncora && (
                                <button
                                  type="button"
                                  onClick={() => juntarConexao(c.membros, st.quartoAncora!)}
                                  className="text-editavel-700 hover:underline font-medium"
                                >
                                  Juntar no Quarto {ancoraNum}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
                  {/* Sem quarto neste hotel */}
                  <Dropzone id={`sem::${t.key}`} className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sem quarto</h3>
                      <Badge variant={sem.length === 0 ? "vinculado" : "atencao"}>{sem.length}</Badge>
                    </div>
                    <div className="space-y-1.5 min-h-[40px]">
                      {sem.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-2">Todos alocados neste hotel 👌</p>
                      ) : (
                        sem.map((p) => <PaxCard key={p.id} p={p} trechoKey={t.key} conexao={conexaoByPax.get(p.id)} />)
                      )}
                    </div>
                  </Dropzone>

                  {/* Quartos do hotel — G1 em cima, depois G2, depois sem grupo */}
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[...t.quartos].sort((a, b) => prioridadeQuarto(a) - prioridadeQuarto(b)).map((q) => {
                      const ocupIds = ocupantesPorQuarto.get(q.id) ?? [];
                      const cap = CAPACIDADE[q.tipo] ?? 1;
                      const cheio = ocupIds.length >= cap;
                      const grupoQuarto = grupoDoQuarto(q);
                      return (
                        <Dropzone key={q.id} id={q.id} className="rounded-md border border-border bg-background p-3">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-[13px] truncate">Quarto {q.numero}</span>
                              <Badge variant="lista">{q.tipo}</Badge>
                              {grupoQuarto && (
                                <span
                                  title={grupoQuarto === "G1" ? "Quarto do Grupo 1" : "Quarto do Grupo 2"}
                                  className={cn(
                                    "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                    grupoQuarto === "G1" ? "bg-editavel-100 text-editavel-700" : "bg-lista-100 text-lista-600",
                                  )}
                                >
                                  {grupoQuarto}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Badge variant={cheio ? "vinculado" : ocupIds.length > 0 ? "atencao" : "auto"}>
                                {ocupIds.length}/{cap}
                              </Badge>
                              <button
                                type="button"
                                onClick={() => setEditandoId(q.id)}
                                aria-label="Editar quarto"
                                title="Editar"
                                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDuplicarOrigem({ quartoIds: [q.id], hotelOrigem: q.hotel_cidade })}
                                aria-label="Duplicar quarto"
                                title="Duplicar este quarto (com os mesmos pax) para outro hotel"
                                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <ConfirmDeleteButton
                                ariaLabel="Excluir quarto"
                                title={`Excluir quarto ${q.numero}?`}
                                description={
                                  ocupIds.length > 0
                                    ? `Há ${ocupIds.length} passageiro(s) alocado(s). Eles serão desvinculados deste quarto.`
                                    : "Esta ação não pode ser desfeita."
                                }
                                successMessage="Quarto excluído"
                                onConfirm={() => excluirQuarto(q.id, expedicaoId)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 min-h-[40px]">
                            {ocupIds.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground italic flex items-center gap-1 py-2">
                                <User className="h-3 w-3" /> Arraste passageiros aqui
                              </div>
                            ) : (
                              ocupIds.map((id) => {
                                const p = paxById.get(id);
                                return p ? <PaxCard key={id} p={p} trechoKey={t.key} conexao={conexaoByPax.get(p.id)} /> : null;
                              })
                            )}
                          </div>
                        </Dropzone>
                      );
                    })}
                  </div>
                </div>
                </>
                )}
              </section>
            );
          })
        )}

        <NovoQuartoDrawer expedicaoId={expedicaoId} open={drawerOpen} onOpenChange={setDrawerOpen} />
        <QuartosAutomaticosDrawer
          expedicaoId={expedicaoId}
          prefill={autoPrefill}
          open={autoOpen}
          onOpenChange={(v) => { setAutoOpen(v); if (!v) setAutoPrefill(null); }}
        />
        <EditarQuartoDrawer
          expedicaoId={expedicaoId}
          quarto={quartoEditando}
          onOpenChange={(open) => !open && setEditandoId(null)}
        />
        <DuplicarHotelDrawer
          expedicaoId={expedicaoId}
          origem={duplicarOrigem}
          onOpenChange={(open) => !open && setDuplicarOrigem(null)}
        />
        <ConexaoViagemDrawer
          expedicaoId={expedicaoId}
          passageiros={paxAtivos}
          membrosIniciais={conexaoDrawer?.membros ?? []}
          open={conexaoDrawer !== null}
          onOpenChange={(open) => !open && setConexaoDrawer(null)}
        />
      </div>
    </DndContext>
  );
}

function Dropzone({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-editavel-600 ring-offset-1")}>
      {children}
    </div>
  );
}

function PaxCard({
  p,
  trechoKey,
  conexao,
}: {
  p: PassageiroRow;
  trechoKey: string;
  conexao?: { cor: string; companheiros: string };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${trechoKey}::${p.id}` });
  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 50 } : undefined;
  const grupo = grupoEgito(p.nome_completo); // ⚠️ local/temporário (G1/G2 Egito)
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-background p-2 cursor-grab active:cursor-grabbing touch-none select-none",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {conexao && (
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: conexao.cor }}
          title={`Viaja com: ${conexao.companheiros}`}
        />
      )}
      <Avatar nome={p.nome_completo} size={20} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium truncate">{p.nome_completo}</div>
        <div className="text-[10px] text-muted-foreground">{p.tipo}</div>
      </div>
      {grupo && (
        <span
          title={grupo === "G1" ? "Grupo 1" : "Grupo 2"}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            grupo === "G1" ? "bg-editavel-100 text-editavel-700" : "bg-lista-100 text-lista-600",
          )}
        >
          {grupo}
        </span>
      )}
    </div>
  );
}
