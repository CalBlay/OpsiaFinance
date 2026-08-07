import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que Webpack empaqueti xlsx (trenca `utils` en server actions)
  serverExternalPackages: ["xlsx"],
  // Next.js 15+: límit de pujada per server actions (per defecte 1 MB → "Failed to fetch")
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
