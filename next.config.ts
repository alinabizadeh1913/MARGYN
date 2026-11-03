import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* =========================================================
     OUTPUT
     ---------------------------------------------------------
     Electron needs a static export so the app can be loaded
     directly through the custom `app://` protocol without a
     running Node.js server.
  ========================================================= */
  output: "export",

  /* =========================================================
     IMAGES
     ---------------------------------------------------------
     Static export cannot use the default Next.js image
     optimizer, so images are served as-is.
  ========================================================= */
  images: {
    unoptimized: true,
  },

  /* =========================================================
     ROUTING
     ---------------------------------------------------------
     Emits every route as `route/index.html`, which is what
     the Electron protocol handler expects when resolving
     `app://bundle/...` URLs.
  ========================================================= */
  trailingSlash: true,

  /* =========================================================
     COMPRESSION
     ---------------------------------------------------------
     Compress the emitted JavaScript and CSS output.
  ========================================================= */
  compress: true,

  /* =========================================================
     OUTPUT FILE TRACING ROOT
     ---------------------------------------------------------
     Prevents Next.js from picking up a parent-directory
     package-lock.json as the workspace root. This silences
     the "multiple lockfiles detected" warning.
  ========================================================= */
  outputFileTracingRoot: path.join(__dirname),

  /* =========================================================
     WEBPACK
     ---------------------------------------------------------
     Webpack 5 (used by Next.js 15) no longer ships automatic
     polyfills for Node.js core modules in the browser
     bundle. Packages such as `drizzle-orm`, `sql.js` and
     some transitive dependencies still reference `buffer`,
     `stream` and `process`.

     The fallbacks below provide lightweight browser
     implementations of those modules so the client bundle
     resolves cleanly.
  ========================================================= */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
        stream: require.resolve("stream-browserify"),
        process: require.resolve("process/browser"),
      };
    }

    return config;
  },
};

export default nextConfig;
