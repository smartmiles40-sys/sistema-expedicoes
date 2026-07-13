"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, CalendarDays, Plane, Ticket, Info, MapPin, MegaphoneIcon, ImageIcon, X, Upload, BedDouble, ChevronRight, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { cn, formatDate } from "@/lib/utils";
import {
  criarItemPortal, atualizarItemPortal, excluirItemPortal,
  adicionarFotoRoteiro, excluirFotoRoteiro, definirVoucherHospedagem,
} from "./actions";
import type {
  RoteiroDiaRow, ExpedicaoVooRow, ExpedicaoPasseioRow, ExpedicaoInfoRow,
  ExpedicaoAvisoRow, RoteiroDiaFotoRow,
} from "@/types/database";

type Valor = string | number | boolean | null;
type Item = { id: string } & Record<string, Valor>;
type Campo = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "checkbox" | "select";
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  opcoes?: string[];
};

export function PortalEditor({
  expedicaoId, roteiro, voos, passeios, info, avisos, fotos, hospedagemVoucherArquivoId,
}: {
  expedicaoId: string;
  roteiro: RoteiroDiaRow[];
  voos: ExpedicaoVooRow[];
  passeios: ExpedicaoPasseioRow[];
  info: ExpedicaoInfoRow[];
  avisos: ExpedicaoAvisoRow[];
  fotos: RoteiroDiaFotoRow[];
  hospedagemVoucherArquivoId: string | null;
}) {
  const fotosPorDia = React.useMemo(() => {
    const m: Record<string, RoteiroDiaFotoRow[]> = {};
    for (const f of fotos) (m[f.roteiro_dia_id] ??= []).push(f);
    return m;
  }, [fotos]);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-base font-semibold">Portal do ExpedAmigo</h2>
        <p className="text-xs text-muted-foreground">
          O que você preencher aqui aparece para o passageiro em <span className="font-mono">/amigo</span>.
        </p>
      </div>

      <VoucherHospedagem expedicaoId={expedicaoId} arquivoId={hospedagemVoucherArquivoId} />

      <RoteiroInline expedicaoId={expedicaoId} dias={roteiro} fotosPorDia={fotosPorDia} />

      <Secao
        tabela="expedicao_voos"
        titulo="Voos de grupo"
        descricao="Voos da expedição (ida, volta, internos)."
        icone={<Plane className="h-4 w-4" />}
        expedicaoId={expedicaoId}
        itens={voos as unknown as Item[]}
        campos={[
          { key: "trecho", label: "Trecho", type: "text", required: true, placeholder: "Ida / Volta / Interno" },
          { key: "companhia", label: "Companhia", type: "text" },
          { key: "numero_voo", label: "Nº do voo", type: "text" },
          { key: "origem", label: "Origem", type: "text", placeholder: "São Paulo (GRU)" },
          { key: "destino", label: "Destino", type: "text", placeholder: "Lima (LIM)" },
          { key: "partida", label: "Partida", type: "text", placeholder: "12/08 23:50" },
          { key: "chegada", label: "Chegada", type: "text", placeholder: "13/08 03:10" },
          { key: "localizador", label: "Localizador", type: "text" },
          { key: "observacoes", label: "Observações", type: "textarea", full: true },
        ]}
        resumo={(r) => (
          <>
            <div className="text-[13px] font-medium">
              {String(r.trecho ?? "")}: {String(r.origem ?? "—")} → {String(r.destino ?? "—")}
              {r.arquivo_id ? <span className="text-vinculado-600"> · voucher ✓</span> : null}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {[r.companhia, r.numero_voo, r.partida].filter(Boolean).join(" · ") || "sem detalhes"}
            </div>
          </>
        )}
        extra={(item) =>
          item ? (
            <VoucherAnexo
              tabela="expedicao_voos"
              expedicaoId={expedicaoId}
              itemId={item.id}
              arquivoId={voos.find((v) => v.id === item.id)?.arquivo_id ?? null}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground">Salve o voo primeiro para anexar o voucher.</p>
          )
        }
      />

      <Secao
        tabela="expedicao_passeios"
        titulo="Passeios e ingressos"
        descricao="Atividades, passeios e entradas."
        icone={<Ticket className="h-4 w-4" />}
        expedicaoId={expedicaoId}
        itens={passeios as unknown as Item[]}
        campos={[
          { key: "nome", label: "Nome", type: "text", required: true, full: true },
          { key: "data", label: "Data", type: "date" },
          { key: "horario", label: "Horário", type: "text", placeholder: "06:00" },
          { key: "local", label: "Local", type: "text" },
          { key: "observacoes", label: "Observações", type: "textarea", full: true },
        ]}
        resumo={(r) => (
          <>
            <div className="text-[13px] font-medium">
              {String(r.nome ?? "")}
              {r.arquivo_id ? <span className="text-vinculado-600"> · voucher ✓</span> : null}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {[r.data ? formatDate(String(r.data)) : null, r.horario, r.local].filter(Boolean).join(" · ") || "sem detalhes"}
            </div>
          </>
        )}
        extra={(item) =>
          item ? (
            <VoucherAnexo
              tabela="expedicao_passeios"
              expedicaoId={expedicaoId}
              itemId={item.id}
              arquivoId={passeios.find((p) => p.id === item.id)?.arquivo_id ?? null}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground">Salve o passeio primeiro para anexar o voucher.</p>
          )
        }
      />

      <Secao
        tabela="expedicao_info"
        titulo="Informações do destino"
        descricao="Blocos de dicas: moeda, clima, tomadas, vistos…"
        icone={<Info className="h-4 w-4" />}
        expedicaoId={expedicaoId}
        itens={info as unknown as Item[]}
        campos={[
          { key: "titulo", label: "Título", type: "text", required: true, full: true, placeholder: "Moeda e câmbio" },
          { key: "conteudo", label: "Conteúdo", type: "textarea", required: true, full: true },
        ]}
        resumo={(r) => (
          <>
            <div className="text-[13px] font-medium inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" /> {String(r.titulo ?? "")}
              {(r.arquivo_id || r.arquivo_id_2) ? <span className="text-vinculado-600"> · PDF ✓</span> : null}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">{String(r.conteudo ?? "")}</div>
          </>
        )}
        extra={(item) => {
          if (!item) return <p className="text-[12px] text-muted-foreground">Salve a informação primeiro para anexar os arquivos.</p>;
          const b = info.find((x) => x.id === item.id);
          return (
            <div className="space-y-3">
              <VoucherAnexo
                tabela="expedicao_info" expedicaoId={expedicaoId} itemId={item.id} categoria="Outros"
                rotulo="PDF 1" campo="arquivo_id" arquivoId={b?.arquivo_id ?? null}
                labelCampo="arquivo_label" labelValor={b?.arquivo_label ?? null}
              />
              <VoucherAnexo
                tabela="expedicao_info" expedicaoId={expedicaoId} itemId={item.id} categoria="Outros"
                rotulo="PDF 2" campo="arquivo_id_2" arquivoId={b?.arquivo_id_2 ?? null}
                labelCampo="arquivo_label_2" labelValor={b?.arquivo_label_2 ?? null}
              />
            </div>
          );
        }}
      />

      <Secao
        tabela="expedicao_avisos"
        titulo="Avisos e boas práticas"
        descricao="Substitui o PDF: avisos, boas práticas e dicas da viagem."
        icone={<MegaphoneIcon className="h-4 w-4" />}
        expedicaoId={expedicaoId}
        itens={avisos as unknown as Item[]}
        campos={[
          { key: "tipo", label: "Tipo", type: "select", opcoes: ["Aviso", "Boa prática", "Dica"] },
          { key: "titulo", label: "Título", type: "text", required: true, full: true },
          { key: "conteudo", label: "Conteúdo", type: "textarea", required: true, full: true },
        ]}
        resumo={(r) => (
          <>
            <div className="text-[13px] font-medium">
              <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px]">{String(r.tipo ?? "Aviso")}</span>
              {String(r.titulo ?? "")}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">{String(r.conteudo ?? "")}</div>
          </>
        )}
      />
    </div>
  );
}

