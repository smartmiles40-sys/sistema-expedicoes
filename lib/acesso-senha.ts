/**
 * Senha por pessoa (por CPF) — ExpedAmigo e Área do Líder (migration 0031).
 *
 * 1º acesso: a senha é a DATA DE NASCIMENTO (dd/mm/aaaa). No sucesso desse
 * primeiro login, a UI força criar uma senha nova, que passa a valer (hash na
 * tabela `acesso_senhas`). Hash com sal por CPF (crypto.subtle, sem dependência).
 */
const PEPPER = "expedamigo:senha:v1";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash da senha, usando o CPF (11 dígitos) como sal. */
export async function hashSenhaAcesso(cpf: string, senha: string): Promise<string> {
  return sha256Hex(`${PEPPER}:${cpf}:${senha}`);
}

/** Só os dígitos (pra comparar data digitada de formas diferentes). */
export function soDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * A senha inicial (1º acesso) é a data de nascimento. Aceita o que o usuário
 * digitar em dd/mm/aaaa OU aaaa-mm-dd (compara só os dígitos, nas duas ordens).
 */
export function conferemSenhaInicial(senhaDigitada: string, nascimentoIso: string | null): boolean {
  if (!nascimentoIso) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimentoIso);
  if (!m) return false;
  const [, y, mo, d] = m;
  const t = soDigitos(senhaDigitada);
  return t.length === 8 && (t === `${d}${mo}${y}` || t === `${y}${mo}${d}`);
}

/** Regra mínima da nova senha (não pode ser vazia/curta demais). */
export function senhaNovaValida(s: string): string | null {
  const v = (s ?? "").trim();
  if (v.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  return null;
}
