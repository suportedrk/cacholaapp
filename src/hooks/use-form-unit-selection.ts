'use client'

import { useUnitStore } from '@/stores/unit-store'

/**
 * Helper compartilhado para formulários que precisam de uma unidade explícita
 * quando o seletor global está em "Todas as unidades" (activeUnitId === null).
 *
 * Regra de precedência (Fase 4c — QA-1): a escolha de unidade feita NO formulário
 * é PEGAJOSA. Uma vez que `formUnitId` está definido, ela tem precedência sobre o
 * seletor global e NÃO é sobrescrita se o `activeUnitId` do store mudar depois.
 * Sem isso, trocar o seletor global do header com o formulário aberto fazia o
 * registro ser gravado na unidade errada, em silêncio (ex.: equipamento escolhido
 * para Pinheiros no banner acabava criado em Moema).
 *
 * Comportamento:
 * - Com escolha no formulário (`formUnitId` definido): `effectiveUnitId = formUnitId`
 *   sempre; `requiresUnitSelection = true` para manter o banner/campo visível com a
 *   unidade travada.
 * - Sem escolha no formulário: segue o seletor global. Em "Todas" →
 *   `requiresUnitSelection = true` e `effectiveUnitId = null` (precisa escolher);
 *   numa unidade específica → `requiresUnitSelection = false` e usa o store.
 *
 * Obs.: `requiresUnitSelection` significa "o formulário gerencia a própria unidade"
 * (precisa escolher OU já tem uma escolha travada), não apenas "ainda falta escolher".
 *
 * @param formUnitId Valor escolhido no campo/banner do formulário (null/'' antes da escolha).
 */
export function useFormUnitSelection(formUnitId: string | null | undefined) {
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const userUnits    = useUnitStore((s) => s.userUnits)

  const hasFormChoice = !!formUnitId && formUnitId.length > 0

  // O formulário gerencia a unidade quando o seletor global está em "Todas"
  // OU quando o usuário já fez uma escolha explícita (que mantém o banner travado).
  const requiresUnitSelection = activeUnitId === null || hasFormChoice

  // A escolha explícita do formulário SEMPRE vence o seletor global do store.
  const effectiveUnitId = hasFormChoice ? formUnitId! : activeUnitId

  return {
    requiresUnitSelection,
    effectiveUnitId,
    availableUnits: userUnits,
  }
}
