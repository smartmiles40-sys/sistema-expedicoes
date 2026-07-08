"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn, formatDate } from "@/lib/utils";
import type { RoteiroLiderDiaRow } from "@/types/database";
import { criarDiaLider, atualizarDiaLider, excluirDiaLider } from "./actions";

const NIVEIS = ["", "Crítico", "Atenção", "Verificar"];
const EMOJI: Record<string, string> = { "Crítico": "🔴", "Atenção": "🟠", "Verificar": "🟡" };

type Form = {
  dia: string; data: string; fase: string; local: string; programacao: string;
  lideres_ativos: string; pax: string; observacoes: string;
  alerta_nivel: string; alerta_texto: string; alerta_acao: string; alerta_responsavel: string;
};
const vazio = (): Form => ({
  dia: "", data: "", fase: "", local: "", programacao: "", lideres_ativos: "", pax: "",
  observacoes: "", alerta_nivel: "", alerta_texto: "", alerta_acao: "", alerta_responsavel: "",
});
const doRow = (d: RoteiroLiderDiaRow): Form => ({
  dia: String(d.dia ?? ""), data: d.data ?? "", fase: d.fase ?? "", local: d.local ?? "",
  programacao: d.programacao ?? "", lideres_ativos: d.lideres_ativos ?? "", pax: d.pax ?? "",
  observacoes: d.observacoes ?? "", alerta_nivel: d.alerta_nivel ?? "", alerta_texto: d.alerta_texto ?? "",
  alerta_acao: d.alerta_acao ?? "", alerta_responsavel: d.alerta_responsavel ?? "",
});

