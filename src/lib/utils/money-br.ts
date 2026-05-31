/**
 * Helpers de moeda em formato brasileiro (ponto = milhar, vírgula = decimal).
 * Compartilhado entre os editores de Decoração (balões e itens).
 */

/**
 * Converte uma string em formato brasileiro para number.
 * "1.000,00" → 1000, "3.200" → 3200, "80" → 80, "" → null.
 * Se já vier number, devolve como está (defensivo).
 */
export function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null

  const cleaned = raw.replace(/[^0-9,.\-]/g, '')
  if (!cleaned) return null

  // BR: remove TODOS os pontos (separador de milhar), troca vírgula por ponto (decimal)
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Formata um number para exibição BR com 2 casas. null → string vazia. */
export function moneyDisplay(v: number | null): string {
  if (v === null) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