function Secao({
  tabela, titulo, descricao, icone, expedicaoId, itens, campos, resumo, extra,
}: {
  tabela: string;
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  expedicaoId: string;
  itens: Item[];
  campos: Campo[];
  resumo: (item: Item) => React.ReactNode;
  extra?: (item: Item | null) => React.ReactNode;
}) {
  const [novo, setNovo] = React.useState(false);
  const [editando, setEditando] = React.useState<Item | null>(null);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">{icone}</span>
          <div>
            <h3 className="text-sm font-semibold leading-none">{titulo}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{descricao}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setNovo(true)}>
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>

      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-[12px] text-muted-foreground">
          Nada cadastrado ainda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0 flex-1">{resumo(item)}</div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditando(item)}
                  aria-label="Editar"
                  title="Editar"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <ConfirmDeleteButton
                  ariaLabel="Excluir item"
                  title="Excluir este item?"
                  description="Esta ação não pode ser desfeita."
                  successMessage="Item excluído"
                  onConfirm={() => excluirItemPortal(tabela, item.id, expedicaoId)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(novo || editando) && (
        <ItemDrawer
          tabela={tabela}
          titulo={titulo}
          expedicaoId={expedicaoId}
          campos={campos}
          item={editando}
          extra={extra}
          onClose={() => { setNovo(false); setEditando(null); }}
        />
      )}
    </section>
  );
}

