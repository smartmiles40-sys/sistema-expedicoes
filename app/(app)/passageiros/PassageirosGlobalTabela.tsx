"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, User, Plane, ArrowRight, Upload, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { FilterPopover } from "@/components/ui/FilterPopover";
import { Drive } from "@/components/arquivos/Drive";
import { ImportarPassageirosDrawer } from "@/app/(app)/expedicoes/[id]/passageiros/ImportarPassageirosDrawer";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { atualizarDadosPessoais, criarPassageiroAvulso, excluirPessoa } from "@/app/(app)/expedicoes/actions";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import type { StatusReserva, ArquivoRow } from "@/types/database";
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
          <p className="text-xs text-muted-foreground">
            {pessoas.length} pessoa{pessoas.length === 1 ? "" : "s"} · {totalParticipacoes} participaç{totalParticipacoes === 1 ? "ão" : "ões"} em expedições
          </p>
          <Button size="sm" onClick={() => setNovoOpen(true)}>
            <UserPlus className="h-3 w-3" /> Novo passageiro
          </Button>
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
                  <td colSpan={8} className="text-center text-muted-foreground py-8">
                    {pessoas.length === 0 ? "Nenhum passageiro cadastrado ainda." : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              ) : (
                ordenadas.map((p) => {
                  const id = idade(p.data_nascimento);
                  return (
                    <tr key={p.chave} className="border-b border-border hover:bg-accent/30">
                      <td className="px-2.5 font-medium whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setAberta(p)}
                          title="Abrir perfil do passageiro"
                          className="text-left text-editavel-700 hover:underline"
                        >
                          {p.nome_completo}
                        </button>
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
                      <td className="px-2.5 text-center">
                        <Badge variant={p.totalExpedicoes > 0 ? "lista" : "auto"}>{p.totalExpedicoes}</Badge>
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
        <PessoaDrawer
          pessoa={aberta}
          arquivos={arquivos.filter((a) => a.passageiro_id && aberta.idsPassageiros.includes(a.passageiro_id))}
          onClose={() => setAberta(null)}
        />
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

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<PerfilForm>({
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

          {/* Documentos */}
          <section className="mt-5 pt-4 border-t border-border space-y-2">
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

          {/* Histórico de expedições */}
          <section className="mt-5">
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
