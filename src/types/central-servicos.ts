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

// ============================================================
// Agenda de Contatos (Bloco C1)
// ============================================================

/** Unidades possíveis de um contato (apenas informativo — nunca trava de segurança). */
export const CONTATO_UNIDADES = ['geral', 'pinheiros', 'moema'] as const

export type ContatoUnidade = (typeof CONTATO_UNIDADES)[number]

export const CONTATO_UNIDADE_LABELS: Record<ContatoUnidade, string> = {
  geral: 'Geral',
  pinheiros: 'Pinheiros',
  moema: 'Moema',
}

export interface CentralServicosContato {
  id: string
  nome: string
  setor: string | null
  cargo: string | null
  unidade: ContatoUnidade
  email: string | null
  telefone: string | null
  foto_path: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
  created_by: string | null
}

/** Payload do formulário de criação/edição de contato. */
export interface ContatoFormInput {
  nome: string
  setor: string | null
  cargo: string | null
  unidade: ContatoUnidade
  email: string | null
  telefone: string | null
  foto_path: string | null
  ativo: boolean
}

/** Bucket privado das fotos dos contatos. */
export const CONTATOS_BUCKET = 'central-servicos-contatos'

/**
 * Monta o link de WhatsApp a partir de um telefone.
 * Remove tudo que não for dígito; se não começar com 55, prefixa 55.
 * Retorna null se não houver dígitos suficientes.
 */
export function buildWhatsappUrl(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  let digits = telefone.replace(/\D/g, '')
  if (digits.length < 8) return null
  if (!digits.startsWith('55')) digits = `55${digits}`
  return `https://wa.me/${digits}`
}
