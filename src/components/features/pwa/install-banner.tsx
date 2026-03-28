'use client'

import { Download, X } from 'lucide-react'
import { usePwaInstall } from '@/hooks/use-pwa-install'

export function InstallBanner() {
  const { showBanner, install, dismiss } = usePwaInstall()

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-scale-in">
      <div className="bg-card border border-border rounded-xl shadow-lg p-3.5 flex items-center gap-3">
        {/* Logo mini */}
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-bold text-lg shadow-sm">
          C
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">Cachola OS</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instale para acesso rápido
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={install}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shrink-0"
        >
          <Download className="w-3 h-3" />
          Instalar
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Dispensar instalação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
