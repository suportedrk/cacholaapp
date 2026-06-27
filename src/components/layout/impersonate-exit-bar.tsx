'use client'

import { useEffect, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { useImpersonateStore } from '@/stores/impersonate-store'
import { IMPERSONATION_ACTIVE_FLAG } from '@/lib/auth/impersonation-constants'

/**
 * Barra de saída do modo "Ver como" para telas FORA do `<Providers>` (ex.: /403).
 *
 * Diferente do `ImpersonateBanner`, NÃO usa React Query (useQueryClient) — o /403 vive fora
 * do QueryClientProvider, então um hook de React Query ali quebraria. Aqui só lemos o store
 * (Zustand, disponível em qualquer client component) + o flag-cookie legível como fallback
 * (o store pode estar vazio num load fresco do /403, que não passa pelo AuthBootstrap).
 *
 * O "Voltar" chama DELETE para limpar o cookie httpOnly que os guards SSR leem e faz um
 * hard-nav para /dashboard (re-boota como o admin real).
 */
export function ImpersonateExitBar() {
  const { isImpersonating, impersonatedProfile, stopImpersonating } = useImpersonateStore()
  const [flagPresent, setFlagPresent] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlagPresent(document.cookie.includes(`${IMPERSONATION_ACTIVE_FLAG}=`))
  }, [])

  if (!isImpersonating && !flagPresent) return null

  const name = impersonatedProfile?.name ?? null

  const handleStop = async () => {
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' })
    } catch {
      // ignora — o cookie expira sozinho (TTL); o hard-nav abaixo já tira o admin do modo
    }
    stopImpersonating()
    window.location.href = '/dashboard'
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-10 sm:h-14 bg-amber-500 dark:bg-amber-600 flex items-center px-3 sm:px-4 gap-3"
      role="status"
      aria-live="polite"
    >
      <Eye className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0 text-sm font-medium text-white truncate">
        🔒 Modo &quot;Ver como&quot;{name ? ` — ${name}` : ''} (somente leitura)
      </p>
      <button
        onClick={handleStop}
        className="flex items-center gap-1.5 shrink-0 rounded px-2.5 py-1 text-sm font-medium bg-white text-amber-700 hover:bg-amber-50 transition-colors"
        aria-label="Encerrar modo visualização e voltar para minha conta"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Voltar para minha conta</span>
        <span className="sm:hidden">Voltar</span>
      </button>
    </div>
  )
}
