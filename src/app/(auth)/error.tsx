'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Cachola OS] Route error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-page-enter">
      {/* Ícone */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-5">
        <AlertTriangle className="w-8 h-8 text-destructive" strokeWidth={1.5} />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        Algo deu errado
      </h2>
      <p className="text-sm text-muted-foreground mb-1 max-w-sm">
        Ocorreu um erro inesperado ao carregar esta página.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60 mb-6 font-mono">
          ID: {error.digest}
        </p>
      )}
      {!error.digest && <div className="mb-6" />}

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className={cn(buttonVariants({ variant: 'default', size: 'default' }))}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
        >
          <Home className="w-4 h-4 mr-2" />
          Ir para o Dashboard
        </Link>
      </div>
    </div>
  )
}
