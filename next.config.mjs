/** @type {import('next').NextConfig} */
const nextConfig = {
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
