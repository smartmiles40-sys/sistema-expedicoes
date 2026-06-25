"use client";
import { useEffect } from "react";

/**
 * Rede de segurança para o bug do Radix/react-remove-scroll que às vezes deixa
 * `pointer-events: none` preso no <body> ao fechar um drawer + navegar/refresh,
 * travando TODOS os cliques (o scroll por toque continua funcionando). Roda a
 * cada render do shell e limpa o estado preso. O overlay do modal aberto continua
 * cobrindo o fundo, então liberar o body é seguro.
 */
export function PointerEventsGuard() {
  useEffect(() => {
    if (document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  });
  return null;
}
