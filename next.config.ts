import type { NextConfig } from "next";

const devWatchIgnored = [
  "**/node_modules/**",
  "**/.git/**",
  "**/terminals/**",
  "**/test-results/**",
  "**/playwright-report/**",
  "**/_recovery/**",
  "**/agent-tools/**",
];

const usingTurbopack = process.env.BADAZZ_DEV_BUNDLER === "turbopack";

const nextConfig: NextConfig = {
  serverExternalPackages: ["word-extractor"],
  // Keep more routes warm during rapid edits to reduce full recompiles.
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  experimental: {
    // Optimize for beautiful animations and large state
    optimizePackageImports: ["lucide-react", "framer-motion", "@dnd-kit/core"],
  },
  transpilePackages: [
    "docx-preview",
    "@supabase/supabase-js",
    "@supabase/postgrest-js",
    "@supabase/realtime-js",
    "@supabase/gotrue-js",
    "@supabase/storage-js",
    "@supabase/auth-helpers-nextjs",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // PWA-ready headers for service worker + offline shell (enhanced in this phase)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
      {
        // SW must not be cached long-term; proper scope
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        // PWA Manifest
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // PWA Icons
        source: "/icon-:name*.(jpg|png|svg)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

if (!usingTurbopack) {
  nextConfig.webpack = (config, { dev }) => {
    if (!dev) {
      return config;
    }

    // Avoid stale webpack chunk references (e.g. missing ./4447.js) on Windows.
    config.cache = false;
    config.watchOptions = {
      ...config.watchOptions,
      ignored: devWatchIgnored,
    };
    return config;
  };
}

export default nextConfig;
