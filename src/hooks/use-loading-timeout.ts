'use client'

import { useState, useEffect } from 'react'

/**
 * Safety net para queries presas em loading.
 * Se `isLoading` permanecer true por mais de `timeoutMs` (padrão 12s),
 * retorna `isTimedOut=true` para que a página exiba um botão "Tentar novamente"
 * ao invés de skeleton infinito.
 */
export function useLoadingTimeout(isLoading: boolean, timeoutMs = 12_000) {
  const [isTimedOut, setIsTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setIsTimedOut(false)
      return
    }
    const timer = setTimeout(() => setIsTimedOut(true), timeoutMs)
    return () => clearTimeout(timer)
  }, [isLoading, timeoutMs])

  return isTimedOut
}
