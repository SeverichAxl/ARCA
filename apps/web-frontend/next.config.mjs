import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Solo afecta a builds de Docker que pasen DOCKER_FAST_BUILD=1 (ver docker/Dockerfile.frontend).
// CI ejecuta `pnpm lint` y `pnpm build` sin esta variable, por lo que sigue validando tipos.
const fastBuild = process.env.DOCKER_FAST_BUILD === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(currentDir, '../..'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: fastBuild,
  },
};

export default nextConfig;
