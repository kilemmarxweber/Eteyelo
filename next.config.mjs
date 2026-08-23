/** @type {import('next').NextConfig} */
const nextConfig = {
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
  ],
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

export default nextConfig;