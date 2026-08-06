"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { mudarExpedicaoPassageiro } from "@/app/(app)/expedicoes/actions";
import { listExpedicoesResumo, type ExpedicaoResumo } from "./mudar-expedicao-actions";

/**
 * "Mudar de expedição": corrige quando a pessoa se inscreveu na expedição errada,
 * MOVENDO o passageiro (com todos os dados) em vez de excluir e recadastrar — o que
 * perderia saúde/perfil/passaporte. Só editores (o drawer esconde pra somente-leitura).
 */
export function MudarExpedicao({
  passageiroId,
  expedicaoAtualId,
  onMudou,
}: {
  passageiroId: string;
  expedicaoAtualId: string;
  onMudou: () => void;
}) {
  const router = useRouter();
  const [abrir, setAbrir] = React.useState(false);
  const [exps, setExps] = React.useState<ExpedicaoResumo[] | null>(null);
  const [alvo, setAlvo] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    if (abrir && exps === null) listExpedicoesResumo().then(setExps).catch(() => setExps([]));
  }, [abrir, exps]);

  async function mover() {
    if (!alvo) return;
    setSalvando(true);
    const r = await mudarExpedicaoPassageiro(passageiroId, alvo);
    setSalvando(false);
    if (r.ok) {
      toast.success("Passageiro movido de expedição — dados preservados");
      onMudou();
      router.refresh();
    } else {
      toast.error("Não foi possível mover", { description: r.error });
    }
  }

  if (!abrir) {
    return (
      <button
        type="button"
        onClick={() => setAbrir(true)}
        className="inline-flex items-center gap-1.5 text-[12px] text-editavel-700 hover:underline"
        title="Corrigir a expedição sem perder os dados"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" /> Mudar de expedição
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {exps === null ? (
        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> carregando…</span>
      ) : (
        <select
          value={alvo}
          onChange={(e) => setAlvo(e.target.value)}
          className="max-w-[240px] rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-editavel-600"
        >
          <option value="">Mover para…</option>
          {exps.filter((e) => e.id !== expedicaoAtualId).map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}{e.data_embarque ? ` · ${formatDate(e.data_embarque)}` : ""}
            </option>
          ))}
        </select>
      )}
      <Button size="sm" variant="outline" disabled={!alvo || salvando} onClick={mover}>
        {salvando ? "Movendo…" : "Mover"}
      </Button>
      <button type="button" onClick={() => setAbrir(false)} className="text-[12px] text-muted-foreground hover:text-foreground">
        Cancelar
      </button>
    </div>
  );
}
