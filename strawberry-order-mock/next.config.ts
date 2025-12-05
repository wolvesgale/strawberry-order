// strawberry-order-mock/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Turbopack に「このディレクトリがルートだよ」と教える
    root: __dirname,
  },
};

export default nextConfig;
