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
  foto_url?: string | null
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
  foto_url?: string | null
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
  foto_url?: string | null
}

// ── Fornecedores de decoração ─────────────────────────────────

export interface DecoracaoFornecedor {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  fornece: string | null
  documento: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FornecedorFormInput {
  nome: string
  telefone: string | null
  email: string | null
  fornece: string | null
  documento: string | null
  observacoes: string | null
  ativo: boolean
}

// ── Ordens de serviço (OS de balões) ─────────────────────────

export type DecoracaoOSItemStatus = 'aguardando_prova' | 'aprovada' | 'realizada'

/** Status agregado da OS (derivado dos itens): o menos avançado entre eles. */
export type DecoracaoOSStatusAgregado = DecoracaoOSItemStatus | 'vazia'

/** Item da OS — preços NÃO são gravados, calculados ao vivo a partir do modelo. */
export interface DecoracaoOSItem {
  id: string
  os_id: string
  balao_modelo_id: string | null
  quantidade: number
  observacoes: string | null
  status: DecoracaoOSItemStatus
  ordem: number
  created_at: string
  updated_at: string
}

/** Resumo mínimo de uma festa para exibir no vínculo OS ↔ Festa. */
export interface EventSummaryForOS {
  id: string
  date: string            // YYYY-MM-DD
  start_time: string      // HH:MM:SS
  end_time: string        // HH:MM:SS
  client_name: string
  birthday_person: string | null
  theme: string | null
  status: string
  unit_id: string
  unit_slug: string | null
}

/** Ordem de serviço (a "festa") — sem coluna de status; status agregado vem dos itens. */
export interface DecoracaoOS {
  id: string
  unit_id: string
  data_festa: string | null
  hora_festa: string | null
  tema: string
  tema_id: string | null
  event_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** OS com itens já resolvidos e modelos hidratados para cálculo ao vivo. */
export interface DecoracaoOSItemComModelo extends DecoracaoOSItem {
  modelo: Pick<DecoracaoBalaoModelo, 'id' | 'nome' | 'custo' | 'valor_venda'> | null
}

export interface DecoracaoOSComItens extends DecoracaoOS {
  itens: DecoracaoOSItemComModelo[]
}

/** Input de item no formulário (id ausente = novo item). */
export interface DecoracaoOSItemFormInput {
  id?: string
  balao_modelo_id: string | null
  quantidade: number
  observacoes: string | null
  status: DecoracaoOSItemStatus
  ordem: number
}

export interface DecoracaoOSFormInput {
  unit_id: string
  data_festa: string | null   // YYYY-MM-DD
  hora_festa: string | null   // HH:MM
  tema: string
  tema_id: string | null
  event_id: string | null
  itens: DecoracaoOSItemFormInput[]
}
