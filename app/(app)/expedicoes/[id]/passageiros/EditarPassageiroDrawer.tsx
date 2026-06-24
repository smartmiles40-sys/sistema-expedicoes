"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
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
import { TIPO_PASSAGEIRO, STATUS_RESERVA, COR_PRONTIDAO } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Drive } from "@/components/arquivos/Drive";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { atualizarPassageiroLote, excluirPassageiro } from "@/app/(app)/expedicoes/actions";
import { ProntidaoConteudo } from "./ProntidaoPaxDrawer";
import type { ArquivoRow, PassageiroRow, Tables, SaudePassageiro } from "@/types/database";
import type { ProntidaoPassageiro } from "@/lib/data/expedicoes";

type SaudeCampo = keyof SaudePassageiro;

/** Perguntas do bloco Saúde — Sim/Não + detalhe condicional (quando "Sim"). */
const PERGUNTAS_SAUDE: {
  campo: SaudeCampo;
  pergunta: string;
  detalheCampo?: SaudeCampo;
  detalhePergunta?: string;
}[] = [
  { campo: "problema_saude", pergunta: "Você possui algum problema de saúde relevante?", detalheCampo: "problema_saude_qual", detalhePergunta: "Qual seria o problema de saúde?" },
  { campo: "medicamento_diario", pergunta: "Você toma algum medicamento diariamente?", detalheCampo: "medicamento_diario_qual", detalhePergunta: "Qual seria o medicamento?" },
  { campo: "alergia_medicamento", pergunta: "Possui alergia a medicamento?", detalheCampo: "alergia_medicamento_qual", detalhePergunta: "Qual medicamento você tem alergia?" },
  { campo: "alergia_alimentar", pergunta: "Possui alergia alimentar?", detalheCampo: "alergia_alimentar_qual", detalhePergunta: "Qual seria o alimento que você tem alergia?" },
  { campo: "restricao_alimentar", pergunta: "Possui restrição alimentar?", detalheCampo: "restricao_alimentar_qual", detalhePergunta: "Qual alimento você possui restrição alimentar?" },
  { campo: "limitacao_fisica", pergunta: "Possui limitação física que possa impactar caminhadas ou deslocamentos?", detalheCampo: "limitacao_fisica_qual", detalhePergunta: "Qual limitação física?" },
  { campo: "cirurgia_importante", pergunta: "Já realizou alguma cirurgia importante?", detalheCampo: "cirurgia_qual", detalhePergunta: "Qual cirurgia e quando?" },
  { campo: "vacina_febre_amarela", pergunta: "Você possui o Certificado Internacional de Vacinação contra Febre Amarela?" },
];

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
const saudeName = (c: SaudeCampo) => `saude.${c}` as Path<FormData>;

interface Props {
  expedicaoId: string;
  passageiro: PassageiroRow | null;
  arquivos: ArquivoRow[];
  destino: string;
  prontidao: ProntidaoPassageiro | null;
  usuarios: Tables<"usuarios">[];
  onOpenChange: (open: boolean) => void;
}

