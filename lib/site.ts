/**
 * URL pública do sistema (sem barra final). Usada pra montar links absolutos —
 * principalmente o `metadataBase`/Open Graph do ExpedAmigo, pra o card de preview
 * do WhatsApp achar a imagem e a URL certas.
 *
 * Hoje aponta pro deploy da Vercel. Quando o domínio próprio
 * (portal.setuforeuvouviagens.com.br) estiver configurado na Vercel + DNS, basta
 * definir NEXT_PUBLIC_SITE_URL nas envs do projeto e redeployar — nada de código.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sistema-expedicoes.vercel.app"
).replace(/\/+$/, "");
