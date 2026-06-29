"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, User, Users, Plane, ArrowRight, Upload, UserPlus, LayoutGrid, List, Download } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatPill } from "@/components/ui/StatPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { ViajanteCard } from "./ViajanteCard";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { FilterPopover } from "@/components/ui/FilterPopover";
import { Drive } from "@/components/arquivos/Drive";
import { ImportarPassageirosDrawer } from "@/app/(app)/expedicoes/[id]/passageiros/ImportarPassageirosDrawer";
import { SaudeCampos } from "@/app/(app)/expedicoes/[id]/passageiros/SaudeCampos";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { atualizarDadosPessoais, criarPassageiroAvulso, excluirPessoa } from "@/app/(app)/expedicoes/actions";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import type { StatusReserva, ArquivoRow, SaudePassageiro } from "@/types/database";
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

/**
 * Definição das colunas da tabela global, no estilo "AutoFiltro do Excel":
 * cada coluna tem como ordenar (`sortVal`) e como filtrar por texto (`text`).
 */
type ColunaPax = {
  key: string;
  label: string;
  type: "text" | "num";
  center?: boolean;
  sortVal: (p: PessoaAgregada) => string | number;
  text: (p: PessoaAgregada) => string;
};

const COLUNAS: ColunaPax[] = [
  { key: "nome", label: "Nome", type: "text", sortVal: (p) => p.nome_completo, text: (p) => p.nome_completo },
  { key: "cpf", label: "CPF", type: "text", sortVal: (p) => p.cpf ?? "", text: (p) => p.cpf ?? "" },
  { key: "idade", label: "Idade", type: "num", center: true, sortVal: (p) => idade(p.data_nascimento) ?? -1, text: (p) => { const i = idade(p.data_nascimento); return i != null ? String(i) : ""; } },
  { key: "passaporte", label: "Passaporte", type: "text", sortVal: (p) => p.passaporte ?? "", text: (p) => p.passaporte ?? "" },
  { key: "validade", label: "Validade", type: "text", sortVal: (p) => p.validade_passaporte ?? "", text: (p) => (p.validade_passaporte ? formatDate(p.validade_passaporte) : "") },
  { key: "email", label: "E-mail", type: "text", sortVal: (p) => p.email ?? "", text: (p) => p.email ?? "" },
  { key: "telefone", label: "Telefone", type: "text", sortVal: (p) => p.telefone ?? "", text: (p) => p.telefone ?? "" },
  { key: "expedicoes", label: "Expedições", type: "num", center: true, sortVal: (p) => p.totalExpedicoes, text: (p) => String(p.totalExpedicoes) },
];

