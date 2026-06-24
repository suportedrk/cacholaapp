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

/** Tipo do contato: pessoa individual ou grupo (lista de distribuição). */
export const CONTATO_TIPOS = ['pessoa', 'grupo'] as const

export type ContatoTipo = (typeof CONTATO_TIPOS)[number]

export const CONTATO_TIPO_LABELS: Record<ContatoTipo, string> = {
  pessoa: 'Pessoa',
  grupo: 'Grupo',
}

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
  tipo: ContatoTipo
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
  tipo: ContatoTipo
  setor: string | null
  cargo: string | null
  unidade: ContatoUnidade
  email: string | null
  telefone: string | null
  foto_path: string | null
  ativo: boolean
}

/** Linha de membro de grupo com o contato (pessoa) embutido via JOIN. */
export interface GrupoMembro {
  id: string
  membro: CentralServicosContato
}

// ============================================================
// Mural de Avisos (Bloco D)
// ============================================================

export const AVISO_CATEGORIAS = [
  'informativo',
  'manutencao',
  'ti',
  'rh',
  'operacional',
  'eventos',
] as const

export type AvisoCategoria = (typeof AVISO_CATEGORIAS)[number]

export const AVISO_CATEGORIA_LABELS: Record<AvisoCategoria, string> = {
  informativo: 'Informativo',
  manutencao: 'Manutenção',
  ti: 'TI',
  rh: 'RH',
  operacional: 'Operacional',
  eventos: 'Eventos',
}

export const AVISO_PRIORIDADES = ['normal', 'alta'] as const

export type AvisoPrioridade = (typeof AVISO_PRIORIDADES)[number]

export const AVISO_PRIORIDADE_LABELS: Record<AvisoPrioridade, string> = {
  normal: 'Normal',
  alta: 'Alta',
}

/** Anexo (PDF/imagem) de um aviso. O binário fica no bucket; aqui só a metadata. */
export interface CentralServicosAvisoAnexo {
  id: string
  aviso_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  created_by: string | null
}

/** Confirmação de leitura de um aviso (uma por usuário). */
export interface CentralServicosAvisoLeitura {
  usuario_id: string
  confirmado_em: string
  usuario?: { name: string } | null // nome do confirmante (embed; visível só para gestor)
}

export interface CentralServicosAviso {
  id: string
  titulo: string
  conteudo: string
  categoria: AvisoCategoria
  prioridade: AvisoPrioridade
  unidade: ContatoUnidade // mesmo conjunto geral/pinheiros/moema (rótulo informativo)
  publicado_em: string
  expira_em: string | null
  exige_confirmacao: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  anexos: CentralServicosAvisoAnexo[] // embed via PostgREST; [] quando não há anexos
  // Confirmações de leitura (embed). Pela RLS: usuário comum vê só a própria;
  // gestor (edit) vê todas. [] quando ninguém confirmou / quando não exige.
  leituras: CentralServicosAvisoLeitura[]
}

/** Payload do formulário de criação/edição de aviso. */
export interface AvisoFormInput {
  titulo: string
  conteudo: string
  categoria: AvisoCategoria
  prioridade: AvisoPrioridade
  unidade: ContatoUnidade
  publicado_em: string
  expira_em: string | null
  exige_confirmacao: boolean
}

/** Estado de vigência de um aviso (derivado no cliente para a UI). */
export type AvisoEstado = 'vigente' | 'futuro' | 'expirado'

export function avisoEstado(aviso: CentralServicosAviso, now = new Date()): AvisoEstado {
  if (new Date(aviso.publicado_em) > now) return 'futuro'
  if (aviso.expira_em && new Date(aviso.expira_em) <= now) return 'expirado'
  return 'vigente'
}

/** Bucket privado das fotos dos contatos. */
export const CONTATOS_BUCKET = 'central-servicos-contatos'

/** Bucket privado dos anexos do Mural de Avisos (PDF/imagem). */
export const AVISOS_ANEXOS_BUCKET = 'central-servicos-avisos-anexos'

/** Tipos MIME aceitos como anexo de aviso. */
export const AVISO_ANEXO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

/** Tamanho máximo de um anexo de aviso (10 MB). */
export const AVISO_ANEXO_MAX_BYTES = 10 * 1024 * 1024

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

/**
 * Link para discar (tel:) a partir de um telefone. Remove não-dígitos e prefixa
 * o código do Brasil (+55) quando ausente. Retorna null se não houver dígitos suficientes.
 */
export function buildTelUrl(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  let digits = telefone.replace(/\D/g, '')
  if (digits.length < 8) return null
  if (!digits.startsWith('55')) digits = `55${digits}`
  return `tel:+${digits}`
}

/**
 * Máscara de telefone brasileiro, formatando enquanto digita:
 * - 11 dígitos (celular): (XX) XXXXX-XXXX
 * - 10 dígitos (fixo):    (XX) XXXX-XXXX
 * Limita a 11 dígitos no total (DDD + número).
 */
export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  const ddd = digits.slice(0, 2)
  if (digits.length <= 2) return `(${ddd}`
  const resto = digits.slice(2)
  // Ponto do hífen: 5 para celular (8 dígitos após o DDD → 11 total), 4 para fixo.
  const split = digits.length > 10 ? 5 : 4
  if (resto.length <= split) return `(${ddd}) ${resto}`
  return `(${ddd}) ${resto.slice(0, split)}-${resto.slice(split)}`
}
