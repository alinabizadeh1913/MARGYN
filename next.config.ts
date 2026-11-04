import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // خروجی export فقط برای بیلد پروداکشن اعمال شود تا حالت dev سریع باشد
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  images: { unoptimized: true },
  trailingSlash: true,
  compress: true,
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["pdfjs-dist"],
  webpack: (config: any, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
        stream: require.resolve("stream-browserify"),
        process: require.resolve("process/browser"),
      };
    }
    // Disable canvas alias for pdfjs-dist
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
