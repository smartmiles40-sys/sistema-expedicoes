import type { Metadata } from "next";

/**
 * Layout do ExpedAmigo (portal do viajante). Só existe pra sobrescrever a
 * metadata do atalho: aqui o `<link rel="manifest">` aponta pro manifest do
 * ExpedAmigo (`start_url: /amigo`) e o título do atalho iOS vira "ExpedAmigo".
 * Assim, quem adiciona à tela inicial ESTANDO no ExpedAmigo cria um atalho que
 * abre direto no portal do viajante — não na tela de escolha do sistema.
 */
export const metadata: Metadata = {
  title: "ExpedAmigo — Se Tu For, Eu Vou",
  manifest: "/amigo/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ExpedAmigo",
    statusBarStyle: "black-translucent",
  },
};

export default function AmigoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
