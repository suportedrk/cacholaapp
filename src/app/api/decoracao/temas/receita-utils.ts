/**
 * Sanitização do payload da receita do tema (decoracao_tema_itens).
 * Compartilhado entre POST (criar) e PATCH (editar). Filtra linhas
 * inválidas e normaliza tipos antes de mandar pro RPC update_tema_receita.
 */

interface ReceitaBodyItem {
  variacao_id?: string
  quantidade?: number
  ordem?: number
}

export interface ReceitaItemSanitized {
  variacao_id: string
  quantidade: number
  ordem: number
}

/**
 * Recebe o `receita` cru do body e devolve só as linhas válidas
 * (variacao_id string não-vazio, quantidade inteira >= 1). Dedup por
 * variacao_id mantendo a última ocorrência. `ordem` reindexada 0..n.
 */
export function sanitizeReceita(raw: unknown): ReceitaItemSanitized[] {
  if (!Array.isArray(raw)) return []

  const byVariacao = new Map<string, ReceitaItemSanitized>()

  for (const item of raw as ReceitaBodyItem[]) {
    const variacaoId = typeof item?.variacao_id === 'string' ? item.variacao_id.trim() : ''
    if (!variacaoId) continue

    const quantidade = Math.floor(Number(item?.quantidade))
    if (!Number.isFinite(quantidade) || quantidade < 1) continue

    byVariacao.set(variacaoId, { variacao_id: variacaoId, quantidade, ordem: 0 })
  }

  return [...byVariacao.values()].map((it, idx) => ({ ...it, ordem: idx }))
}
