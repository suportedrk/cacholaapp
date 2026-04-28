'use client'

import { Eye, X } from 'lucide-react'
import { useImpersonateStore } from '@/stores/impersonate-store'
import { useStopImpersonate } from '@/hooks/use-impersonate'
import { useUnitStore } from '@/stores/unit-store'
import { ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/types/database.types'

/**
 * Banner fixo no topo que aparece somente durante o modo "Ver como".
 *
 * Visual: barra âmbar (z-60) com nome/role/unidade do impersonado à esquerda
 * e botão "Voltar" à direita.
 *
 * O z-index [60] fica acima da sidebar (z-40) e do overlay (z-30).
 */
export function ImpersonateBanner() {
  const { isImpersonating, impersonatedProfile } = useImpersonateStore()
  const { activeUnit } = useUnitStore()
  const stopImpersonate = useStopImpersonate()

  if (!isImpersonating || !impersonatedProfile) return null

  const roleLabel = ROLE_LABELS[impersonatedProfile.role as UserRole] ?? impersonatedProfile.role
  const unitName = activeUnit?.name ?? null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-10 sm:h-14 bg-amber-500 dark:bg-amber-600 flex items-center px-3 sm:px-4 gap-3"
      role="status"
      aria-live="polite"
    >
      {/* Ícone + bloco de texto */}
      <Eye className="w-4 h-4 text-white shrink-0" aria-hidden="true" />

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-sm font-medium text-white truncate">
          <span className="hidden sm:inline">Visualizando como </span>
          <span className="font-semibold">{impersonatedProfile.name}</span>
          <span className="text-white/80">
            {' '}({roleLabel}
            {unitName ? ` — ${unitName}` : ''})
          </span>
        </p>
        <p className="sm:hidden text-xs text-white/80 mt-0.5 truncate">
          ⚠️ Modo visualização: apenas menus e permissões. Dados são do seu acesso.
        </p>
        <p className="hidden sm:block text-xs text-white/80 mt-0.5 truncate">
          ⚠️ Simulação visual apenas — os menus e botões refletem o que este usuário vê, mas os dados mostrados continuam sendo os seus.
        </p>
      </div>

      {/* Botão voltar */}
      <button
        onClick={stopImpersonate}
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