export function EditarPassageiroDrawer({ expedicaoId, passageiro, arquivos, destino, prontidao, usuarios, onOpenChange }: Props) {
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
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="truncate">{passageiro?.nome_completo ?? "Passageiro"}</DrawerTitle>
            {passageiro && (
              <Link
                href={`/expedicoes/${expedicaoId}/passageiros/${passageiro.id}`}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> Abrir página completa
              </Link>
            )}
          </div>
          <DrawerDescription>Dados pessoais, prontidão e saúde do passageiro.</DrawerDescription>
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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ep-cia">Companhia aérea</Label>
                <Input id="ep-cia" {...register("companhia_aerea")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-loc">Localizador</Label>
                <Input id="ep-loc" {...register("localizador")} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Embarque</span>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  {...register("contrato_assinado")}
                  className="h-3.5 w-3.5"
                />
                Contrato assinado
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  {...register("checkin_online_feito")}
                  className="h-3.5 w-3.5"
                />
                Check-in online feito
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  {...register("voo_nacional_necessario")}
                  className="h-3.5 w-3.5"
                />
                Voo nacional necessário
              </label>
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
                      <h3 className="text-sm font-semibold">Arquivos do cliente</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Apólices, bilhetes, documentos pessoais. Vinculados a este passageiro.
                      </p>
                    </div>
                    <Drive
                      expedicaoId={expedicaoId}
                      passageiroId={passageiro.id}
                      arquivos={arquivosDoPassageiro}
                    />
                  </div>
                )}
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
                <div className="space-y-2.5">
                  {PERGUNTAS_SAUDE.map((q) => {
                    const val = (watch(saudeName(q.campo)) as unknown as string) ?? "";
                    return (
                      <div key={q.campo} className="space-y-1.5 rounded-md border border-border/70 p-2.5">
                        <Label className="text-[12px] leading-snug">{q.pergunta}</Label>
                        <div className="flex gap-1.5">
                          {(["Sim", "Não"] as const).map((opt) => (
                            <button
                              type="button"
                              key={opt}
                              onClick={() =>
                                setValue(saudeName(q.campo), (val === opt ? "" : opt) as never, { shouldDirty: true })
                              }
                              className={cn(
                                "px-3 py-1 rounded-md border text-[12px] transition-colors",
                                val === opt ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted",
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {q.detalheCampo && val === "Sim" && (
                          <div className="space-y-1 pt-0.5">
                            <Label htmlFor={`saude-${q.detalheCampo}`} className="text-[11px] text-muted-foreground">
                              {q.detalhePergunta}
                            </Label>
                            <Input id={`saude-${q.detalheCampo}`} {...register(saudeName(q.detalheCampo))} />
                          </div>
                        )}
                        {q.campo === "vacina_febre_amarela" && val === "Sim" && passageiro && (
                          <AnexoCertificado
                            expedicaoId={expedicaoId}
                            passageiroId={passageiro.id}
                            arquivoId={(watch(saudeName("vacina_febre_amarela_arquivo_id")) as unknown as string) ?? ""}
                            onChange={(id) =>
                              setValue(saudeName("vacina_febre_amarela_arquivo_id"), id as never, { shouldDirty: true })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
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

/** Anexar/ver/remover o Certificado de Vacinação (Febre Amarela). O id do arquivo
 *  fica em saude.vacina_febre_amarela_arquivo_id (salvo junto com o restante). */
function AnexoCertificado({
  expedicaoId,
  passageiroId,
  arquivoId,
  onChange,
}: {
  expedicaoId: string;
  passageiroId: string;
  arquivoId: string;
  onChange: (id: string) => void;
}) {
  const [anexando, setAnexando] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [previewErro, setPreviewErro] = React.useState(false);
  const previewUrl = arquivoId ? `/api/arquivos/${arquivoId}/download?inline=1` : null;

  async function anexar(file: File) {
    setAnexando(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expedicao_id", expedicaoId);
    fd.append("passageiro_id", passageiroId);
    fd.append("categoria", "Documentos pessoais");
    fd.append("descricao", "Certificado Internacional de Vacinação — Febre Amarela");
    let json: { ok: boolean; id?: string; error?: string };
    try {
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      json = await res.json();
    } catch {
      json = { ok: false, error: "Falha de rede no upload" };
    }
    setAnexando(false);
    if (!json.ok || !json.id) {
      toast.error("Erro ao anexar", { description: json.error });
      return;
    }
    onChange(json.id);
    toast.success("Certificado anexado — clique em Salvar para confirmar");
  }

  return (
    <>
      <div className="space-y-1 pt-1">
        <Label className="text-[11px] text-muted-foreground">Certificado da vacina (anexo)</Label>
        {arquivoId ? (
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <span className="flex-1 truncate text-[13px] text-vinculado-700">Certificado anexado</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewErro(false);
                setLightboxOpen(true);
              }}
            >
              Ver
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
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
                if (f) anexar(f);
                e.target.value = "";
              }}
            />
            {anexando ? "Anexando..." : "Anexar certificado"}
          </label>
        )}
      </div>

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
              Abrir certificado (PDF) em nova aba
            </a>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Certificado de vacinação (Febre Amarela)"
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
