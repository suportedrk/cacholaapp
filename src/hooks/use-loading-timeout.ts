'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Safety net para queries presas em loading.
 * Se `isLoading` permanecer true por mais de `timeoutMs` (padrão 12s),
 * retorna `isTimedOut=true` para que a página exiba um botão "Tentar novamente".
 *
 * `retry()` verifica a sessão antes de recarregar: se expirada, redireciona
 * para /login em vez de recarregar em loop infinito.
 */
export function useLoadingTimeout(isLoading: boolean, timeoutMs = 12_000) {
  const [isTimedOut, setIsTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTimedOut(false)
      return
    }
    const timer = setTimeout(() => setIsTimedOut(true), timeoutMs)
    return () => clearTimeout(timer)
  }, [isLoading, timeoutMs])

  const retry = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
    } else {
      window.location.reload()
    }
  }, [])

  return { isTimedOut, retry }
}
