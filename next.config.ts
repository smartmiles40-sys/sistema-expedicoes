import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Inscrição pública envia passaporte + foto + certificado juntos (server action).
    // As imagens são comprimidas no navegador antes do envio (lib/comprimir-imagem),
    // mas o limite fica folgado (32mb) pra acomodar PDFs e o pior caso de 3 anexos.
    serverActions: { bodySizeLimit: "32mb" },
  },
  // Link amigável pra mandar no WhatsApp: /expedamigo -> portal do viajante (/amigo).
  // Temporário (307) de propósito, pra poder mudar o destino depois sem cache agressivo.
  async redirects() {
    return [
      { source: "/expedamigo", destination: "/amigo", permanent: false },
    ];
  },
};

export default nextConfig;
