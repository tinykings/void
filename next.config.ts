import type { NextConfig } from "next";

const normalizeBasePath = (path?: string) => {
  const trimmedPath = (path || '').trim().replace(/^\/+|\/+$/g, '');
  return trimmedPath ? `/${trimmedPath}` : '';
};

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  env: {
    GIST_AUTH_URL: process.env.GIST_AUTH_URL,
  },
  ...(basePath ? { basePath } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