export function PassageirosGlobalTabela({
  pessoas,
  expedicoes,
  arquivos,
}: {
  pessoas: PessoaAgregada[];
  expedicoes: { codigo: string; nome: string }[];
  arquivos: ArquivoRow[];
}) {
  const [busca, setBusca] = React.useState("");
  const [aberta, setAberta] = React.useState<PessoaAgregada | null>(null);
  const [view, setView] = React.useState<"clube" | "lista">("clube");
  const [expedicoesDe, setExpedicoesDe] = React.useState<PessoaAgregada | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [sortCol, setSortCol] = React.useState("nome");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [colFiltros, setColFiltros] = React.useState<Record<string, string>>({});

  const termo = busca.trim().toLowerCase();
  const algumFiltro = termo.length > 0 || Object.values(colFiltros).some((v) => v.trim());

  // Pipeline: busca global → filtros por coluna (combinam, estilo Excel) → ordenação.
  const ordenadas = React.useMemo(() => {
    let arr = pessoas;
    if (termo) {
      arr = arr.filter((p) =>
        [p.nome_completo, p.cpf ?? "", p.email ?? "", p.passaporte ?? ""]
          .join(" ").toLowerCase().includes(termo),
      );
    }
    for (const [key, val] of Object.entries(colFiltros)) {
      const t = val.trim().toLowerCase();
      if (!t) continue;
      const c = COLUNAS.find((x) => x.key === key);
      if (!c) continue;
      arr = arr.filter((p) => c.text(p).toLowerCase().includes(t));
    }
    const c = COLUNAS.find((x) => x.key === sortCol) ?? COLUNAS[0];
    const dir = sortDir === "desc" ? -1 : 1;
    return [...arr].sort((a, b) => {
      if (c.type === "num") return (Number(c.sortVal(a)) - Number(c.sortVal(b))) * dir;
      return String(c.sortVal(a)).localeCompare(String(c.sortVal(b)), "pt-BR", { sensitivity: "base" }) * dir;
    });
  }, [pessoas, termo, colFiltros, sortCol, sortDir]);

  const totalParticipacoes = pessoas.reduce((s, p) => s + p.totalExpedicoes, 0);
  const [exportando, setExportando] = React.useState(false);

  // Exporta os passageiros atualmente filtrados (.xlsx): dados pessoais +
  // expedições que a pessoa já fez e as que ainda vai fazer.
  async function exportarExcel() {
    if (ordenadas.length === 0) {
      toast.error("Nada para exportar", { description: "Nenhum passageiro com os filtros atuais." });
      return;
    }
    setExportando(true);
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      wb.creator = "Sistema de Expedições";
      const ws = wb.addWorksheet("Passageiros");

      const VERDE = "FF09282B"; // brand dark
      ws.columns = [
        { header: "Nome completo", key: "nome", width: 30 },
        { header: "CPF", key: "cpf", width: 16 },
        { header: "Nascimento", key: "nasc", width: 12 },
        { header: "Idade", key: "idade", width: 7 },
        { header: "Passaporte", key: "passaporte", width: 14 },
        { header: "Validade passaporte", key: "validade", width: 16 },
        { header: "E-mail", key: "email", width: 28 },
        { header: "Telefone", key: "telefone", width: 16 },
        { header: "Contato emergência", key: "emnome", width: 22 },
        { header: "Fone emergência", key: "emfone", width: 16 },
        { header: "Restrições alimentares", key: "rest", width: 24 },
        { header: "Condições médicas", key: "med", width: 24 },
        { header: "Nº expedições", key: "qtd", width: 12 },
        { header: "Já participou", key: "passadas", width: 44 },
        { header: "Vai participar", key: "futuras", width: 44 },
      ];

      const head = ws.getRow(1);
      head.height = 18;
      head.eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
        c.alignment = { vertical: "middle" };
      });

      const hojeIso = new Date().toISOString().slice(0, 10);
      const fmtExp = (e: PessoaAgregada["expedicoes"][number]) =>
        `${e.nome} — ${e.data_embarque ? formatDate(e.data_embarque) : "sem data"} (${e.status_reserva})`;

      for (const p of ordenadas) {
        const ativos = p.expedicoes.filter((e) => e.status_reserva !== "Cancelado");
        const passadas = ativos.filter((e) => (e.data_embarque ?? "").slice(0, 10) < hojeIso);
        const futuras = ativos.filter((e) => (e.data_embarque ?? "").slice(0, 10) >= hojeIso);
        const i = idade(p.data_nascimento);
        ws.addRow({
          nome: p.nome_completo,
          cpf: p.cpf ?? "",
          nasc: p.data_nascimento ? formatDate(p.data_nascimento) : "",
          idade: i ?? "",
          passaporte: p.passaporte ?? "",
          validade: p.validade_passaporte ? formatDate(p.validade_passaporte) : "",
          email: p.email ?? "",
          telefone: p.telefone ?? "",
          emnome: p.contato_emergencia_nome ?? "",
          emfone: p.contato_emergencia_fone ?? "",
          rest: p.restricoes_alimentares ?? "",
          med: p.condicoes_medicas ?? "",
          qtd: p.totalExpedicoes,
          passadas: passadas.map(fmtExp).join("\n"),
          futuras: futuras.map(fmtExp).join("\n"),
        });
      }

      // Quebra de linha nas colunas que listam expedições e textos longos.
      for (const key of ["passadas", "futuras", "rest", "med"]) {
        ws.getColumn(key).alignment = { wrapText: true, vertical: "top" };
      }
      ws.views = [{ state: "frozen", ySplit: 1 }];

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passageiros-${hojeIso}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${ordenadas.length} passageiro${ordenadas.length === 1 ? "" : "s"} exportado${ordenadas.length === 1 ? "" : "s"} (.xlsx)`);
    } catch {
      toast.error("Falha ao gerar o arquivo");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Barra de busca + resumo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF, e-mail…"
              className="pl-7"
            />
          </div>
          {algumFiltro && (
            <button
              type="button"
              onClick={() => { setBusca(""); setColFiltros({}); }}
              className="text-[12px] text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {pessoas.length} pessoa{pessoas.length === 1 ? "" : "s"} · {totalParticipacoes} participaç{totalParticipacoes === 1 ? "ão" : "ões"} em expedições
          </p>
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("clube")}
              title="Clube de viajantes"
              className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "clube" ? "bg-[var(--brand-dark)] text-[var(--brand-lime)]" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              title="Lista"
              className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "lista" ? "bg-[var(--brand-dark)] text-[var(--brand-lime)]" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button variant="brand" size="sm" onClick={() => setNovoOpen(true)}>
            <UserPlus className="h-3 w-3" /> Novo passageiro
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-3 w-3" /> Importar CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportarExcel}
            disabled={exportando || pessoas.length === 0}
            title="Exporta os passageiros filtrados (.xlsx) com dados pessoais e expedições"
          >
            <Download className="h-3 w-3" /> {exportando ? "Exportando…" : "Exportar"}
          </Button>
        </div>
      </div>

      {pessoas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <StatPill label="pessoas na base" value={pessoas.length} variant="editavel" />
          <StatPill label="já viajaram" value={pessoas.filter((p) => p.totalExpedicoes > 0).length} variant="vinculado" />
          <StatPill label="participações" value={totalParticipacoes} variant="lista" />
          <StatPill label="sem CPF" value={pessoas.filter((p) => !p.cpf).length} variant="atencao" />
        </div>
      )}

      {/* Barra de filtros na visão Clube (mesma lógica dos cabeçalhos da tabela) */}
      {view === "clube" && pessoas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Filtrar / ordenar:
          </span>
          {COLUNAS.map((c) => (
            <ColunaFiltro
              key={c.key}
              col={c}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={(dir) => { setSortCol(c.key); setSortDir(dir); }}
              filtro={colFiltros[c.key] ?? ""}
              onFiltro={(v) => setColFiltros((s) => ({ ...s, [c.key]: v }))}
            />
          ))}
        </div>
      )}

      {/* Clube de viajantes (cards) */}
      {view === "clube" &&
        (pessoas.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Seu clube de viajantes começa aqui"
            description="Toda pessoa que viaja com a agência entra no clube, com perfil, saúde e nível de fidelidade. Cadastre a primeira."
            actionLabel="Novo passageiro"
            onAction={() => setNovoOpen(true)}
          />
        ) : ordenadas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground">
            Nenhum resultado para a busca.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ordenadas.map((p) => (
              <ViajanteCard key={p.chave} pessoa={p} onOpen={() => setAberta(p)} />
            ))}
          </div>
        ))}

      {/* Tabela */}
      {view === "lista" && (
      <div className="rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {COLUNAS.map((c) => (
                  <th key={c.key} className={cn("px-2 py-1.5", c.center ? "text-center" : "text-left")}>
                    <ColunaFiltro
                      col={c}
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={(dir) => { setSortCol(c.key); setSortDir(dir); }}
                      filtro={colFiltros[c.key] ?? ""}
                      onFiltro={(v) => setColFiltros((s) => ({ ...s, [c.key]: v }))}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    {pessoas.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="Sua base de pessoas começa aqui"
                        description="Toda pessoa que viaja com a agência fica aqui, com perfil, saúde e histórico de expedições. Cadastre a primeira."
                        actionLabel="Novo passageiro"
                        onAction={() => setNovoOpen(true)}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground py-8">Nenhum resultado para a busca.</div>
                    )}
                  </td>
                </tr>
              ) : (
                ordenadas.map((p) => {
                  const id = idade(p.data_nascimento);
                  return (
                    <tr
                      key={p.chave}
                      onClick={() => setAberta(p)}
                      title="Abrir perfil do passageiro"
                      className="group border-b border-border hover:bg-accent/30 cursor-pointer"
                    >
                      <td className="px-2.5 font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <Avatar nome={p.nome_completo} size={24} className="shrink-0" />
                          <span className="text-editavel-700 group-hover:underline">{p.nome_completo}</span>
                        </span>
                      </td>
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
                      <td className="px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={p.totalExpedicoes === 0}
                          onClick={() => setExpedicoesDe(p)}
                          title={p.totalExpedicoes > 0 ? "Ver as expedições desta pessoa" : "Sem expedições"}
                          className="inline-flex items-center gap-1 hover:opacity-80 disabled:cursor-default disabled:opacity-60 cursor-pointer"
                        >
                          <Plane className="h-3 w-3 text-muted-foreground" />
                          <Badge variant={p.totalExpedicoes > 0 ? "lista" : "auto"}>{p.totalExpedicoes}</Badge>
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
      )}

      {aberta && (
        <PessoaDrawer
          pessoa={aberta}
          arquivos={arquivos.filter((a) => a.passageiro_id && aberta.idsPassageiros.includes(a.passageiro_id))}
          onClose={() => setAberta(null)}
        />
      )}

      {expedicoesDe && (
        <ExpedicoesDePessoaDrawer pessoa={expedicoesDe} onClose={() => setExpedicoesDe(null)} />
      )}

      <ImportarPassageirosDrawer
        modo="global"
        expedicoes={expedicoes}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <NovoPassageiroDrawer open={novoOpen} onOpenChange={setNovoOpen} />
    </div>
  );
}

const novoAvulsoSchema = z.object({
  nome_completo: z.string().min(2, "Mínimo 2 caracteres"),
  cpf: z.string().optional(),
  data_nascimento: z.string().optional(),
  passaporte: z.string().optional(),
  validade_passaporte: z.string().optional(),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  telefone: z.string().optional(),
});
type NovoAvulsoForm = z.infer<typeof novoAvulsoSchema>;

function NovoPassageiroDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NovoAvulsoForm>({ resolver: zodResolver(novoAvulsoSchema) });

  async function onSubmit(data: NovoAvulsoForm) {
    const r = await criarPassageiroAvulso({
      nome_completo: data.nome_completo,
      cpf: data.cpf?.trim() || null,
      data_nascimento: data.data_nascimento || null,
      passaporte: data.passaporte?.trim() || null,
      validade_passaporte: data.validade_passaporte || null,
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
    });
    if (r.ok) {
      toast.success("Passageiro cadastrado na base", {
        description: "Sem expedição — aloque a uma quando quiser.",
      });
      reset();
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao cadastrar", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DrawerHeader>
            <DrawerTitle>Novo passageiro</DrawerTitle>
            <DrawerDescription>
              Cadastra uma pessoa na base operacional sem vincular a nenhuma expedição.
              Você pode alocá-la a uma expedição depois, pelo botão “Adicionar existente”.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="na-nome">Nome completo</Label>
              <Input id="na-nome" {...register("nome_completo")} />
              {errors.nome_completo && <p className="text-[11px] text-critico-600">{errors.nome_completo.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="na-cpf">CPF</Label>
                <Input id="na-cpf" placeholder="Opcional" {...register("cpf")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="na-nasc">Nascimento</Label>
                <Input id="na-nasc" type="date" {...register("data_nascimento")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="na-pass">Passaporte</Label>
                <Input id="na-pass" {...register("passaporte")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="na-val">Validade passaporte</Label>
                <Input id="na-val" type="date" {...register("validade_passaporte")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="na-email">E-mail</Label>
                <Input id="na-email" type="email" {...register("email")} />
                {errors.email && <p className="text-[11px] text-critico-600">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="na-tel">Telefone</Label>
                <Input id="na-tel" {...register("telefone")} />
              </div>
            </div>

            <p className="rounded-md border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
              Dica: informar o <strong className="text-foreground">CPF</strong> evita duplicar a
              pessoa quando ela for importada ou adicionada a uma expedição.
            </p>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Cadastrar"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/** Drawer enxuto: só a lista de expedições que a pessoa fez (atalho da coluna). */
function ExpedicoesDePessoaDrawer({
  pessoa,
  onClose,
}: {
  pessoa: PessoaAgregada;
  onClose: () => void;
}) {
  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-editavel-600" /> {pessoa.nome_completo}
          </DrawerTitle>
          <DrawerDescription>
            {pessoa.expedicoes.length} expediç{pessoa.expedicoes.length === 1 ? "ão" : "ões"} — clique para abrir.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
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
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Cabeçalho-filtro de uma coluna (estilo AutoFiltro do Excel). */
function ColunaFiltro({
  col, sortCol, sortDir, onSort, filtro, onFiltro,
}: {
  col: ColunaPax;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (dir: "asc" | "desc") => void;
  filtro: string;
  onFiltro: (v: string) => void;
}) {
  const ativo = sortCol === col.key || filtro.trim().length > 0;
  const btnBase = "flex-1 rounded px-2 py-1 text-[12px] border text-center transition-colors";
  return (
    <FilterPopover label={col.label} active={ativo} align={col.center ? "end" : "start"}>
      <div className="space-y-1.5">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSort("asc")}
            className={cn(btnBase, sortCol === col.key && sortDir === "asc" ? "border-foreground bg-muted" : "border-border hover:bg-muted/60")}
          >
            {col.type === "num" ? "Menor → maior" : "A → Z"}
          </button>
          <button
            type="button"
            onClick={() => onSort("desc")}
            className={cn(btnBase, sortCol === col.key && sortDir === "desc" ? "border-foreground bg-muted" : "border-border hover:bg-muted/60")}
          >
            {col.type === "num" ? "Maior → menor" : "Z → A"}
          </button>
        </div>
        <input
          value={filtro}
          onChange={(e) => onFiltro(e.target.value)}
          placeholder={`Filtrar ${col.label.toLowerCase()}…`}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-editavel-600"
        />
        {filtro.trim().length > 0 && (
          <button
            type="button"
            onClick={() => onFiltro("")}
            className="text-[11px] text-muted-foreground hover:underline"
          >
            Limpar filtro
          </button>
        )}
      </div>
    </FilterPopover>
  );
}

const perfilSchema = z.object({
  nome_completo: z.string().min(2, "Mínimo 2 caracteres"),
  cpf: z.string().optional(),
  passaporte: z.string().optional(),
  validade_passaporte: z.string().optional(),
  data_nascimento: z.string().optional(),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  telefone: z.string().optional(),
  contato_emergencia_nome: z.string().optional(),
  contato_emergencia_fone: z.string().optional(),
  restricoes_alimentares: z.string().optional(),
  condicoes_medicas: z.string().optional(),
  saude: z.record(z.string(), z.string()).optional(),
});
type PerfilForm = z.infer<typeof perfilSchema>;

function PessoaDrawer({
  pessoa,
  arquivos,
  onClose,
}: {
  pessoa: PessoaAgregada;
  arquivos: ArquivoRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const id = idade(pessoa.data_nascimento);
  const refId = pessoa.idsPassageiros[0];
  const [tab, setTab] = React.useState<"passageiro" | "saude" | "expedicoes">("passageiro");

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      nome_completo: pessoa.nome_completo,
      cpf: pessoa.cpf ?? "",
      passaporte: pessoa.passaporte ?? "",
      validade_passaporte: pessoa.validade_passaporte?.slice(0, 10) ?? "",
      data_nascimento: pessoa.data_nascimento?.slice(0, 10) ?? "",
      email: pessoa.email ?? "",
      telefone: pessoa.telefone ?? "",
      contato_emergencia_nome: pessoa.contato_emergencia_nome ?? "",
      contato_emergencia_fone: pessoa.contato_emergencia_fone ?? "",
      restricoes_alimentares: pessoa.restricoes_alimentares ?? "",
      condicoes_medicas: pessoa.condicoes_medicas ?? "",
      saude: (pessoa.saude as Record<string, string>) ?? {},
    },
  });

  async function onSubmit(data: PerfilForm) {
    if (!refId) {
      toast.error("Pessoa sem vínculo de expedição");
      return;
    }
    const r = await atualizarDadosPessoais(refId, {
      nome_completo: data.nome_completo,
      cpf: data.cpf?.trim() || null,
      passaporte: data.passaporte?.trim() || null,
      validade_passaporte: data.validade_passaporte || null,
      data_nascimento: data.data_nascimento || null,
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
      contato_emergencia_nome: data.contato_emergencia_nome?.trim() || null,
      contato_emergencia_fone: data.contato_emergencia_fone?.trim() || null,
      restricoes_alimentares: data.restricoes_alimentares?.trim() || null,
      condicoes_medicas: data.condicoes_medicas?.trim() || null,
      saude: Object.fromEntries(
        Object.entries(data.saude ?? {}).filter(([, v]) => v != null && String(v).trim() !== ""),
      ),
    });
    if (r.ok) {
      toast.success(
        pessoa.totalExpedicoes > 1
          ? `Dados atualizados em ${pessoa.expedicoes.length} expedições`
          : "Dados atualizados",
      );
      onClose();
      router.refresh();
    } else {
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent width="w-[560px]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-editavel-600" /> {pessoa.nome_completo}
          </DrawerTitle>
          <DrawerDescription>
            {pessoa.totalExpedicoes} expediç{pessoa.totalExpedicoes === 1 ? "ão" : "ões"} ·{" "}
            {id != null ? `${id} anos` : "idade não informada"} · alterações refletem em todas as expedições
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <div className="flex gap-3">
            <nav className="w-32 shrink-0 space-y-1 self-start sticky top-0">
              <MenuBtn ativo={tab === "passageiro"} onClick={() => setTab("passageiro")}>
                Passageiro
              </MenuBtn>
              <MenuBtn ativo={tab === "saude"} onClick={() => setTab("saude")}>
                Saúde
              </MenuBtn>
              <MenuBtn ativo={tab === "expedicoes"} onClick={() => setTab("expedicoes")}>
                <span className="flex w-full items-center justify-between gap-1">
                  Expedições
                  <span className="text-[11px] opacity-70">{pessoa.totalExpedicoes}</span>
                </span>
              </MenuBtn>
            </nav>

            <div className="flex-1 min-w-0">
              {/* ABA: Passageiro (dados pessoais + documentos) */}
              <div className={cn("space-y-4", tab !== "passageiro" && "hidden")}>
                {/* Dados pessoais — editáveis */}
                <form id="perfil-pessoa-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pp-nome">Nome completo</Label>
              <Input id="pp-nome" {...register("nome_completo")} />
              {errors.nome_completo && <p className="text-[11px] text-critico-600">{errors.nome_completo.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="pp-cpf">CPF</Label>
                <Input id="pp-cpf" {...register("cpf")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pp-nasc">Nascimento</Label>
                <Input id="pp-nasc" type="date" {...register("data_nascimento")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="pp-pass">Passaporte</Label>
                <Input id="pp-pass" {...register("passaporte")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pp-val">Validade passaporte</Label>
                <Input id="pp-val" type="date" {...register("validade_passaporte")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="pp-email">E-mail</Label>
                <Input id="pp-email" type="email" {...register("email")} />
                {errors.email && <p className="text-[11px] text-critico-600">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pp-tel">Telefone</Label>
                <Input id="pp-tel" {...register("telefone")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="pp-emnome">Contato de emergência</Label>
                <Input id="pp-emnome" placeholder="Nome" {...register("contato_emergencia_nome")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pp-emfone">Fone de emergência</Label>
                <Input id="pp-emfone" {...register("contato_emergencia_fone")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pp-rest">Restrições alimentares</Label>
              <Input id="pp-rest" {...register("restricoes_alimentares")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-med">Condições médicas</Label>
              <Input id="pp-med" {...register("condicoes_medicas")} />
            </div>
          </form>

                {/* Documentos — dentro da aba Passageiro */}
                <section className="pt-4 border-t border-border space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold">Documentos do passageiro</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Passaporte, CNH, RG e demais documentos pessoais — compartilhados por todas as expedições.
                    </p>
                  </div>
                  {pessoa.expedicaoIdAncora && pessoa.passageiroIdAncora ? (
                    <Drive
                      expedicaoId={pessoa.expedicaoIdAncora}
                      passageiroId={pessoa.passageiroIdAncora}
                      arquivos={arquivos}
                    />
                  ) : (
                    <p className="text-[12px] text-muted-foreground italic">
                      Vincule a pessoa a uma expedição para anexar documentos.
                    </p>
                  )}
                </section>
              </div>

              {/* ABA: Saúde */}
              <div className={cn("space-y-3", tab !== "saude" && "hidden")}>
                <div>
                  <h3 className="text-sm font-semibold">Saúde</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Questionário de saúde — compartilhado entre todas as expedições da pessoa.
                  </p>
                </div>
                <SaudeCampos
                  value={(watch("saude") as SaudePassageiro) ?? {}}
                  onChange={(next) => setValue("saude", next as never, { shouldDirty: true })}
                  expedicaoId={pessoa.expedicaoIdAncora}
                  passageiroId={pessoa.passageiroIdAncora}
                />
              </div>

              {/* ABA: Expedições */}
              <div className={cn(tab !== "expedicoes" && "hidden")}>
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
              </div>
            </div>
          </div>
        </DrawerBody>

        <DrawerFooter>
          <ConfirmDeleteButton
            triggerLabel="Excluir passageiro"
            triggerClassName="mr-auto"
            ariaLabel="Excluir passageiro da base"
            disabled={!refId}
            title={`Excluir "${pessoa.nome_completo}" da base?`}
            description={
              pessoa.totalExpedicoes > 0
                ? `Esta pessoa está em ${pessoa.totalExpedicoes} expediç${pessoa.totalExpedicoes === 1 ? "ão" : "ões"}. Excluir remove TODOS os registros dela do sistema, inclusive dessas expedições. Esta ação não pode ser desfeita.`
                : "Remove o passageiro da base operacional. Esta ação não pode ser desfeita."
            }
            successMessage="Passageiro excluído da base"
            onConfirm={() => excluirPessoa(refId)}
            onDeleted={() => {
              onClose();
              router.refresh();
            }}
          />
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          <Button type="submit" form="perfil-pessoa-form" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Item do menu vertical do perfil (Passageiro / Saúde / Expedições). */
function MenuBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        ativo ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
