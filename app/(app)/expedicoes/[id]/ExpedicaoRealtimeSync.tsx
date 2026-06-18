"use client";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

/**
 * Componente client invisível que mora no layout da expedição.
 * Escuta tudo que afeta o header/visão-geral (KPIs agregados) e
 * dispara router.refresh() — isso recarrega o Server Component do
 * layout E da página atual, mantendo header e conteúdo sincronizados.
 *
 * As abas internas (custos, pagamentos, etc) têm seus próprios hooks
 * com filtros mais granulares + LiveBadge local. Os debounces evitam
 * refresh duplicado quando vários eventos chegam em rajada.
 */
export function ExpedicaoRealtimeSync({ expedicaoId }: { expedicaoId: string }) {
  useRealtimeRefresh({
    debounceMs: 400,
    subscriptions: [
      { table: "expedicoes" /* sem filtro: queremos saber se ESTA foi alterada/deletada */ },
      { table: "passageiros", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "quartos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "checklist_itens", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "passageiro_requisitos" },
      { table: "arquivos", filter: `expedicao_id=eq.${expedicaoId}` },
      { table: "links_expedicao", filter: `expedicao_id=eq.${expedicaoId}` },
      // documentos não tem expedicao_id direto — over-trigger aceitável (raros)
      { table: "documentos" },
    ],
  });
  return null;
}
