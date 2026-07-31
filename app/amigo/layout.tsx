import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

const OG_TITLE = "ExpedAmigo — sua viagem na palma da mão";
const OG_DESC =
  "Roteiro dia a dia, vouchers, informações do destino e avisos. Acesse com seu CPF e senha.";

/**
 * Layout do ExpedAmigo (portal do viajante). Sobrescreve a metadata do portal:
 * - `<link rel="manifest">` aponta pro manifest do ExpedAmigo (`start_url: /amigo`)
 *   e o título do atalho iOS vira "ExpedAmigo" (atalho abre direto no portal).
 * - Open Graph: quando o link é colado no WhatsApp, aparece um card com a logo,
 *   título e descrição em vez da URL crua. `metadataBase` = SITE_URL, pra imagem
 *   e URL virarem absolutas (o robô do WhatsApp exige).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ExpedAmigo — Se Tu For, Eu Vou",
  description: OG_DESC,
  manifest: "/amigo/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ExpedAmigo",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: "/expedamigo",
    siteName: "Se Tu For, Eu Vou",
    title: OG_TITLE,
    description: OG_DESC,
    locale: "pt_BR",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "ExpedAmigo" }],
  },
  twitter: {
    card: "summary",
    title: OG_TITLE,
    description: OG_DESC,
    images: ["/icons/icon-512.png"],
  },
};

export default function AmigoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
