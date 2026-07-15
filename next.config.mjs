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
