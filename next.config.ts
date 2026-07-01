import type { NextConfig } from "next";

const normalizeBasePath = (path?: string) => {
  const trimmedPath = (path || '').trim().replace(/^\/+|\/+$/g, '');
  return trimmedPath ? `/${trimmedPath}` : '';
};

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  output: 'export',
  ...(basePath ? { basePath } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
