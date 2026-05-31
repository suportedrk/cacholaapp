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
  /** Receita do tema — variações + quantidade da "mesa padrão". */
  receita: TemaReceitaInput[]
}

// ── Receita do tema (Bloco B — tema vira receita) ────────────

/** Linha da receita persistida (decoracao_tema_itens). */
export interface DecoracaoTemaItem {
  id: string
  tema_id: string
  variacao_id: string
  quantidade: number
  ordem: number
  created_at: string
  updated_at: string
}

/** Linha da receita hidratada para exibição (variação + item + código). */
export interface TemaReceitaLinha {
  variacao_id: string
  quantidade: number
  ordem: number
  codigo: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  item_nome: string
}

/** Item da receita no input de gravação (RPC update_tema_receita). */
export interface TemaReceitaInput {
  variacao_id: string
  quantidade: number
  ordem: number
}

/** Variação achatada do catálogo (itens ativos) para o seletor da receita. */
export interface VariacaoCatalogo {
  variacao_id: string
  codigo: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  item_nome: string
}

// ── Decoração da festa (Bloco C — festa puxa o tema) ─────────

/** Status do ciclo de vida da decoração da festa (Bloco D). */
export type FestaStatus = 'aberta' | 'encerrada'

/** Decoração vinculada a uma festa (1 por evento). */
export interface DecoracaoFesta {
  id: string
  event_id: string
  tema_id: string | null
  foto_path: string | null
  observacoes: string | null
  status: FestaStatus
  encerrada_em: string | null
  encerrada_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Linha da lista da festa persistida (decoracao_festa_itens). */
export interface DecoracaoFestaItem {
  id: string
  festa_decoracao_id: string
  variacao_id: string
  quantidade: number
  ordem: number
  qtd_ok: number
  qtd_quebrado: number
  qtd_perdido: number
  qtd_quarentena: number
  created_at: string
  updated_at: string
}

/**
 * Linha da lista hidratada para exibição (variação + item + código).
 * Os campos de desfecho são 0 antes do encerramento; após, somam a
 * `quantidade` da linha.
 */
export interface FestaItemLinha {
  variacao_id: string
  quantidade: number
  ordem: number
  codigo: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  item_nome: string
  qtd_ok: number
  qtd_quebrado: number
  qtd_perdido: number
  qtd_quarentena: number
}

/**
 * Decoração da festa completa para a seção do evento: cabeçalho +
 * tema (nome + foto modelo) + lista hidratada. `foto_path` é o override
 * da festa; quando null, a UI herda `tema_foto_url`.
 */
export interface FestaDecoracaoCompleta {
  id: string
  event_id: string
  tema_id: string | null
  tema_nome: string | null
  tema_foto_url: string | null
  foto_path: string | null
  observacoes: string | null
  status: FestaStatus
  encerrada_em: string | null
  itens: FestaItemLinha[]
}

/** Item da lista no input de gravação (RPC update_festa_decoracao_itens). */
export interface FestaItemInput {
  variacao_id: string
  quantidade: number
  ordem: number
}

// ── Encerramento da festa (Bloco D) ──────────────────────────

/** Desfecho de uma linha no encerramento. Soma dos quatro = quantidade. */
export interface EncerramentoLinhaInput {
  variacao_id: string
  qtd_ok: number
  qtd_quebrado: number
  qtd_perdido: number
  qtd_quarentena: number
  /** Motivo da quarentena (só relevante quando qtd_quarentena > 0). */
  motivo?: string | null
}

/** Aviso não-bloqueante: a baixa excedeu o saldo do local e zerou. */
export interface EncerramentoAviso {
  variacao_id: string
  baixa: number
  saldo_antes: number
}

/** Retorno do RPC encerrar_festa_decoracao. */
export interface EncerramentoResult {
  festa_id: string
  avisos: EncerramentoAviso[]
}

// ── Quarentena (Bloco D) ─────────────────────────────────────

export type QuarentenaStatus = 'pendente' | 'resolvido'
export type QuarentenaResolucao = 'consertado' | 'descartado'

/** Linha de quarentena persistida (decoracao_quarentena). */
export interface DecoracaoQuarentena {
  id: string
  variacao_id: string
  quantidade: number
  motivo: string
  origem_festa_id: string | null
  local_id: string
  status: QuarentenaStatus
  resolucao: QuarentenaResolucao | null
  resolvido_em: string | null
  resolvido_by: string | null
  created_at: string
  updated_at: string
}

/** Linha de quarentena hidratada para a tela (variação + festa + local). */
export interface QuarentenaResumo extends DecoracaoQuarentena {
  codigo: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  item_nome: string
  local_nome: string
  /** Identificação da festa de origem (cliente · data), quando houver. */
  origem_festa_label: string | null
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

export type DecoracaoItemOrigem = 'acervo' | 'fornecedor'

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
  origem: DecoracaoItemOrigem
  fornecedor_id: string | null
  categoria_id: string | null
  preco_custo: number
  preco_venda: number
  foto_path: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Item com fornecedor + categoria resolvidos e variações já carregadas. */
export interface DecoracaoItemComDetalhes extends DecoracaoItem {
  fornecedor_nome: string | null
  categoria_nome: string | null
  variacoes: DecoracaoItemVariacao[]
}

/** Resumo para listagem: foto, origem, categoria, fornecedor, contagem de variações. */
export interface DecoracaoItemResumo extends DecoracaoItem {
  fornecedor_nome: string | null
  categoria_nome: string | null
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
  origem: DecoracaoItemOrigem
  fornecedor_id: string | null
  categoria_id: string | null
  preco_custo: number
  preco_venda: number
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

// ── Categorias de item ───────────────────────────────────────

export interface DecoracaoCategoria {
  id: string
  nome: string
  ordem: number
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CategoriaFormInput {
  nome: string
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
