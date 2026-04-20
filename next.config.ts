import type { NextConfig } from 'next'
import { execSync } from 'child_process'
import withPWA from '@ducanh2912/next-pwa'

/** Determina o BUILD_ID uma única vez, no início do processo de build. */
function getBuildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    // Fallback para ambientes sem git (CI/CD bare, Docker sem .git montado)
    return Date.now().toString()
  }
}

const BUILD_ID = getBuildId()

// Uso: ANALYZE=true npm run build
// @next/bundle-analyzer é opcional — não quebra o build se não estiver instalado
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BundleAnalyzer = process.env.ANALYZE === 'true' ? require('@next/bundle-analyzer')({ enabled: true }) : null
const withBundleAnalyzer = (cfg: NextConfig) => BundleAnalyzer ? BundleAnalyzer(cfg) : cfg

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // BUILD_ID determinístico (git short hash). Injetado em:
  //   1. generateBuildId → usado pelo Next.js internamente e pelo SW workbox
  //   2. env.NEXT_PUBLIC_BUILD_ID → acessível em componentes client via process.env
  // IMPORTANTE: estas opções devem ficar em nextConfig, NUNCA dentro de withPWA({...}).
  generateBuildId: async () => BUILD_ID,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },

  // Turbopack é o padrão no Next.js 16 — config vazia silencia aviso de conflito webpack
  turbopack: {},

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Headers de segurança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    // Novo SW ativa imediatamente após um deploy, sem esperar todas as abas fecharem.
    // Evita o bug "sem CSS" causado pelo SW antigo servindo chunks com hash desatualizados.
    skipWaiting: true,
    // Novo SW assume controle de todas as abas abertas imediatamente após ativar.
    clientsClaim: true,
  },
})(nextConfig))
