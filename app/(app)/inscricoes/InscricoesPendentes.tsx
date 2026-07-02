"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Check, X, IdCard, MapPin, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import { aprovarInscricao, recusarInscricao, type InscricaoPendente } from "./actions";

export function InscricoesPendentes({ itens }: { itens: InscricaoPendente[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function aprovar(it: InscricaoPendente) {
    setBusy(it.id);
    const r = await aprovarInscricao(it.id);
    setBusy(null);
    if (r.ok) {
      toast.success(`${it.nome_completo} aprovado(a)`);
      router.refresh();
    } else toast.error("Erro ao aprovar", { description: r.error });
  }

  async function recusar(it: InscricaoPendente) {
    if (!confirm(`Recusar e apagar a inscrição de ${it.nome_completo}? Esta ação não pode ser desfeita.`)) return;
    setBusy(it.id);
    const r = await recusarInscricao(it.id);
    setBusy(null);
    if (r.ok) {
      toast.success("Inscrição recusada");
      router.refresh();
    } else toast.error("Erro ao recusar", { description: r.error });
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <UserPlus className="h-4 w-4 text-editavel-600" /> Inscrições pendentes
          {itens.length > 0 && <Badge variant="atencao">{itens.length}</Badge>}
        </h1>
        <p className="text-xs text-muted-foreground">
          Cadastros recebidos pelo formulário público, aguardando aprovação do operacional.
        </p>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-[13px] text-muted-foreground">
          Nenhuma inscrição pendente no momento.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {itens.map((it) => (
            <div key={it.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{it.nome_completo}</div>
                  <div className="text-[11px] text-muted-foreground">CPF {it.cpf ?? "—"} · {formatDate(it.created_at)}</div>
                </div>
                <Badge variant={it.tem_passaporte ? "vinculado" : "atencao"}>
                  <IdCard className="mr-0.5 h-3 w-3" /> {it.tem_passaporte ? "Passaporte" : "Sem anexo"}
                </Badge>
              </div>

              <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[12px]">
                <div className="font-medium">{it.expedicao_nome}</div>
                <div className="text-[11px] text-muted-foreground">
                  {it.destino}{it.data_embarque && ` · embarque ${formatDate(it.data_embarque)}`}
                </div>
              </div>

              <div className="space-y-0.5 text-[12px] text-muted-foreground">
                <div>{it.email ?? "—"} · {it.telefone ?? "—"}</div>
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {it.cidade ?? "—"}{it.estado ? `/${it.estado}` : ""}</div>
                {it.acompanhante_nome && (
                  <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Com {it.acompanhante_nome}</div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="brand" onClick={() => aprovar(it)} disabled={busy === it.id} className="flex-1">
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => recusar(it)} disabled={busy === it.id}>
                  <X className="h-3.5 w-3.5" /> Recusar
                </Button>
                {it.expedicao_id && (
                  <Link
                    href={`/expedicoes/${it.expedicao_id}/passageiros`}
                    className={cn("inline-flex h-8 items-center rounded-md border border-border px-2 text-[12px] hover:bg-accent")}
                    title="Ver na expedição"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
