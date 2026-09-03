import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Permet `NEXT_DIST_DIR=.next-prod pnpm build` en parallèle de `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Redis / BullMQ : non bundlés (évite warning child-processor).
  // exceljs (+ unzipper/fstream/rimraf) : externalisés pour éviter le warning
  // Turbopack « Package rimraf can't be external » sur les pages qui exportent Excel.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "exceljs",
    "unzipper",
    "fstream",
    "rimraf",
    "@prisma/client",
    "pg",
  ],
  turbopack: {
    resolveAlias: {
      "@/prisma/generated/prisma/client": "./prisma/generated/prisma/client.ts",
      "@/prisma/generated/prisma/enums": "./prisma/generated/prisma/enums.ts",
      "./prisma/generated/prisma/client": "./prisma/generated/prisma/client.ts",
      "./prisma/generated/prisma/enums": "./prisma/generated/prisma/enums.ts",
    },
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:fileName",
        destination: "/api/uploads/:fileName",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  webpack: (config) => {
    // react-pdf / pdfjs : pas de canvas natif côté serveur
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
