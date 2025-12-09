/** @type {import('next').NextConfig} */
const nextConfig = {
  // We strictly ignore typescript errors during build to prevent Vercel failures
  typescript: {
    ignoreBuildErrors: true,
  },
  // Same for ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
