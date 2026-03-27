'use client'

import { useState, useEffect } from 'react'

/**
 * Detecta se o browser está online ou offline.
 * Usa navigator.onLine como estado inicial e eventos window online/offline.
 * SSR-safe: inicia como true no servidor.
 */
export function useOnlineStatus() {
  // Sempre inicia como true para garantir que server e client renderizem o mesmo
  // HTML inicial. O valor real de navigator.onLine é aplicado no useEffect,
  // após a hidratação, evitando mismatch quando o browser está offline.
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Sincroniza com o estado real assim que o componente monta
    setIsOnline(navigator.onLine)

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
