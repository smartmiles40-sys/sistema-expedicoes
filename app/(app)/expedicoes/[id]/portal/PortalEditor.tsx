"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, CalendarDays, Plane, Ticket, Info, MapPin, MegaphoneIcon, ImageIcon, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { formatDate } from "@/lib/utils";
import {
  criarItemPortal, atualizarItemPortal, excluirItemPortal,
  adicionarFotoRoteiro, excluirFotoRoteiro,
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
  expedicaoId, roteiro, voos, passeios, info, avisos, fotos,
}: {
  expedicaoId: string;
  roteiro: RoteiroDiaRow[];
  voos: ExpedicaoVooRow[];
  passeios: ExpedicaoPasseioRow[];
  info: ExpedicaoInfoRow[];
  avisos: ExpedicaoAvisoRow[];
  fotos: RoteiroDiaFotoRow[];
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

      <Secao
        tabela="roteiro_dias"
        titulo="Roteiro dia a dia"
        descricao="Cada dia da viagem (com fotos)."
        icone={<CalendarDays className="h-4 w-4" />}
        expedicaoId={expedicaoId}
        itens={roteiro as unknown as Item[]}
        campos={[
          { key: "dia", label: "Dia (nº)", type: "number" },
          { key: "data", label: "Data", type: "date" },
          { key: "titulo", label: "Título", type: "text", required: true, full: true },
          { key: "cidade", label: "Cidade", type: "text" },
          { key: "refeicoes", label: "Refeições", type: "text", placeholder: "Café, Almoço" },
          { key: "hospedagem", label: "Hospedagem", type: "text" },
          { key: "descricao", label: "Descrição", type: "textarea", full: true },
        ]}
        resumo={(r) => {
          const n = fotosPorDia[r.id]?.length ?? 0;
          return (
            <>
              <div className="text-[13px] font-medium">
                Dia {String(r.dia ?? "")} · {String(r.titulo ?? "")}
                {r.cidade ? <span className="text-muted-foreground"> — {String(r.cidade)}</span> : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {r.data ? formatDate(String(r.data)) : "sem data"}
                {r.refeicoes ? ` · ${String(r.refeicoes)}` : ""}
                {n > 0 ? ` · ${n} foto${n === 1 ? "" : "s"}` : ""}
              </div>
            </>
          );
        }}
        extra={(item) =>
          item ? (
            <FotosRoteiro
              expedicaoId={expedicaoId}
              roteiroDiaId={item.id}
              fotos={fotosPorDia[item.id] ?? []}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground">
              Salve o dia primeiro para poder anexar fotos.
            </p>
          )
        }
      />

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
            </div>
            <div className="text-[11px] text-muted-foreground">
              {[r.companhia, r.numero_voo, r.partida].filter(Boolean).join(" · ") || "sem detalhes"}
            </div>
          </>
        )}
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
          { key: "incluso", label: "Incluso no pacote", type: "checkbox" },
          { key: "observacoes", label: "Observações", type: "textarea", full: true },
        ]}
        resumo={(r) => (
          <>
            <div className="text-[13px] font-medium">
              {String(r.nome ?? "")}
              <span className={r.incluso ? "text-vinculado-600" : "text-atencao-600"}>
                {" "}· {r.incluso ? "incluso" : "opcional"}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {[r.data ? formatDate(String(r.data)) : null, r.horario, r.local].filter(Boolean).join(" · ") || "sem detalhes"}
            </div>
          </>
        )}
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
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">{String(r.conteudo ?? "")}</div>
          </>
        )}
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
