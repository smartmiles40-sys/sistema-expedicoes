import type { MetadataRoute } from "next";

/**
 * Web App Manifest — faz o atalho na tela inicial (Android/Chrome) usar a logo
 * da agência e abrir em tela cheia (standalone). No iOS quem manda é o
 * `app/apple-icon.png` (apple-touch-icon) + o bloco `appleWebApp` do layout.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Se Tu For, Eu Vou — Expedições",
    short_name: "STFEV",
    description: "Sistema operacional de expedições — Se Tu For, Eu Vou",
    start_url: "/",
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
}
