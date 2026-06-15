'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { isChunkLoadError, reloadForNewVersion } from '@/lib/pwa/chunk-reload'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// global-error substitui o root layout inteiro — precisa incluir <html> e <body>
export default function GlobalError({ error }: GlobalErrorProps) {
  // Avalia de forma síncrona para que o render inicial já mostre a UI correta.
  const isVersionError = isChunkLoadError(error)

  useEffect(() => {
    if (isVersionError) {
      // Tenta recarregar para buscar o novo bundle. A guarda de 15 s evita loop.
      reloadForNewVersion()
    } else {
      console.error('[Cachola OS] Global error:', error)
    }
  }, [error, isVersionError])

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
              backgroundColor: isVersionError ? '#d1fae5' : '#fee2e2',
              margin: '0 auto 20px',
            }}
          >
            {isVersionError ? (
              <RefreshCw
                size={32}
                color="#059669"
                strokeWidth={1.5}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <AlertTriangle size={32} color="#dc2626" strokeWidth={1.5} />
            )}
          </div>

          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
            {isVersionError ? 'Atualizando…' : 'Erro crítico'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8, maxWidth: 320 }}>
            {isVersionError
              ? 'Uma nova versão do sistema foi publicada. Recarregando…'
              : 'O sistema encontrou um erro e não conseguiu continuar.'}
          </p>

          {!isVersionError && error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 24, fontFamily: 'monospace' }}>
              ID: {error.digest}
            </p>
          )}
          {(!isVersionError && !error.digest) && <div style={{ marginBottom: 24 }} />}
          {isVersionError && <div style={{ marginBottom: 24 }} />}

          <button
            onClick={() => window.location.reload()}
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

        {/* Animação de spin inline — global-error não tem acesso ao CSS do app */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
      </body>
    </html>
  )
}
