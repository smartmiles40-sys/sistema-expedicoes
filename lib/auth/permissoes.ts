import { getCurrentUser } from "@/lib/supabase/auth";
import type { PapelUsuario } from "@/types/database";

/**
 * Modelo de permissão por papel (perfil do usuário).
 *
 * - EDITORES (podem escrever no sistema operacional): admin, operacional, comercial,
 *   financeiro.
 * - SOMENTE LEITURA (não escrevem): relacionamento, leitura.
 *   - `relacionamento` é a exceção: além de ler tudo, PODE aprovar/recusar inscrições.
 *   - `leitura` é somente leitura puro.
 *
 * A trava de escrita em produção é feita em duas camadas:
 * 1. RLS (migration 0046): bloqueia insert/update/delete p/ relacionamento/leitura
 *    nas ações que escrevem com a sessão do usuário.
 * 2. Guardas de app (estes helpers): nas ações que escrevem com service role (que
 *    ignora RLS), e nas decisões de inscrição.
 */

export function ehSomenteLeitura(papel: PapelUsuario | null | undefined): boolean {
  return papel === "relacionamento" || papel === "leitura";
}

/** Pode editar/escrever no sistema (qualquer mutação que não seja inscrição). */
export function podeEditar(papel: PapelUsuario | null | undefined): boolean {
  return !!papel && !ehSomenteLeitura(papel);
}

/** Pode aprovar/recusar inscrições: editores + relacionamento (NÃO o leitura puro). */
export function podeDecidirInscricao(papel: PapelUsuario | null | undefined): boolean {
  return podeEditar(papel) || papel === "relacionamento";
}

export class ErroPermissao extends Error {
  constructor(msg = "Seu perfil é somente leitura — ação não permitida.") {
    super(msg);
    this.name = "ErroPermissao";
  }
}

/** Garante que o usuário logado pode editar; lança ErroPermissao caso contrário. */
export async function assertPodeEditar(): Promise<void> {
  const u = await getCurrentUser();
  if (!podeEditar(u?.papel)) throw new ErroPermissao();
}

/** Garante que o usuário logado pode decidir inscrições. */
export async function assertPodeDecidirInscricao(): Promise<void> {
  const u = await getCurrentUser();
  if (!podeDecidirInscricao(u?.papel)) {
    throw new ErroPermissao("Sem permissão para decidir inscrições.");
  }
}
