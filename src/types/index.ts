// ============================================================
// TIPOS GLOBAIS — Cachola OS
// ============================================================

// Re-exports dos módulos de tipos
export type * from './database.types'
export type * from './permissions'

// ============================================================
// TIPOS UTILITÁRIOS
// ============================================================

/** Resposta paginada genérica */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Estado de operação assíncrona */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

/** Opção de select configurável */
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}
