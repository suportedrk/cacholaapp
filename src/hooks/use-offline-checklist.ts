'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getOfflineDb } from '@/lib/offline-db'
import { useOnlineStatus } from './use-online-status'
import { useSyncManager } from './use-sync-manager'
import { useChecklist, useUpdateChecklistItem, useUpdateChecklistStatus } from './use-checklists'
import type { ChecklistWithItems, ChecklistItemStatus } from '@/types/database.types'

type LocalPatch = { status?: ChecklistItemStatus; notes?: string | null }

/**
 * Hook unificado que gerencia um checklist em modo online e offline.
 *
 * Online  → usa React Query (useChecklist) + Supabase mutations normais.
 * Offline → lê snapshot salvo em IndexedDB, aplica patches locais.
 *           Itens editados offline ficam com synced:false até voltar online.
 */
export function useOfflineChecklist(id: string) {
  const { isOnline } = useOnlineStatus()
  const syncMgr = useSyncManager()

  // ── Online hooks ─────────────────────────────────────────────
  const onlineQuery     = useChecklist(id)
  const updateItemMut   = useUpdateChecklistItem()
  const updateStatusMut = useUpdateChecklistStatus()

  // ── Offline: IDB ─────────────────────────────────────────────
  const [offlineChecklist, setOfflineChecklist] = useState<ChecklistWithItems | null>(null)
  const [isLoadingOffline, setIsLoadingOffline]  = useState(false)
  const [localPatches, setLocalPatches] = useState<Record<string, LocalPatch>>({})
  const patchesRef = useRef<Record<string, LocalPatch>>({})

  // Manter ref sincronizada com estado (evita stale closures nos callbacks)
  useEffect(() => { patchesRef.current = localPatches }, [localPatches])

  // ── Salvar snapshot quando online ────────────────────────────
  useEffect(() => {
    if (!isOnline || !onlineQuery.data) return
    getOfflineDb().then((db) =>
      db.put('checklists', {
        id,
        data: onlineQuery.data,
        cachedAt: new Date().toISOString(),
      })
    ).catch(() => {})
  }, [isOnline, onlineQuery.data, id])

  // ── Carregar do IDB ao ficar offline ────────────────────────
  useEffect(() => {
    if (isOnline) {
      // Ao voltar online limpa patches (Supabase é a fonte de verdade)
      setLocalPatches({})
      patchesRef.current = {}
      return
    }

    setIsLoadingOffline(true)
    getOfflineDb().then(async (db) => {
      const cached = await db.get('checklists', id)
      setOfflineChecklist(cached?.data ? (cached.data as ChecklistWithItems) : null)

      // Patches já salvos anteriormente (se usuário fechou e voltou offline)
      const pending = await db.getAllFromIndex('checklist_items', 'by-checklist', id)
      const patches: Record<string, LocalPatch> = {}
      for (const item of pending) {
        if (!item.synced) {
          patches[item.id] = { status: item.status as ChecklistItemStatus, notes: item.notes }
        }
      }
      setLocalPatches(patches)
      patchesRef.current = patches
    }).catch(() => {
      setOfflineChecklist(null)
    }).finally(() => setIsLoadingOffline(false))
  }, [isOnline, id])

  // ── Checklist mesclado (snapshot + patches locais) ───────────
  const checklist = useMemo<ChecklistWithItems | null | undefined>(() => {
    const base = isOnline ? onlineQuery.data : offlineChecklist
    if (!base) return base

    const patches = patchesRef.current
    if (!Object.keys(patches).length) return base

    return {
      ...base,
      checklist_items: base.checklist_items.map((item) => ({
        ...item,
        ...(patches[item.id] ?? {}),
      })),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, onlineQuery.data, offlineChecklist, localPatches])

  // ── Handlers ─────────────────────────────────────────────────

  const handleItemStatus = useCallback((itemId: string, status: ChecklistItemStatus, userId?: string) => {
    if (isOnline) {
      updateItemMut.mutate({ itemId, checklistId: id, status, userId })
      return
    }
    const patch = { status }
    setLocalPatches((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
    getOfflineDb().then((db) =>
      db.put('checklist_items', {
        id: itemId,
        checklistId: id,
        status,
        notes: patchesRef.current[itemId]?.notes ?? null,
        updatedAt: new Date().toISOString(),
        synced: false,
      })
    ).then(() => syncMgr.countPending()).catch(() => {})
  }, [isOnline, id, updateItemMut, syncMgr])

  const handleItemNotes = useCallback((itemId: string, notes: string, userId?: string) => {
    if (isOnline) {
      updateItemMut.mutate({ itemId, checklistId: id, notes, userId })
      return
    }
    setLocalPatches((prev) => ({ ...prev, [itemId]: { ...prev[itemId], notes } }))
    getOfflineDb().then((db) =>
      db.put('checklist_items', {
        id: itemId,
        checklistId: id,
        status: (patchesRef.current[itemId]?.status ?? 'pending') as string,
        notes,
        updatedAt: new Date().toISOString(),
        synced: false,
      })
    ).then(() => syncMgr.countPending()).catch(() => {})
  }, [isOnline, id, updateItemMut, syncMgr])

  // Upload de foto: apenas online (File não é serializável para IDB de forma prática)
  const handleItemPhoto = useCallback((itemId: string, file: File, userId?: string) => {
    if (isOnline) {
      updateItemMut.mutate({ itemId, checklistId: id, photoFile: file, userId })
    }
    // Offline: silencia — a UI deve desabilitar o botão neste caso
  }, [isOnline, id, updateItemMut])

  const handleFinish = useCallback(async () => {
    await updateStatusMut.mutateAsync({ id, status: 'completed' })
  }, [id, updateStatusMut])

  return {
    checklist,
    isLoading:   isOnline ? onlineQuery.isLoading : isLoadingOffline,
    isError:     isOnline ? onlineQuery.isError   : (!isLoadingOffline && !offlineChecklist),
    isOffline:   !isOnline,
    pendingCount: syncMgr.pendingCount,
    isSyncing:   syncMgr.isSyncing,
    isUpdating:  updateItemMut.isPending,
    isFinishing: updateStatusMut.isPending,
    handleItemStatus,
    handleItemNotes,
    handleItemPhoto,
    handleFinish,
  }
}
