'use client'

import { useUnitStore } from '@/stores/unit-store'

/**
 * Helper compartilhado para formulários que precisam exigir uma unidade
 * quando o seletor global está em "Todas as unidades" (activeUnitId === null).
 *
 * Comportamento:
 * - Quando o seletor global está em uma unidade específica: usa o valor do store.
 *   `requiresUnitSelection = false` — o formulário esconde o campo e segue.
 * - Quando o seletor global está em "Todas": o formulário deve renderizar um
 *   campo de unidade obrigatório. `requiresUnitSelection = true`,
 *   `effectiveUnitId = formUnitId ?? null`.
 *
 * @param formUnitId Valor escolhido no campo do formulário (null/'' antes da escolha).
 */
export function useFormUnitSelection(formUnitId: string | null | undefined) {
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const userUnits    = useUnitStore((s) => s.userUnits)

  const requiresUnitSelection = activeUnitId === null
  const effectiveUnitId       = requiresUnitSelection
    ? (formUnitId && formUnitId.length > 0 ? formUnitId : null)
    : activeUnitId

  return {
    requiresUnitSelection,
    effectiveUnitId,
    availableUnits: userUnits,
  }
}
