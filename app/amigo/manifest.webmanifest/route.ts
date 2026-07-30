import type { MetadataRoute } from "next";

/**
 * Manifest EXCLUSIVO do ExpedAmigo. O manifest global (`app/manifest.ts`) abre em
 * "/" (tela de escolha do sistema operacional); este abre direto no portal do
 * viajante. É linkado só nas páginas de `/amigo` (via `app/amigo/layout.tsx`),
 * então um atalho criado a partir do ExpedAmigo usa ESTE — `start_url: /amigo`.
 *
 * Servido como route handler (e não `app/manifest.ts`, que é raiz-only) pra
 * garantir o content-type `application/manifest+json`.
 */
const manifest: MetadataRoute.Manifest = {
  name: "ExpedAmigo — Se Tu For, Eu Vou",
  short_name: "ExpedAmigo",
  description: "Sua viagem na palma da mão — roteiro, vouchers e informações.",
  start_url: "/amigo",
  scope: "/amigo",
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
