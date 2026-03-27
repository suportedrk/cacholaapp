'use client'

import { useState, useEffect } from 'react'

/**
 * Detecta se o browser está online ou offline.
 * Usa navigator.onLine como estado inicial e eventos window online/offline.
 * SSR-safe: inicia como true no servidor.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { isOnline }
}
