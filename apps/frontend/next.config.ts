import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que Webpack empaqueti xlsx (trenca `utils` en server actions)
  serverExternalPackages: ["xlsx"],
  // Next.js 15+: límit de pujada per server actions (per defecte 1 MB → "Failed to fetch")
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    /**
     * Cache del router al client: en canviar de pestanya no es torna a demanar
     * la RSC si s'ha visitat fa menys de 30s (abans era 0 → cada clic = fetch complet).
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
