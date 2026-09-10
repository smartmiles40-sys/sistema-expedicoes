import type { MetadataRoute } from "next";

/**
 * Manifest EXCLUSIVO da Área do Líder (`start_url: /lider`). Linkado só nas páginas
 * de `/lider` (via `app/lider/layout.tsx`), então um atalho criado a partir daqui
 * abre direto na Área do Líder — e, com o service worker, funciona offline.
 * Servido como route handler pra garantir o content-type `application/manifest+json`.
 */
const manifest: MetadataRoute.Manifest = {
  name: "Área do Líder — Se Tu For, Eu Vou",
  short_name: "Líder",
  description: "Expedições, passageiros, prontidão e documentos — na palma da mão, mesmo offline.",
  start_url: "/lider",
  scope: "/lider",
  display: "standalone",
  background_color: "#09282b",
  theme_color: "#09282b",
  lang: "pt-BR",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
