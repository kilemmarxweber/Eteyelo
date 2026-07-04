/** @type {import('next').NextConfig} */
const nextConfig = {
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
  