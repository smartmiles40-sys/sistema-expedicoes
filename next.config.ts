import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Inscrição pública envia o anexo do passaporte junto do formulário (server action).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
