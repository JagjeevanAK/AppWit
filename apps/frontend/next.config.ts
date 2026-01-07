import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Enable standalone output for Docker
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public URLs (pub-*.r2.dev)
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        // Cloudflare R2 direct bucket URLs
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        // Allow any custom domain configured for R2
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
