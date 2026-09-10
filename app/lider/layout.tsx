import type { Metadata } from "next";

/**
 * Layout da Área do Líder. Linka o manifest próprio (`start_url: /lider`) pra o
 * atalho instalado abrir direto aqui e, com o service worker (`/lider-sw.js`),
 * funcionar offline. `appleWebApp` deixa o atalho iOS em tela cheia.
 */
export const metadata: Metadata = {
  title: "Área do Líder — Se Tu For, Eu Vou",
  description: "Expedições, passageiros, prontidão e documentos — na palma da mão, mesmo offline.",
  manifest: "/lider/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Líder",
    statusBarStyle: "black-translucent",
  },
};

export default function LiderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
