// ============================================================
// TIPOS — Módulo Central de Serviços
// ============================================================

/** Categorias fixas dos links úteis (espelha o CHECK da migration 145). */
export const LINK_CATEGORIAS = [
  'comercial',
  'financeiro',
  'rh',
  'operacional',
  'bi_gestao',
  'ti_sistemas',
  'comunicacao',
  'outros',
] as const

export type LinkCategoria = (typeof LINK_CATEGORIAS)[number]

/** Rótulos em pt-BR para exibição (dropdown, filtros, badges). */
export const LINK_CATEGORIA_LABELS: Record<LinkCategoria, string> = {
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  rh: 'RH',
  operacional: 'Operacional',
  bi_gestao: 'BI & Gestão',
  ti_sistemas: 'TI & Sistemas',
  comunicacao: 'Comunicação',
  outros: 'Outros',
}

export interface CentralServicosLink {
  id: string
  nome: string
  descricao: string | null
  categoria: LinkCategoria
  url: string
  icone_url: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
  created_by: string | null
}

/** Payload do formulário de criação/edição. */
export interface LinkFormInput {
  nome: string
  descricao: string | null
  categoria: LinkCategoria
  url: string
  icone_url: string | null
  ativo: boolean
}

/** Filtro de status na listagem. */
export type LinkFiltroStatus = 'ativos' | 'todos'
