"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";

export type RealtimeStatus = "idle" | "connecting" | "live" | "error" | "offline";

export interface RealtimeSubscription {
  /** Nome da tabela no schema `public`. */
  table: string;
  /**
   * Filtro server-side. Apenas igualdade simples é suportada pelo Realtime.
   * Ex: `expedicao_id=eq.${id}`. Se omitido, escuta TODA a tabela.
   */
  filter?: string;
  /** Eventos a escutar. Default: todos. */
  events?: Array<"INSERT" | "UPDATE" | "DELETE">;
  /**
   * Callback opcional chamada antes do refresh. Útil pra logar ou aplicar
   * filtro client-side. Se retornar `false`, o refresh é cancelado pra
   * este evento. NÃO precisa chamar router.refresh — o hook faz.
   */
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => boolean | void;
}

export interface UseRealtimeRefreshOpts {
  /** Uma ou várias subscriptions. */
  subscriptions: RealtimeSubscription[];
  /**
   * Desliga o hook (ex: mock data ativo). Default: liga se mock=false.
   */
  enabled?: boolean;
  /**
   * Debounce em ms pra agrupar eventos rajada num único refresh. Default: 300ms.
   */
  debounceMs?: number;
}

/**
 * Hook que escuta mudanças no Postgres via Supabase Realtime e chama
 * `router.refresh()` quando algo mudou. Pensado pra UIs que dependem de
 * Server Components — o refresh re-executa o componente no servidor e
 * envia o HTML novo, sem reload de página.
 *
 * Retorna o status agregado das subscriptions (cada componente mostra o seu).
 *
 * Exemplos:
 *   useRealtimeRefresh({ subscriptions: [{ table: "expedicoes" }] });
 *
 *   useRealtimeRefresh({
 *     subscriptions: [
 *       { table: "passageiros", filter: `expedicao_id=eq.${id}` },
 *       { table: "quartos",     filter: `expedicao_id=eq.${id}` },
 *     ],
 *   });
 */
export function useRealtimeRefresh({
  subscriptions,
  enabled,
  debounceMs = 300,
}: UseRealtimeRefreshOpts): RealtimeStatus {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime não funciona com mock data (dados em memória, não no banco).
  const isEnabled = enabled ?? !DEV_USE_MOCK_DATA;

  // Chave estável que descreve o "shape" das subscriptions (tabela + filtro + eventos).
  // Re-subscreve só quando algo estrutural muda — não quando o callback onChange
  // é recriado a cada render (que é o caso comum).
  const subsKey = useMemo(
    () =>
      subscriptions
        .map((s) => `${s.table}|${s.filter ?? ""}|${(s.events ?? ["*"]).join(",")}`)
        .sort()
        .join(";"),
    [subscriptions],
  );

  // Ref pras subscriptions atuais — os callbacks dentro do channel sempre
  // acessam a versão mais recente, mesmo que o useEffect não re-rode.
  const subsRef = useRef(subscriptions);
  useEffect(() => {
    subsRef.current = subscriptions;
  }, [subscriptions]);

  useEffect(() => {
    if (!isEnabled) {
      setStatus("offline");
      return;
    }

    const supabase = createClient();
    setStatus("connecting");

    // Captura subscriptions atuais (do ref) — os callbacks acessam o ref.
    const subs = subsRef.current;

    const channels: RealtimeChannel[] = [];
    const statuses = new Map<string, "connecting" | "live" | "error">();

    function aggregate() {
      const vals = Array.from(statuses.values());
      if (vals.length === 0) return setStatus("idle");
      if (vals.some((v) => v === "error")) return setStatus("error");
      if (vals.every((v) => v === "live")) return setStatus("live");
      setStatus("connecting");
    }

    function scheduleRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), debounceMs);
    }

    subs.forEach((sub, idx) => {
      const id = `${sub.table}-${idx}`;
      statuses.set(id, "connecting");

      const channelName = `rt:${sub.table}:${sub.filter ?? "all"}:${idx}`;
      const channel = supabase.channel(channelName);
      const eventsToListen = sub.events ?? ["INSERT", "UPDATE", "DELETE"];

      for (const ev of eventsToListen) {
        const cfg: {
          event: "INSERT" | "UPDATE" | "DELETE";
          schema: string;
          table: string;
          filter?: string;
        } = { event: ev, schema: "public", table: sub.table };
        if (sub.filter) cfg.filter = sub.filter;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (channel.on as any)("postgres_changes", cfg, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Lê o onChange mais recente via ref
          const currentSub = subsRef.current[idx];
          const decisao = currentSub?.onChange?.(payload);
          if (decisao === false) return;
          scheduleRefresh();
        });
      }

      channel.subscribe((s) => {
        if (s === "SUBSCRIBED") statuses.set(id, "live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") statuses.set(id, "error");
        else statuses.set(id, "connecting");
        aggregate();
      });

      channels.push(channel);
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const ch of channels) supabase.removeChannel(ch);
    };
    // ⚠️ Importante: NÃO incluir `subscriptions` (array nova a cada render)
    // nem callbacks aqui. Usar subsKey + ref pra estabilidade.
  }, [subsKey, isEnabled, debounceMs, router]);

  return status;
}
