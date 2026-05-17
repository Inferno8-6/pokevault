import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["next-auth", "@auth/core", "@prisma/client", ".prisma/client"],
  transpilePackages: ["@pokemon/db", "@pokemon/tcg-api", "@pokemon/shared"],
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/*.node",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/schema.prisma",
    ],
  },
  images: {
    // Cache les images optimisées 7 jours (TCGdex ne change pas souvent)
    minimumCacheTTL: 604800,
    // Format WebP natif TCGdex — pas de re-conversion nécessaire
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "images.scrydex.com",
      },
      // Wildcard pour couvrir tout sous-domaine d'image TCG inconnu
      {
        protocol: "https",
        hostname: "**.pokemontcg.io",
      },
      // TCGdex — cartes françaises avec images FR (source principale)
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
      },
    ],
  },
};

export default nextConfig;