function ItemDrawer({
  tabela, titulo, expedicaoId, campos, item, extra, onClose,
}: {
  tabela: string;
  titulo: string;
  expedicaoId: string;
  campos: Campo[];
  item: Item | null;
  extra?: (item: Item | null) => React.ReactNode;
  onClose: () => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = React.useState(false);
  const [valores, setValores] = React.useState<Record<string, Valor>>(() => {
    const v: Record<string, Valor> = {};
    for (const c of campos) {
      const atual = item?.[c.key];
      if (c.type === "checkbox") v[c.key] = atual == null ? c.key === "incluso" : Boolean(atual);
      else if (c.type === "date") v[c.key] = atual ? String(atual).slice(0, 10) : "";
      else if (c.type === "select") v[c.key] = atual == null ? (c.opcoes?.[0] ?? "") : String(atual);
      else v[c.key] = atual == null ? "" : String(atual);
    }
    return v;
  });

  function set(key: string, val: Valor) {
    setValores((s) => ({ ...s, [key]: val }));
  }

  async function salvar() {
    // Validação simples dos obrigatórios.
    for (const c of campos) {
      if (c.required && !String(valores[c.key] ?? "").trim()) {
        toast.error(`Preencha: ${c.label}`);
        return;
      }
    }
    // Normaliza: "" → null; number → Number; date mantém yyyy-mm-dd.
    const payload: Record<string, Valor> = {};
    for (const c of campos) {
      const raw = valores[c.key];
      if (c.type === "checkbox") payload[c.key] = Boolean(raw);
      else if (c.type === "number") payload[c.key] = raw === "" || raw == null ? null : Number(raw);
      else payload[c.key] = raw === "" ? null : raw;
    }

    setSalvando(true);
    const r = item
      ? await atualizarItemPortal(tabela, item.id, expedicaoId, payload)
      : await criarItemPortal(tabela, expedicaoId, payload);
    setSalvando(false);

    if (r.ok) {
      toast.success(item ? "Atualizado" : "Adicionado");
      onClose();
      router.refresh();
    } else {
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{item ? "Editar" : "Adicionar"} — {titulo}</DrawerTitle>
          <DrawerDescription>Estas informações ficam visíveis para o passageiro.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {campos.map((c) => (
              <div key={c.key} className={c.full || c.type === "textarea" || c.type === "checkbox" ? "col-span-2 space-y-1" : "space-y-1"}>
                {c.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-[13px] font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(valores[c.key])}
                      onChange={(e) => set(c.key, e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    {c.label}
                  </label>
                ) : (
                  <>
                    <Label>{c.label}{c.required && " *"}</Label>
                    {c.type === "textarea" ? (
                      <textarea
                        value={String(valores[c.key] ?? "")}
                        onChange={(e) => set(c.key, e.target.value)}
                        placeholder={c.placeholder}
                        rows={4}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
                      />
                    ) : c.type === "select" ? (
                      <select
                        value={String(valores[c.key] ?? "")}
                        onChange={(e) => set(c.key, e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600"
                      >
                        {(c.opcoes ?? []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                        value={String(valores[c.key] ?? "")}
                        onChange={(e) => set(c.key, e.target.value)}
                        placeholder={c.placeholder}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {extra && (
            <div className="border-t border-border pt-3">{extra(item)}</div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Gerenciador de fotos de um dia do roteiro (upload + grade + excluir). */
function FotosRoteiro({
  expedicaoId, roteiroDiaId, fotos,
}: {
  expedicaoId: string;
  roteiroDiaId: string;
  fotos: RoteiroDiaFotoRow[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function enviar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviando(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("expedicao_id", expedicaoId);
        fd.append("categoria", "Outros");
        fd.append("descricao", "Foto roteiro");
        const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!json.ok) { toast.error("Falha no upload", { description: json.error }); continue; }
        const r = await adicionarFotoRoteiro(expedicaoId, roteiroDiaId, json.id, null);
        if (!r.ok) toast.error("Falha ao salvar foto", { description: r.error });
      }
      toast.success("Fotos atualizadas");
      router.refresh();
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover(fotoId: string, arquivoId: string) {
    const r = await excluirFotoRoteiro(fotoId, arquivoId, expedicaoId);
    if (r.ok) { toast.success("Foto removida"); router.refresh(); }
    else toast.error("Erro ao remover", { description: r.error });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
          <ImageIcon className="h-3.5 w-3.5" /> Fotos do dia
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={enviando}>
          <Upload className="h-3 w-3" /> {enviando ? "Enviando…" : "Enviar fotos"}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => enviar(e.target.files)} />
      </div>
      {fotos.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhuma foto ainda.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/arquivos/${f.arquivo_id}/download?inline=1`}
                alt={f.legenda ?? "Foto do roteiro"}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remover(f.id, f.arquivo_id)}
                aria-label="Remover foto"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editor INLINE do roteiro dia a dia — edita direto na tela, salva ao sair do campo. */
function RoteiroInline({
  expedicaoId, dias, fotosPorDia,
}: {
  expedicaoId: string;
  dias: RoteiroDiaRow[];
  fotosPorDia: Record<string, RoteiroDiaFotoRow[]>;
}) {
  const router = useRouter();
  const [addBusy, setAddBusy] = React.useState(false);
  const [abertos, setAbertos] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // "Adicionar dia" já numera e data sozinho, continuando a sequência.
  async function adicionar(base?: RoteiroDiaRow) {
    setAddBusy(true);
    const maxDia = dias.reduce((m, d) => Math.max(m, d.dia ?? 0), 0);
    const ultimaData = dias.map((d) => d.data).filter(Boolean).sort().pop() ?? null;
    let proxData: string | null = base?.data ?? null;
    if (!base && ultimaData) {
      const dt = new Date(`${ultimaData}T00:00:00`);
      dt.setDate(dt.getDate() + 1);
      proxData = dt.toISOString().slice(0, 10);
    }
    const payload = base
      ? { dia: maxDia + 1, data: base.data, titulo: base.titulo, cidade: base.cidade, refeicoes: base.refeicoes, hospedagem: base.hospedagem, descricao: base.descricao }
      : { dia: maxDia + 1, data: proxData, titulo: `Dia ${maxDia + 1}`, cidade: null, refeicoes: null, hospedagem: null, descricao: null };
    const r = await criarItemPortal("roteiro_dias", expedicaoId, payload);
    setAddBusy(false);
    if (r.ok) { setAbertos((s) => new Set(s).add(r.id)); router.refresh(); }
    else toast.error("Erro ao adicionar", { description: r.error });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground"><CalendarDays className="h-4 w-4" /></span>
          <div>
            <h3 className="text-sm font-semibold leading-none">Roteiro dia a dia</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Clique num dia pra editar aqui mesmo — salva sozinho ao sair do campo.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => adicionar()} disabled={addBusy}>
          <Plus className="h-3 w-3" /> {addBusy ? "Adicionando…" : "Adicionar dia"}
        </Button>
      </div>

      {dias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-[12px] text-muted-foreground">
          Nenhum dia ainda. Clique em “Adicionar dia”.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {dias.map((d) => (
            <DiaInline
              key={d.id}
              expedicaoId={expedicaoId}
              dia={d}
              fotos={fotosPorDia[d.id] ?? []}
              aberto={abertos.has(d.id)}
              onToggle={() => toggle(d.id)}
              onDuplicar={() => adicionar(d)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DiaInline({
  expedicaoId, dia, fotos, aberto, onToggle, onDuplicar,
}: {
  expedicaoId: string;
  dia: RoteiroDiaRow;
  fotos: RoteiroDiaFotoRow[];
  aberto: boolean;
  onToggle: () => void;
  onDuplicar: () => void;
}) {
  const router = useRouter();
  const [v, setV] = React.useState(() => ({
    dia: String(dia.dia ?? ""),
    data: dia.data ? String(dia.data).slice(0, 10) : "",
    titulo: dia.titulo ?? "",
    cidade: dia.cidade ?? "",
    refeicoes: dia.refeicoes ?? "",
    hospedagem: dia.hospedagem ?? "",
    descricao: dia.descricao ?? "",
  }));
  const salvoRef = React.useRef({ ...v });
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");

  const onCampo = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function salvar(k: keyof typeof v) {
    if (v[k] === salvoRef.current[k]) return; // nada mudou
    const payload: Record<string, string | number | null> =
      k === "dia"
        ? { dia: v.dia.trim() === "" ? 1 : parseInt(v.dia, 10) || 1 }
        : { [k]: v[k].trim() === "" ? null : v[k] };
    setStatus("saving");
    const r = await atualizarItemPortal("roteiro_dias", dia.id, expedicaoId, payload);
    if (r.ok) {
      salvoRef.current = { ...salvoRef.current, [k]: v[k] };
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1300);
    } else {
      setStatus("idle");
      toast.error("Erro ao salvar", { description: r.error });
    }
  }

  const nFotos = fotos.length;

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="flex h-6 min-w-[2.1rem] items-center justify-center rounded bg-[var(--brand-dark)] px-1 text-[11px] font-bold text-white">D{v.dia || "?"}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{v.titulo || "—"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {v.data ? formatDate(v.data) : "sem data"}{v.cidade ? ` · ${v.cidade}` : ""}{nFotos ? ` · ${nFotos} foto${nFotos === 1 ? "" : "s"}` : ""}
            </span>
          </span>
        </button>
        {status !== "idle" && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            {status === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-vinculado-600" />}
            {status === "saving" ? "salvando" : "salvo"}
          </span>
        )}
        <button type="button" onClick={onDuplicar} title="Duplicar dia" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
        <ConfirmDeleteButton
          ariaLabel="Excluir dia"
          title="Excluir este dia?"
          description="Esta ação não pode ser desfeita."
          successMessage="Dia excluído"
          onConfirm={() => excluirItemPortal("roteiro_dias", dia.id, expedicaoId)}
        />
        <button type="button" onClick={onToggle} aria-label="Abrir/fechar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", aberto && "rotate-90")} /></button>
      </div>

      {aberto && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="grid grid-cols-[76px_1fr] gap-2">
            <div className="space-y-1"><Label>Dia</Label><Input inputMode="numeric" value={v.dia} onChange={onCampo("dia")} onBlur={() => salvar("dia")} /></div>
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={v.data} onChange={onCampo("data")} onBlur={() => salvar("data")} /></div>
          </div>
          <div className="space-y-1"><Label>Título</Label><Input value={v.titulo} onChange={onCampo("titulo")} onBlur={() => salvar("titulo")} placeholder="Ex.: Chegada em Cusco" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Cidade</Label><Input value={v.cidade} onChange={onCampo("cidade")} onBlur={() => salvar("cidade")} /></div>
            <div className="space-y-1"><Label>Refeições</Label><Input value={v.refeicoes} onChange={onCampo("refeicoes")} onBlur={() => salvar("refeicoes")} placeholder="Café, Almoço" /></div>
          </div>
          <div className="space-y-1"><Label>Hospedagem</Label><Input value={v.hospedagem} onChange={onCampo("hospedagem")} onBlur={() => salvar("hospedagem")} /></div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <textarea value={v.descricao} onChange={onCampo("descricao")} onBlur={() => salvar("descricao")} rows={4}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-editavel-600" />
          </div>
          <div className="border-t border-border pt-3">
            <FotosRoteiro expedicaoId={expedicaoId} roteiroDiaId={dia.id} fotos={fotos} />
          </div>
          <p className="text-[11px] text-muted-foreground">As mudanças salvam sozinhas ao sair de cada campo.</p>
        </div>
      )}
    </li>
  );
}

/** Voucher ÚNICO da hospedagem (nível da expedição) — mesmo hotel p/ todos. */
function VoucherHospedagem({ expedicaoId, arquivoId }: { expedicaoId: string; arquivoId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function enviar(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("expedicao_id", expedicaoId);
      fd.append("categoria", "Vouchers");
      fd.append("descricao", "Voucher hospedagem");
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { toast.error("Falha no upload", { description: json.error }); return; }
      const r = await definirVoucherHospedagem(expedicaoId, json.id);
      if (!r.ok) { toast.error("Falha ao salvar", { description: r.error }); return; }
      toast.success("Voucher da hospedagem anexado");
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    if (!arquivoId) return;
    setBusy(true);
    try {
      const r = await definirVoucherHospedagem(expedicaoId, null);
      if (!r.ok) { toast.error("Falha ao remover", { description: r.error }); return; }
      await fetch(`/api/arquivos/${arquivoId}`, { method: "DELETE" }).catch(() => {});
      toast.success("Voucher removido");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground"><BedDouble className="h-4 w-4" /></span>
        <div>
          <h3 className="text-sm font-semibold leading-none">Voucher da hospedagem</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Um arquivo só, vale para todos os passageiros (mesmo hotel).</p>
        </div>
      </div>
      {arquivoId ? (
        <div className="flex items-center gap-2 rounded-lg border border-vinculado-600/30 bg-vinculado-50 p-2">
          <span className="flex-1 text-[13px] font-semibold text-vinculado-600">✓ Voucher anexado</span>
          <a href={`/api/arquivos/${arquivoId}/download?inline=1`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-editavel-700 hover:underline">Ver</a>
          <button type="button" onClick={remover} disabled={busy} className="text-[12px] font-medium text-critico-600 hover:underline">Remover</button>
        </div>
      ) : (
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-3 w-3" /> {busy ? "Enviando…" : "Anexar voucher (PDF/foto)"}
          </Button>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => enviar(e.target.files?.[0] ?? null)} />
        </>
      )}
    </section>
  );
}

/** Anexo de UM voucher (foto/PDF) para um item de voo ou passeio. */
function VoucherAnexo({
  tabela, expedicaoId, itemId, arquivoId, rotulo = "Voucher", categoria = "Vouchers",
  campo = "arquivo_id", labelCampo, labelValor,
}: {
  tabela: string;
  expedicaoId: string;
  itemId: string;
  arquivoId: string | null;
  rotulo?: string;
  categoria?: string;
  /** Coluna de arquivo a gravar (default arquivo_id; ex.: arquivo_id_2). */
  campo?: string;
  /** Se definido, mostra um campo pra personalizar o NOME do link (coluna de texto). */
  labelCampo?: string;
  labelValor?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function enviar(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("expedicao_id", expedicaoId);
      fd.append("categoria", categoria);
      fd.append("descricao", rotulo);
      const res = await fetch("/api/arquivos/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { toast.error("Falha no upload", { description: json.error }); return; }
      const r = await atualizarItemPortal(tabela, itemId, expedicaoId, { [campo]: json.id });
      if (!r.ok) { toast.error("Falha ao salvar", { description: r.error }); return; }
      toast.success(`${rotulo} anexado`);
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    if (!arquivoId) return;
    setBusy(true);
    try {
      const r = await atualizarItemPortal(tabela, itemId, expedicaoId, { [campo]: null });
      if (!r.ok) { toast.error("Falha ao remover", { description: r.error }); return; }
      await fetch(`/api/arquivos/${arquivoId}`, { method: "DELETE" }).catch(() => {});
      toast.success(`${rotulo} removido`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function salvarLabel(valor: string) {
    if (!labelCampo) return;
    await atualizarItemPortal(tabela, itemId, expedicaoId, { [labelCampo]: valor.trim() || null });
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-semibold">{rotulo} (1 arquivo)</div>
      {arquivoId ? (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-vinculado-600/30 bg-vinculado-50 p-2">
            <span className="flex-1 text-[13px] font-semibold text-vinculado-600">✓ Anexado</span>
            <a
              href={`/api/arquivos/${arquivoId}/download?inline=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-editavel-700 hover:underline"
            >
              Ver
            </a>
            <button type="button" onClick={remover} disabled={busy} className="text-[12px] font-medium text-critico-600 hover:underline">
              Remover
            </button>
          </div>
          {labelCampo && (
            <input
              type="text"
              defaultValue={labelValor ?? ""}
              placeholder='Nome do link (ex.: "Baixar visto")'
              onBlur={(e) => salvarLabel(e.target.value)}
              className="w-full rounded-lg border border-border px-2 py-1 text-[12px]"
            />
          )}
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="h-3 w-3" /> {busy ? "Enviando…" : `Anexar ${rotulo.toLowerCase()}`}
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => enviar(e.target.files?.[0] ?? null)} />
      <p className="text-[11px] text-muted-foreground">Imagem ou PDF — fica disponível para o passageiro baixar.</p>
    </div>
  );
}
