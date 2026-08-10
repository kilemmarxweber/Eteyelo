/** @type {import('next').NextConfig} */
const nextConfig = {
  // Redis / BullMQ restent utilisés côté serveur, mais ne sont plus bundlés
  // par Webpack (évite le warning "Critical dependency" de child-processor).
  serverExternalPackages: ["bullmq", "ioredis"],
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

/* module.exports = {
    async redirects() {
      return [
        {
          source: "/:path*",
          destination: "/:path*",
          permanent: true,
        },
      ];
    },
  }; */
