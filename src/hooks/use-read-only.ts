'use client'

import { useImpersonateStore } from '@/stores/impersonate-store'

/**
 * Retorna `true` quando o admin está no modo "Ver como" (impersonate).
 *
 * Uso:
 *   const isReadOnly = useIsReadOnly()
 *   <Button disabled={isReadOnly || isPending}>Salvar</Button>
 *
 * Quando `true`, todas as ações de mutação (criar/editar/excluir) devem ser
 * desabilitadas — o impersonate é estritamente somente leitura.
 */
export function useIsReadOnly(): boolean {
  return useImpersonateStore((s) => s.isImpersonating)
}
