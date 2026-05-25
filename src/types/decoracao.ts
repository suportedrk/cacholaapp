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

// ── Locais de guarda do estoque ──────────────────────────────

export interface DecoracaoLocal {
  id: string
  nome: string
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LocalFormInput {
  nome: string
  observacoes: string | null
  ativo: boolean
}

// ── Itens com variações (Bloco 2 do estoque) ─────────────────

export type DecoracaoItemTipo = 'proprio' | 'alugado'

export interface DecoracaoItemVariacao {
  id: string
  item_id: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  codigo: string
  ordem: number
  created_at: string
  updated_at: string
}

export interface DecoracaoItem {
  id: string
  nome: string
  tipo: DecoracaoItemTipo
  fornecedor_id: string | null
  foto_path: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Item com fornecedor resolvido e variações já carregadas. */
export interface DecoracaoItemComDetalhes extends DecoracaoItem {
  fornecedor_nome: string | null
  variacoes: DecoracaoItemVariacao[]
}

/** Resumo para listagem: foto, tipo, fornecedor, contagem de variações. */
export interface DecoracaoItemResumo extends DecoracaoItem {
  fornecedor_nome: string | null
  variacoes_count: number
}

/** Input de variação no editor (id ausente = nova; código gerado pelo banco). */
export interface VariacaoFormInput {
  id?: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  ordem: number
}

export interface ItemFormInput {
  nome: string
  tipo: DecoracaoItemTipo
  fornecedor_id: string | null
  foto_path: string | null
  observacoes: string | null
  ativo: boolean
  variacoes: VariacaoFormInput[]
}

// ── Estoque — saldo por variação × local (Bloco 3) ───────────

export interface DecoracaoEstoqueSaldo {
  id: string
  variacao_id: string
  local_id: string
  quantidade: number
  created_at: string
  updated_at: string
}

/** Saldo de uma variação num local, com nome do local resolvido. */
export interface EstoqueSaldoComLocal extends DecoracaoEstoqueSaldo {
  local_nome: string
}

/** Resumo de saldo de uma variação para exibir no editor do item (read-only). */
export interface EstoqueVariacaoResumo {
  variacao_id: string
  saldos: Record<string, number>
  locais: { id: string; nome: string }[]
  total: number
}

// ── Transferências entre locais (Bloco 4) ────────────────────

export type TransferenciaStatus = 'em_transito' | 'recebida' | 'cancelada'

export interface DecoracaoTransferencia {
  id: string
  origem_local_id: string
  destino_local_id: string
  status: TransferenciaStatus
  observacoes: string | null
  created_by: string | null
  recebido_por: string | null
  data_envio: string
  data_recebimento: string | null
  created_at: string
  updated_at: string
}

export interface DecoracaoTransferenciaItem {
  id: string
  transferencia_id: string
  variacao_id: string
  quantidade: number
  created_at: string
}

/** Linha da listagem: cabeçalho com nomes resolvidos e contagem de itens. */
export interface TransferenciaResumo extends DecoracaoTransferencia {
  origem_nome: string
  destino_nome: string
  created_by_nome: string | null
  recebido_por_nome: string | null
  itens_count: number
}

/** Item da transferência hidratado com variação + código + nome do item. */
export interface TransferenciaItemHidratado extends DecoracaoTransferenciaItem {
  variacao_codigo: string
  variacao_tamanho: string | null
  variacao_cor: string | null
  variacao_detalhe: string | null
  item_nome: string
}

/** Transferência completa (detalhe / impressão do romaneio). */
export interface TransferenciaComItens extends TransferenciaResumo {
  itens: TransferenciaItemHidratado[]
}

/** Input para criar transferência via RPC. */
export interface CriarTransferenciaInput {
  origem_local_id: string
  destino_local_id: string
  observacoes: string | null
  itens: { variacao_id: string; quantidade: number }[]
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
