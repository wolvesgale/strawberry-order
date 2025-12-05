// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // monorepo っぽい構成なので、Turbopack に
  // 「このディレクトリがアプリのルートだよ」と教える
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
