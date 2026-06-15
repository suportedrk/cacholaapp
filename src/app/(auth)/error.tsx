'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { isChunkLoadError, reloadForNewVersion } from '@/lib/pwa/chunk-reload'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error }: ErrorProps) {
  const isVersionError = isChunkLoadError(error)

  useEffect(() => {
    if (isVersionError) {
      reloadForNewVersion()
    } else {
      console.error('[Cachola OS] Route error:', error)
    }
  }, [error, isVersionError])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-page-enter">
      {/* Ícone */}
      <div className={cn(
        'flex items-center justify-center w-16 h-16 rounded-2xl mb-5',
        isVersionError ? 'bg-emerald-100' : 'bg-destructive/10',
      )}>
        <RefreshCw
          className={cn(
            'w-8 h-8',
            isVersionError ? 'text-emerald-600 animate-spin' : 'hidden',
          )}
          strokeWidth={1.5}
        />
        <AlertTriangle
          className={cn(
            'w-8 h-8 text-destructive',
            isVersionError ? 'hidden' : '',
          )}
          strokeWidth={1.5}
        />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        {isVersionError ? 'Atualizando…' : 'Algo deu errado'}
      </h2>
      <p className="text-sm text-muted-foreground mb-1 max-w-sm">
        {isVersionError
          ? 'Uma nova versão do sistema foi publicada. Recarregando…'
          : 'Ocorreu um erro inesperado ao carregar esta página.'}
      </p>

      {!isVersionError && error.digest && (
        <p className="text-xs text-muted-foreground/60 mb-6 font-mono">
          ID: {error.digest}
        </p>
      )}
      {(!isVersionError && !error.digest) && <div className="mb-6" />}
      {isVersionError && <div className="mb-6" />}

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={() => window.location.reload()}
          className={cn(buttonVariants({ variant: 'default', size: 'default' }))}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {isVersionError ? 'Recarregar agora' : 'Tentar novamente'}
        </button>
        {!isVersionError && (
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
          >
            <Home className="w-4 h-4 mr-2" />
            Ir para o Dashboard
          </Link>
        )}
      </div>
    </div>
  )
}
