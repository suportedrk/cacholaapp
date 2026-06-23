import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from './scrub-pii'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  release: process.env.NEXT_PUBLIC_BUILD_ID,
  environment: process.env.NODE_ENV,
  enabled: !!dsn && (process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLE_DEV === 'true'),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
})
