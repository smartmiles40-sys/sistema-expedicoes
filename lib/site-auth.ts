/**
 * Gate de senha única (compartilhada) pro site inteiro — sem cadastro/login.
 *
 * Liga-se setando a env `SITE_PASSWORD`. Sem ela, o gate fica DESLIGADO
 * (ex.: desenvolvimento local roda direto). O cookie guarda só um hash da
 * senha, nunca a senha em claro.
 *
 * Usado no `middleware.ts` (Edge) e na server action de `/acesso` (Node) —
 * `crypto.subtle` existe nos dois ambientes.
 */
export const SITE_AUTH_COOKIE = "se_acesso";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token derivado de uma senha (vai no cookie / é comparado). */
export async function tokenDeSenha(senha: string): Promise<string> {
  return sha256Hex(`se-acesso:v1:${senha}`);
}

/**
 * Token esperado, a partir de `SITE_PASSWORD`. Retorna `null` quando a env
 * não está setada → gate DESLIGADO.
 */
export async function tokenAcesso(): Promise<string | null> {
  const senha = process.env.SITE_PASSWORD;
  if (!senha) return null;
  return tokenDeSenha(senha);
}
