import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

// Uso: ANALYZE=true npm run build
// @next/bundle-analyzer é opcional — não quebra o build se não estiver instalado
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BundleAnalyzer = process.env.ANALYZE === 'true' ? require('@next/bundle-analyzer')({ enabled: true }) : null
const withBundleAnalyzer = (cfg: NextConfig) => BundleAnalyzer ? BundleAnalyzer(cfg) : cfg

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
