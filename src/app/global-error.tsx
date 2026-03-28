'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// global-error substitui o root layout inteiro — precisa incluir <html> e <body>
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[Cachola OS] Global error:', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAFAF8',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: '#fee2e2',
              margin: '0 auto 20px',
            }}
          >
            <AlertTriangle size={32} color="#dc2626" strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
            Erro crítico
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8, maxWidth: 320 }}>
            O sistema encontrou um erro e não conseguiu continuar.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 24, fontFamily: 'monospace' }}>
              ID: {error.digest}
            </p>
          )}
          {!error.digest && <div style={{ marginBottom: 24 }} />}
          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              backgroundColor: '#7C8D78',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            Recarregar
          </button>
        </div>
      </body>
    </html>
  )
}
