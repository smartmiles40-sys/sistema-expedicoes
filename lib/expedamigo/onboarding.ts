/**
 * Onboarding automático do ExpedAmigo: template da mensagem de boas-vindas
 * enviada por WhatsApp (via n8n) quando o passageiro é liberado.
 *
 * Variáveis: {nome}, {expedição}, {link}. O texto-base é único (genérico); se um dia
 * quiser texto por expedição, dá pra adicionar um override (campo na expedição) e
 * passar aqui como `templateOverride`.
 */
export const MENSAGEM_ONBOARDING_PADRAO =
  `Oiii {nome}! Que alegria ter você na Expedição {expedição} 💚

Aqui é o time de Relacionamento da Se Tu For — a partir de agora somos nós que vamos cuidar de você em cada detalhe até o embarque (e durante a viagem também).

Já liberamos o seu acesso ao *Portal do Viajante* 🎉 É nele que você acompanha tudo da sua viagem em um só lugar: o *roteiro dia a dia*, seus *voos*, a *hospedagem*, vouchers, informações do destino e avisos importantes.

👉 {link}

É só clicar no link pra criar sua senha e entrar. Qualquer dúvida, estamos aqui por você! 🙌`;

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
