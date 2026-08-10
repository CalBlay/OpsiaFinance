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
     * la RSC si s'ha visitat fa menys de 90s (consultes es beneficen del reuse).
     */
    staleTimes: {
      dynamic: 90,
      static: 180,
    },
  },
  /**
   * Els PNG del PWA viuen a `app/` (no són metadata files de Next),
   * així que es serveixen via /api/pwa-icon/* amb aquestes URL públiques.
   */
  async rewrites() {
    return {
      afterFiles: [
        { source: "/icon-192.png", destination: "/api/pwa-icon/icon-192.png" },
        { source: "/icon-512.png", destination: "/api/pwa-icon/icon-512.png" },
        {
          source: "/icon-maskable-512.png",
          destination: "/api/pwa-icon/icon-maskable-512.png",
        },
      ],
    };
  },
};

export default nextConfig;
