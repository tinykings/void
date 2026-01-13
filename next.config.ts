import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // If you are deploying to a subdirectory (e.g. https://<username>.github.io/<repo-name>/),
  // you need to uncomment the following line and replace <repo-name> with your repository name.
  basePath: '/void',
};

export default nextConfig;