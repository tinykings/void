import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GITHUB_PAGES is set in the web deploy workflow; omitting it (e.g. for Android/Capacitor builds)
  // produces an empty basePath so assets resolve correctly inside the WebView.
  basePath: process.env.GITHUB_PAGES ? '/void' : '',
};

export default nextConfig;