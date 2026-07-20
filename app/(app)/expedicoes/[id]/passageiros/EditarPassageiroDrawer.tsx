"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ExternalLink, ShieldCheck } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { TIPO_PASSAGEIRO, STATUS_RESERVA, COR_PRONTIDAO, CATEGORIA_ARQUIVO } from "@/lib/constants";
import { PassaporteAnexo } from "@/components/arquivos/PassaporteAnexo";

/** Pastas do Drive no perfil, sem "Documentos pessoais" (o passaporte tem item próprio). */
const CATEGORIAS_SEM_DOC_PESSOAL = CATEGORIA_ARQUIVO.filter((c) => c !== "Documentos pessoais");
import { Badge } from "@/components/ui/Badge";
import { cn, formatDate, aniversarioNaViagem } from "@/lib/utils";
import { Drive } from "@/components/arquivos/Drive";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { atualizarPassageiroLote, excluirPassageiro } from "@/app/(app)/expedicoes/actions";
import { ProntidaoConteudo } from "./ProntidaoPaxDrawer";
import type { ArquivoRow, PassageiroRow, Tables, SaudePassageiro } from "@/types/database";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";
import { SaudeCampos } from "./SaudeCampos";
import { FidelidadeBadge } from "./FidelidadeBadge";

const schema = z.object({
  nome_completo: z.string().min(2, "Mínimo 2 caracteres"),
  tipo: z.enum(["Pagante", "Cortesia", "Líder"]),
  status_reserva: z.enum(["Lead", "Pré-reserva", "Confirmado", "Cancelado"]),
  cpf: z.string().optional(),
  passaporte: z.string().optional(),
  validade_passaporte: z.string().optional(),
  data_nascimento: z.string().optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  telefone: z.string().optional(),
  companhia_aerea: z.string().optional(),
  localizador: z.string().optional(),
  voo_nacional_necessario: z.boolean().optional(),
  contrato_assinado: z.boolean().optional(),
  checkin_online_feito: z.boolean().optional(),
  observacoes: z.string().optional(),
  saude: z.record(z.string(), z.string()).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  expedicaoId: string;
  passageiro: PassageiroRow | null;
  arquivos: ArquivoRow[];
  destino: string;
  dataEmbarque: string;
  dataRetorno: string;
  prontidao: ProntidaoPassageiro | null;
  usuarios: Tables<"usuarios">[];
  /** Posição cronológica desta expedição na história da pessoa (1ª, 2ª...). */
  posicaoFidelidade?: number | null;
  onOpenChange: (open: boolean) => void;
}

export function EditarPassageiroDrawer({ expedicaoId, passageiro, arquivos, destino, dataEmbarque, dataRetorno, prontidao, usuarios, posicaoFidelidade, onOpenChange }: Props) {
  const router = useRouter();
  const open = passageiro !== null;
  const [tab, setTab] = React.useState<"passageiro" | "prontidao" | "saude">("passageiro");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!passageiro) return;
    setTab("passageiro");
    reset({
      nome_completo: passageiro.nome_completo,
      tipo: passageiro.tipo,
      status_reserva: passageiro.status_reserva,
      cpf: passageiro.cpf ?? "",
      passaporte: passageiro.passaporte ?? "",
      validade_passaporte: passageiro.validade_passaporte?.slice(0, 10) ?? "",
      data_nascimento: passageiro.data_nascimento?.slice(0, 10) ?? "",
      email: passageiro.email ?? "",
      telefone: passageiro.telefone ?? "",
      companhia_aerea: passageiro.companhia_aerea ?? "",
      localizador: passageiro.localizador ?? "",
      voo_nacional_necessario: passageiro.voo_nacional_necessario ?? false,
      contrato_assinado: passageiro.contrato_assinado ?? false,
      checkin_online_feito: passageiro.checkin_online_feito ?? false,
      observacoes: passageiro.observacoes ?? "",
      saude: (passageiro.saude as Record<string, string>) ?? {},
    });
  }, [passageiro, reset]);

  async function onSubmit(data: FormData) {
    if (!passageiro) return;
    const r = await atualizarPassageiroLote(passageiro.id, expedicaoId, {
      ...data,
      cpf: data.cpf?.trim() || null,
      passaporte: data.passaporte?.trim() || null,
      validade_passaporte: data.validade_passaporte || null,
      data_nascimento: data.data_nascimento || null,
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
      companhia_aerea: data.companhia_aerea?.trim() || null,
      localizador: data.localizador?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      saude: Object.fromEntries(
        Object.entries(data.saude ?? {}).filter(([, v]) => v != null && String(v).trim() !== ""),
      ),
    });
    if (r.ok) {
      toast.success("Passageiro atualizado");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  const arquivosDoPassageiro = passageiro
    ? arquivos.filter((a) => a.passageiro_id === passageiro.id)
    : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent width="w-[600px]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <span className="truncate">{passageiro?.nome_completo ?? "Passageiro"}</span>
            <FidelidadeBadge posicao={posicaoFidelidade} />
          </DrawerTitle>
          <DrawerDescription>Dados pessoais, prontidão e saúde do passageiro.</DrawerDescription>
          {passageiro && (
            <Link
              href={`/expedicoes/${expedicaoId}/passageiros/${passageiro.id}`}
              className="mt-1.5 inline-flex w-fit items-center gap-1 text-[12px] font-medium text-editavel-700 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir página completa
            </Link>
          )}
        </DrawerHeader>

        <DrawerBody>
          <div className="flex gap-3">
            <nav className="w-32 shrink-0 space-y-1 self-start sticky top-0">
              <MenuBtn ativo={tab === "passageiro"} onClick={() => setTab("passageiro")}>
                Passageiro
              </MenuBtn>
              <MenuBtn ativo={tab === "prontidao"} onClick={() => setTab("prontidao")}>
                <span className="flex w-full items-center justify-between gap-1">
                  Prontidão
                  {prontidao && (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        prontidao.resultado.prontidao === "Apto"
                          ? "bg-vinculado-600"
                          : prontidao.resultado.prontidao === "Atenção"
                            ? "bg-atencao-600"
                            : "bg-critico-600",
                      )}
                    />
                  )}
                </span>
              </MenuBtn>
              <MenuBtn ativo={tab === "saude"} onClick={() => setTab("saude")}>
                Saúde
              </MenuBtn>
            </nav>

            <div className="flex-1 min-w-0">
              {/* ABA: Passageiro (dados pessoais + arquivos) */}
              <div className={cn("space-y-4", tab !== "passageiro" && "hidden")}>
                <form
                  id="edit-passageiro-form"
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-3"
                >
            <div className="space-y-1">
              <Label htmlFor="ep-nome">Nome completo</Label>
              <Input id="ep-nome" {...register("nome_completo")} />
              {errors.nome_completo && <p className="text-[11px] text-critico-600">{errors.nome_completo.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "Pagante", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_PASSAGEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={watch("status_reserva")} onValueChange={(v) => setValue("status_reserva", v as "Lead", { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_RESERVA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-cpf">CPF</Label>
                <Input id="ep-cpf" {...register("cpf")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-tel">Telefone</Label>
                <Input id="ep-tel" {...register("telefone")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-pass">Passaporte</Label>
                <Input id="ep-pass" {...register("passaporte")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-val">Validade</Label>
                <Input id="ep-val" type="date" {...register("validade_passaporte")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-nasc">Nascimento</Label>
                <Input id="ep-nasc" type="date" {...register("data_nascimento")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-email">Email</Label>
                <Input id="ep-email" type="email" {...register("email")} />
                {errors.email && <p className="text-[11px] text-critico-600">{errors.email.message}</p>}
              </div>
            </div>

            {/* Campo inteligente: aniversário durante a viagem (calculado). */}
            <div className="rounded-md border border-border bg-muted/20 p-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Aniversário na viagem</div>
              {(() => {
                const aniv = aniversarioNaViagem(watch("data_nascimento"), dataEmbarque, dataRetorno);
                return aniv ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-lista-100 px-2.5 py-1 text-[12px] font-medium text-lista-600">
                    🎂 Faz aniversário em {formatDate(aniv.data)}{aniv.idade != null ? ` (${aniv.idade} anos)` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] text-muted-foreground">Não faz aniversário durante esta viagem.</p>
                );
              })()}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ep-obs">Observações</Label>
              <textarea
                id="ep-obs"
                {...register("observacoes")}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
              />
            </div>
          </form>

                {/* Arquivos — dentro da aba Passageiro */}
                {passageiro && (
                  <div className="pt-4 border-t border-border space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold">Documentos do passageiro</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Passaporte e demais arquivos vinculados a este passageiro.
                      </p>
                    </div>
                    <PassaporteAnexo
                      expedicaoId={expedicaoId}
                      passageiroId={passageiro.id}
                      arquivoId={passageiro.passaporte_arquivo_id}
                    />
                    <Drive
                      expedicaoId={expedicaoId}
                      passageiroId={passageiro.id}
                      arquivos={arquivosDoPassageiro}
                      categorias={CATEGORIAS_SEM_DOC_PESSOAL}
                    />
                  </div>
                )}

                {/* Perfil & conexões (do formulário de inscrição) — só leitura */}
                {(() => {
                  const pv = passageiro?.perfil_viajante ?? null;
                  const tem = pv && [pv.profissao, pv.descricao_grupo, pv.anima_expedicao, pv.significado, pv.instagram, pv.camiseta, pv.musica].some((v) => v && String(v).trim());
                  const fotoUrl = passageiro?.foto_arquivo_id ? `/api/arquivos/${passageiro.foto_arquivo_id}/download?inline=1` : null;
                  if (!tem && !fotoUrl) return null;
                  return (
                    <div className="pt-4 border-t border-border space-y-2">
                      <h3 className="text-sm font-semibold">Perfil &amp; conexões</h3>
                      {fotoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fotoUrl} alt="Foto do viajante" className="h-24 w-24 rounded-lg object-cover" />
                      )}
                      {pv && (
                        <div className="grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
                          <PerfilLinha label="Profissão" value={pv.profissao} />
                          <PerfilLinha label="Como se descreve em grupo" value={pv.descricao_grupo} />
                          <PerfilLinha label="O que mais te anima" value={pv.anima_expedicao} />
                          <PerfilLinha label="Significado" value={pv.significado} />
                          <PerfilLinha label="Instagram" value={pv.instagram} />
                          <PerfilLinha label="Camiseta" value={pv.camiseta} />
                          <PerfilLinha label="Música" value={pv.musica} />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ABA: Prontidão */}
              <div className={cn(tab !== "prontidao" && "hidden")}>
                {prontidao ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-vinculado-600" /> Prontidão de embarque
                      <Badge variant={COR_PRONTIDAO[prontidao.resultado.prontidao]}>
                        {prontidao.resultado.prontidao}
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Clique numa exigência para editar ou anexar.
                    </p>
                    <ProntidaoConteudo
                      expedicaoId={expedicaoId}
                      destino={destino}
                      item={prontidao}
                      usuarios={usuarios}
                      arquivos={arquivos}
                    />
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    Sem dados de prontidão para este passageiro.
                  </p>
                )}
              </div>

              {/* ABA: Saúde */}
              <div className={cn("space-y-3", tab !== "saude" && "hidden")}>
                <div>
                  <h3 className="text-sm font-semibold">Saúde</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Questionário de saúde — compartilhado entre as expedições da pessoa.
                  </p>
                </div>
                <SaudeCampos
                  value={(watch("saude") as SaudePassageiro) ?? {}}
                  onChange={(next) => setValue("saude", next as never, { shouldDirty: true })}
                  expedicaoId={expedicaoId}
                  passageiroId={passageiro?.id ?? null}
                />
              </div>
            </div>
          </div>
        </DrawerBody>

        <DrawerFooter>
          {passageiro && (
            <ConfirmDeleteButton
              triggerLabel="Remover desta expedição"
              triggerClassName="mr-auto"
              ariaLabel="Remover passageiro desta expedição"
              title={`Remover "${passageiro.nome_completo}" desta expedição?`}
              description="Remove o passageiro apenas desta expedição. A pessoa continua no sistema (na base global e em outras expedições, se houver). Para apagá-la de vez, use o perfil em Passageiros."
              successMessage="Passageiro removido desta expedição"
              onConfirm={() => excluirPassageiro(passageiro.id, expedicaoId)}
              onDeleted={() => {
                onOpenChange(false);
                router.refresh();
              }}
            />
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="submit" form="edit-passageiro-form" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Linha só-leitura do bloco "Perfil & conexões" (esconde se vazia). */
function PerfilLinha({ label, value }: { label: string; value?: string | null }) {
  if (!value || !String(value).trim()) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

/** Item do menu vertical do drawer (Passageiro / Prontidão / Saúde). */
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
