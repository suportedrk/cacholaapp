import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from './lib/observability/scrub-pii'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  release: process.env.NEXT_PUBLIC_BUILD_ID,
  environment: process.env.NODE_ENV,
  // Só ativa em produção. Em dev, ligar pontualmente com
  // NEXT_PUBLIC_SENTRY_ENABLE_DEV=true para validação.
  enabled:
    !!dsn &&
    (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === 'true'),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  // Sem Session Replay por ora — evita capturar PII de menor renderizada na tela.
  beforeSend: scrubEvent,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
