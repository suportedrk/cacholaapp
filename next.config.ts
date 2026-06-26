import type { NextConfig } from 'next'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import withPWA from '@ducanh2912/next-pwa'
import { withSentryConfig } from '@sentry/nextjs'

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
const BUILD_DATE = new Date().toISOString().split('T')[0]
const APP_VERSION = JSON.parse(readFileSync('./package.json', 'utf-8')).version as string

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
    NEXT_PUBLIC_BUILD_DATE: BUILD_DATE,
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
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
    // CSP nesta 1ª rodada em modo Report-Only: NÃO bloqueia, só reporta
    // violações (console/Sentry) p/ tuning antes de promover a enforce.
    // Permissiva o suficiente p/ Next + next-pwa (worker/eval) + Recharts
    // (style inline) + Sentry/Supabase (connect/wss). Endurecer depois com
    // nonces e remoção de 'unsafe-inline'/'unsafe-eval'. (A02)
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "form-action 'self'",
    ].join('; ')

    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
      { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
    ]

    // HSTS só em produção (HTTPS). Em dev (http://localhost) o browser ignora,
    // e evitamos pinar o host local com includeSubDomains/preload.
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      })
    }

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

const composedConfig = withBundleAnalyzer(withPWA({
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

// Sentry é o wrapper mais externo. Fase 1: sem upload de sourcemap — sem
// SENTRY_AUTH_TOKEN o plugin pula o upload e o build segue normal. Fase 2:
// definir SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT no .env da prod
// para passar a subir sourcemaps (stacks legíveis).
export default withSentryConfig(composedConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Release alinhada ao pipeline de versão existente (git short hash).
  release: { name: BUILD_ID },
  // Silencioso no build da VPS (CI não setado); verboso só em CI real.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // (v10) substituem disableLogger + automaticVercelMonitors do nível raiz.
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
})
