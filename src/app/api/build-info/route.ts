import { NextResponse } from 'next/server'

/**
 * GET /api/build-info
 *
 * Endpoint público (sem autenticação) que retorna o BUILD_ID do deploy atual.
 * Usado pelo ServiceWorkerUpdater para detectar novos deploys via polling.
 *
 * Cache-Control: no-store garante que proxies/CDN nunca retornem valor antigo.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? 'unknown' },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    },
  )
}
