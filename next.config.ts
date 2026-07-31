import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Inscrição pública envia o anexo do passaporte junto do formulário (server action).
    serverActions: { bodySizeLimit: "12mb" },
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
