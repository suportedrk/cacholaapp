'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function SplashScreen() {
  const [visible, setVisible] = useState(false)
  const [fading, setFading]   = useState(false)

  useEffect(() => {
    // Only show when running as installed PWA (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true

    if (!isStandalone) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true)

    // Start fade-out after 1.2 s
    const fadeTimer = setTimeout(() => setFading(true), 1200)
    // Remove from DOM after fade completes (400 ms)
    const hideTimer = setTimeout(() => setVisible(false), 1600)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-center',
        // Use inline style for the gradient so we don't need custom Tailwind token
        'transition-opacity duration-[400ms]',
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100',
      )}
      style={{
        background: 'linear-gradient(135deg, #7C8D78 0%, #E3DAD1 100%)',
        zIndex: 9999,
      }}
    >
      <div className="flex flex-col items-center gap-6 animate-scale-in">
        {/* Logo mark */}
        <div className="w-20 h-20 rounded-[1.5rem] bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl border border-white/30">
          <span className="text-white text-4xl font-bold select-none">C</span>
        </div>

        {/* Name */}
        <div className="text-center">
          <p className="text-white text-xl font-semibold tracking-tight">Cachola OS</p>
          <p className="text-white/70 text-sm mt-1">Gestão de Buffet Infantil</p>
        </div>

        {/* Spinner */}
        <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </div>
    </div>
  )
}