export function RoteiroLiderEditor({ expedicaoId, dias }: { expedicaoId: string; dias: RoteiroLiderDiaRow[] }) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<RoteiroLiderDiaRow | null>(null);
  const [criando, setCriando] = React.useState(false);

  async function excluir(d: RoteiroLiderDiaRow) {
    if (!window.confirm(`Excluir o Dia ${d.dia}?`)) return;
    const r = await excluirDiaLider(d.id, expedicaoId);
    if (!r.ok) return toast.error("Falha ao excluir", { description: r.error });
    toast.success("Dia excluído");
    router.refresh();
  }

  const aberto = criando || editando !== null;
  const fechar = () => { setCriando(false); setEditando(null); };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Roteiro do Líder</h2>
          <p className="page-subtitle mt-1">Resumo operacional dia a dia — o que a equipe traduz pro líder. Aparece na Área do Líder.</p>
        </div>
        <Button variant="brand" onClick={() => { setEditando(null); setCriando(true); }}>
          <Plus className="h-4 w-4" /> Adicionar dia
        </Button>
      </div>

      {dias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 opacity-50" />
          Nenhum dia cadastrado ainda. Clique em “Adicionar dia”.
        </div>
      ) : (
        <div className="space-y-1.5">
          {dias.map((d) => (
            <div key={d.id} className="group flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex w-10 shrink-0 flex-col items-center rounded-md bg-[var(--brand-dark)] py-1 text-white">
                <span className="text-[8px] font-bold uppercase text-[var(--brand-lime)]">Dia</span>
                <span className="font-display text-[15px] font-bold leading-tight">{d.dia}</span>
              </div>
              <div className="min-w-0 flex-1">
                {d.fase && <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{d.fase}</div>}
                <div className="text-[13px] font-medium leading-snug">{d.programacao ?? "—"}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                  {d.data && <span>{formatDate(d.data)}</span>}
                  {d.local && <span>{d.local}</span>}
                  {d.lideres_ativos && <span>👤 {d.lideres_ativos}</span>}
                  {d.pax && <span>{d.pax} pax</span>}
                  {d.alerta_nivel && <span>{EMOJI[d.alerta_nivel]} {d.alerta_nivel}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => { setCriando(false); setEditando(d); }} title="Editar" className="rounded-md p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => excluir(d)} title="Excluir" className="rounded-md p-1.5 text-critico-600 hover:bg-critico-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {aberto && (
        <DrawerForm
          expedicaoId={expedicaoId}
          registro={editando}
          onClose={fechar}
          onSaved={() => { fechar(); router.refresh(); }}
        />
      )}
    </div>
  );
}

function DrawerForm({ expedicaoId, registro, onClose, onSaved }: {
  expedicaoId: string; registro: RoteiroLiderDiaRow | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = React.useState<Form>(registro ? doRow(registro) : vazio());
  const [salvando, setSalvando] = React.useState(false);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    if (!form.programacao.trim() && !form.dia.trim()) {
      toast.error("Preencha ao menos o dia e a programação");
      return;
    }
    setSalvando(true);
    const nn = (s: string) => (s.trim() === "" ? null : s.trim());
    const valores: Record<string, string | number | null> = {
      dia: form.dia.trim() === "" ? 1 : parseInt(form.dia, 10) || 1,
      data: nn(form.data), fase: nn(form.fase), local: nn(form.local), programacao: nn(form.programacao),
      lideres_ativos: nn(form.lideres_ativos), pax: nn(form.pax), observacoes: nn(form.observacoes),
      alerta_nivel: nn(form.alerta_nivel), alerta_texto: nn(form.alerta_texto),
      alerta_acao: nn(form.alerta_acao), alerta_responsavel: nn(form.alerta_responsavel),
    };
    const r = registro
      ? await atualizarDiaLider(registro.id, expedicaoId, valores)
      : await criarDiaLider(expedicaoId, valores);
    setSalvando(false);
    if (!r.ok) return toast.error("Falha ao salvar", { description: r.error });
    toast.success(registro ? "Dia atualizado" : "Dia adicionado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[15px] font-semibold">{registro ? `Editar Dia ${registro.dia}` : "Novo dia"}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Dia"><Input value={form.dia} onChange={(e) => set("dia", e.target.value)} inputMode="numeric" placeholder="1" /></Campo>
            <Campo label="Data"><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></Campo>
          </div>
          <Campo label="Fase / região"><Input value={form.fase} onChange={(e) => set("fase", e.target.value)} placeholder="TÓQUIO" /></Campo>
          <Campo label="Programação"><Area value={form.programacao} onChange={(v) => set("programacao", v)} placeholder="O que o grupo faz no dia" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Local"><Input value={form.local} onChange={(e) => set("local", e.target.value)} placeholder="Cidade" /></Campo>
            <Campo label="Pax"><Input value={form.pax} onChange={(e) => set("pax", e.target.value)} placeholder="24" /></Campo>
          </div>
          <Campo label="Líderes ativos" hint="separe por ·"><Input value={form.lideres_ativos} onChange={(e) => set("lideres_ativos", e.target.value)} placeholder="Everton · Jacqueline · Beatriz" /></Campo>
          <Campo label="Observações"><Area value={form.observacoes} onChange={(v) => set("observacoes", v)} /></Campo>

          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-[12px] font-semibold">Alerta operacional (opcional)</div>
            <Campo label="Nível">
              <select value={form.alerta_nivel} onChange={(e) => set("alerta_nivel", e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]">
                {NIVEIS.map((n) => <option key={n} value={n}>{n === "" ? "— sem alerta —" : `${EMOJI[n]} ${n}`}</option>)}
              </select>
            </Campo>
            {form.alerta_nivel && (
              <div className="mt-2 space-y-2">
                <Campo label="Descrição do alerta"><Area value={form.alerta_texto} onChange={(v) => set("alerta_texto", v)} /></Campo>
                <Campo label="Ação necessária"><Area value={form.alerta_acao} onChange={(v) => set("alerta_acao", v)} /></Campo>
                <Campo label="Responsável"><Input value={form.alerta_responsavel} onChange={(e) => set("alerta_responsavel", e.target.value)} placeholder="Operações + DMC" /></Campo>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[13px] font-medium hover:bg-muted">Cancelar</button>
          <Button variant="brand" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
        {label}{hint && <span className="ml-1 font-normal opacity-70">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}
function Area({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className={cn("w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] leading-snug")}
    />
  );
}
