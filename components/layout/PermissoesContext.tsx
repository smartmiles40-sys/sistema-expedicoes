"use client";
import * as React from "react";

/**
 * Contexto de permissões de UI. Exposto pelo AppShell (que já tem o `user`) e
 * consumido pelos componentes cliente que renderizam botões de edição, pra
 * ESCONDER esses botões em perfis somente-leitura (relacionamento / leitura).
 *
 * ⚠️ Isso é só UX — o enforcement real é servidor (RLS + guardas). Esconder o
 * botão evita frustração de clicar e tomar "somente leitura".
 *
 * `podeDecidirInscricao` é a exceção do perfil `relacionamento`: ele é
 * somente-leitura no resto do sistema, mas PODE aprovar/recusar inscrições — por
 * isso a fila `/inscricoes` usa esse flag pros botões de aprovar/recusar (e
 * `somenteLeitura` só pros de restaurar/excluir, que são de editor).
 */
type Permissoes = {
  somenteLeitura: boolean;
  podeDecidirInscricao: boolean;
};

const PermissoesCtx = React.createContext<Permissoes>({
  somenteLeitura: false,
  podeDecidirInscricao: true,
});

export function PermissoesProvider({
  somenteLeitura,
  podeDecidirInscricao,
  children,
}: {
  somenteLeitura: boolean;
  podeDecidirInscricao: boolean;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ somenteLeitura, podeDecidirInscricao }),
    [somenteLeitura, podeDecidirInscricao],
  );
  return <PermissoesCtx.Provider value={value}>{children}</PermissoesCtx.Provider>;
}

/** true quando o usuário logado é somente-leitura → esconder botões de edição. */
export function useSomenteLeitura(): boolean {
  return React.useContext(PermissoesCtx).somenteLeitura;
}

/** conveniência: inverso de useSomenteLeitura (pode editar → mostrar botões). */
export function usePodeEditar(): boolean {
  return !React.useContext(PermissoesCtx).somenteLeitura;
}

/** true para editores E para o perfil `relacionamento` (aprova/recusa inscrições). */
export function usePodeDecidirInscricao(): boolean {
  return React.useContext(PermissoesCtx).podeDecidirInscricao;
}
