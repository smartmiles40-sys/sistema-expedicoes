/**
 * Onboarding automático do ExpedAmigo: template da mensagem de boas-vindas
 * enviada por WhatsApp (via n8n) quando o passageiro é liberado.
 *
 * Variáveis: {nome}, {expedição}, {link}. O texto-base é único (genérico); se um dia
 * quiser texto por expedição, dá pra adicionar um override (campo na expedição) e
 * passar aqui como `templateOverride`.
 */
export const MENSAGEM_ONBOARDING_PADRAO =
  "Olá {nome}! Seu acesso ao portal da sua Expedição {expedição} já está pronto 👉 {link} clique no link para acessar";

/** Primeiro nome (a mensagem fica mais pessoal com o primeiro nome). */
function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || nome || "";
}

export function montarMensagemOnboarding(
  params: { nome: string; expedicao: string; link: string },
  templateOverride?: string | null,
): string {
  const t = (templateOverride && templateOverride.trim()) || MENSAGEM_ONBOARDING_PADRAO;
  return t
    .replaceAll("{nome}", primeiroNome(params.nome))
    .replaceAll("{expedição}", params.expedicao)
    .replaceAll("{expedicao}", params.expedicao)
    .replaceAll("{link}", params.link);
}
