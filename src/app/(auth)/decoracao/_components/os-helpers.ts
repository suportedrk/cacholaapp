import type {
  DecoracaoOSItemStatus,
  DecoracaoOSStatusAgregado,
} from '@/types/decoracao'

export function formatBRLOuTraco(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

/** custo/venda do item ao vivo — null se sem modelo ou se modelo sem preço. */
export function calcItemValores(
  modelo: { custo?: number | null; valor_venda?: number | null } | null,
  qtd: number,
): { custo: number | null; venda: number | null } {
  const custo = modelo?.custo
  const venda = modelo?.valor_venda
  return {
    custo: custo != null ? custo * qtd : null,
    venda: venda != null ? venda * qtd : null,
  }
}

/** Total da OS — soma só os itens com valor (IFERROR(VLOOKUP) da planilha). */
export function calcTotalOS(
  itens: ReadonlyArray<{
    quantidade: number
    modelo: { valor_venda?: number | null } | null
  }>,
): number {
  return itens.reduce((sum, i) => {
    const v = calcItemValores(i.modelo, i.quantidade).venda
    return v != null ? sum + v : sum
  }, 0)
}

/** Status agregado da OS = status menos avançado entre os itens. */
export function statusAgregado(
  itens: ReadonlyArray<{ status: DecoracaoOSItemStatus }>,
): DecoracaoOSStatusAgregado {
  if (itens.length === 0) return 'vazia'
  if (itens.some((i) => i.status === 'aguardando_prova')) return 'aguardando_prova'
  if (itens.some((i) => i.status === 'aprovada')) return 'aprovada'
  return 'realizada'
}

export const STATUS_ITEM_LABEL: Record<DecoracaoOSItemStatus, string> = {
  aguardando_prova: 'Aguardando prova',
  aprovada: 'Aprovada',
  realizada: 'Realizada',
}

export const STATUS_AGREGADO_LABEL: Record<DecoracaoOSStatusAgregado, string> = {
  ...STATUS_ITEM_LABEL,
  vazia: 'Sem itens',
}

export const STATUS_AGREGADO_BADGE: Record<DecoracaoOSStatusAgregado, string> = {
  aguardando_prova: 'badge-yellow',
  aprovada: 'badge-blue',
  realizada: 'badge-green',
  vazia: 'badge-gray',
}

