'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOfflineDb, type OfflinePendingItem } from '@/lib/offline-db'
import type { ChecklistItemStatus } from '@/types/database.types'
import { useOnlineStatus } from './use-online-status'
import { toast } from 'sonner'

/**
 * Gerencia a fila de operações offline.
 * - Conta itens pendentes (synced: false) em IndexedDB
 * - Ao voltar online: envia todos os pending para Supabase, marca como synced
 * - Toast de sucesso após cada sync bem-sucedido
 */
export function useSyncManager() {
  const { isOnline } = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const countPending = useCallback(async () => {
    try {
      const db = await getOfflineDb()
      const all = await db.getAll('checklist_items')
      setPendingCount(all.filter((i) => !i.synced).length)
    } catch {
      // IDB indisponível (SSR ou erro de permissão)
    }
  }, [])

  const sync = useCallback(async () => {
    try {
      const db = await getOfflineDb()
      const all = await db.getAll('checklist_items')
      const pending = all.filter((i) => !i.synced) as OfflinePendingItem[]

      if (!pending.length) return

      setIsSyncing(true)
      const supabase = createClient()
      let synced = 0

      for (const item of pending) {
        try {
          const { error } = await supabase
            .from('checklist_items')
            .update({ status: item.status as ChecklistItemStatus, notes: item.notes })
            .eq('id', item.id)

          if (!error) {
            await db.put('checklist_items', { ...item, synced: true })
            synced++
          }
        } catch {
          // Falha pontual — tentará novamente no próximo sync
        }
      }

      if (synced > 0) {
        const label = synced === 1 ? 'alteração sincronizada' : 'alterações sincronizadas'
        toast.success(`${synced} ${label} com sucesso`)
      }
    } catch {
      // IDB ou rede indisponível
    } finally {
      setIsSyncing(false)
      await countPending()
    }
  }, [countPending])

  // Contar pendentes ao montar
  useEffect(() => { countPending() }, [countPending])

  // Sincronizar automaticamente ao voltar online
  useEffect(() => {
    if (isOnline) { sync() }
  }, [isOnline, sync])

  return { pendingCount, isSyncing, sync, countPending }
}
