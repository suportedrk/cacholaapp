import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from './scrub-pii'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  release: process.env.NEXT_PUBLIC_BUILD_ID,
  environment: process.env.NODE_ENV,
  // Só ativa em produção (espelha o `disable: dev` do PWA). Em dev, ligar
  // pontualmente com SENTRY_ENABLE_DEV=true para validação.
  enabled: !!dsn && (process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLE_DEV === 'true'),
  // Foco é ERRO; performance é bônus com amostragem baixa.
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
})
