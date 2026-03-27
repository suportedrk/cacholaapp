/**
 * IndexedDB wrapper — armazenamento offline do Cachola OS.
 * Usa a lib `idb` (4KB) para API Promise-based sobre IndexedDB nativo.
 * Só disponível no browser — qualquer chamada server-side lança erro.
 */

import { openDB, type DBSchema } from 'idb'

// ─────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────

export type OfflinePendingItem = {
  id: string           // checklist_item.id
  checklistId: string
  status: string       // ChecklistItemStatus
  notes: string | null
  updatedAt: string    // ISO timestamp
  synced: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any

interface CacholaOfflineDB extends DBSchema {
  /** Snapshot completo do checklist — para leitura offline */
  checklists: {
    key: string
    value: { id: string; data: AnyJson; cachedAt: string }
  }
  /** Itens editados offline aguardando sync com Supabase */
  checklist_items: {
    key: string
    value: OfflinePendingItem
    indexes: { 'by-checklist': string }
  }
  /** Eventos do calendário — somente leitura offline */
  calendar_events: {
    key: string  // 'dateFrom::dateTo'
    value: { key: string; data: AnyJson[]; cachedAt: string }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────

let _db: ReturnType<typeof openDB<CacholaOfflineDB>> | null = null

export function getOfflineDb() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB não disponível no servidor'))
  }
  if (!_db) {
    _db = openDB<CacholaOfflineDB>('cachola-os-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('checklists')) {
          db.createObjectStore('checklists', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('checklist_items')) {
          const s = db.createObjectStore('checklist_items', { keyPath: 'id' })
          s.createIndex('by-checklist', 'checklistId')
        }
        if (!db.objectStoreNames.contains('calendar_events')) {
          db.createObjectStore('calendar_events', { keyPath: 'key' })
        }
      },
    })
  }
  return _db
}
