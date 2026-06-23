/**
 * Hook de instrumentação do Next.js (App Router).
 * Carrega o Sentry no runtime correto (Node ou Edge) e expõe `onRequestError`
 * para capturar erros não tratados em Server Components e Route Handlers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/observability/sentry.server')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./lib/observability/sentry.edge')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
