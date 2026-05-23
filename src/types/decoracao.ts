// ============================================================
// TIPOS — Módulo Decoração (Temas e Forminhas)
// Tabelas globais (sem unit_id) — catálogo padrão da empresa.
// ============================================================

export interface DecoracaoForminhaCor {
  id: string
  numero: number
  nome: string
  cor_hex: string | null
  foto_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface DecoracaoTema {
  id: string
  nome: string
  categoria: string | null
  ativo: boolean
  foto_url: string | null
  observacoes: string | null
  personalizado: boolean
  decoradora_externa: boolean
  created_at: string
  updated_at: string
}

/** Cor de forminha resumida — usada para exibir as bolinhas de um tema. */
export interface TemaForminhaResumo {
  id: string
  numero: number
  nome: string
  cor_hex: string | null
}

/** Tema com as cores de forminha vinculadas, resolvidas via join. */
export interface DecoracaoTemaComForminhas extends DecoracaoTema {
  forminhas: TemaForminhaResumo[]
}

export interface ForminhaCorFormInput {
  nome: string
  cor_hex: string | null
  ativo: boolean
}

export interface ForminhaCorCreateInput extends ForminhaCorFormInput {
  numero: number
}

export interface TemaFormInput {
  nome: string
  categoria: string | null
  ativo: boolean
  observacoes: string | null
  personalizado: boolean
  decoradora_externa: boolean
  /** IDs das cores de forminha vinculadas ao tema. */
  forminha_cor_ids: string[]
}

// ── Balões ───────────────────────────────────────────────────

export interface DecoracaoBalaoModelo {
  id: string
  nome: string
  categoria: string | null
  custo: number | null
  valor_venda: number | null
  ativo: boolean
  observacoes: string | null
  foto_url: string | null
  created_at: string
  updated_at: string
}

export interface BalaoModeloFormInput {
  nome: string
  categoria: string | null
  custo: number | null
  valor_venda: number | null
  ativo: boolean
  observacoes: string | null
}
