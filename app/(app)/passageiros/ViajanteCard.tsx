import { Trophy, Plane } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { nivelFidelidade } from "@/lib/fidelidade";
import type { PessoaAgregada } from "@/lib/data/pessoas";

/**
 * Card de "membro do clube de viajantes": nível em destaque + barra de progresso
 * até o próximo marco (3ª/5ª/10ª viagem) + selos conquistados. Inspirado na
 * clareza de clubes de fidelidade, com a marca da agência.
 */
export function ViajanteCard({ pessoa, onOpen }: { pessoa: PessoaAgregada; onOpen: () => void }) {
  const n = pessoa.totalExpedicoes;
  const { tier, conquistados, proximo, faltam, progresso } = nivelFidelidade(n);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* topo: avatar + nome + nível + nº de viagens */}
      <div className="bg-brand-gradient flex items-center gap-3 px-4 py-3 text-white">
        <Avatar nome={pessoa.nome_completo} size={44} className="shrink-0 ring-2 ring-white/20" src={pessoa.foto_arquivo_id ? `/api/arquivos/${pessoa.foto_arquivo_id}/download?inline=1` : undefined} />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-[16px] font-semibold leading-tight">
            {pessoa.nome_completo}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-lime)]">
            {tier}
          </div>
        </div>
        <div className="shrink-0 text-center">
          <div className="text-[24px] font-bold leading-none tabular-nums">{n}</div>
          <div className="text-[9px] uppercase tracking-wide text-white/60">
            {n === 1 ? "viagem" : "viagens"}
          </div>
        </div>
      </div>

      {/* corpo: progresso + selos */}
      <div className="space-y-2.5 px-4 py-3">
        {proximo != null ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Próximo marco: <strong className="text-foreground">{proximo}ª viagem</strong>
              </span>
              <span className="font-semibold text-[var(--brand-dark)]">
                faltam {faltam}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--brand-lime-deep)] transition-all"
                style={{ width: `${Math.round(progresso * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--brand-dark)]">
            <Trophy className="h-4 w-4" /> Lenda — 10+ viagens com a gente 🏆
          </div>
        )}

        {conquistados.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {conquistados.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-lime)]/25 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-dark)] ring-1 ring-[var(--brand-lime)]/50"
              >
                ★ {m}ª
              </span>
            ))}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Plane className="h-3 w-3" /> {n === 0 ? "Ainda sem viagens" : "Caminho para o 1º marco"}
          </div>
        )}

        {(pessoa.cpf || pessoa.telefone) && (
          <div className="flex items-center gap-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
            {pessoa.cpf && <span className="font-mono">{pessoa.cpf}</span>}
            {pessoa.telefone && <span className="truncate">{pessoa.telefone}</span>}
          </div>
        )}
      </div>
    </button>
  );
}
