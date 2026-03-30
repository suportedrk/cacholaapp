// ─────────────────────────────────────────────────────────────
// CPF / CNPJ — Formatting, masking, validation
// ─────────────────────────────────────────────────────────────

/** Remove all non-digit characters */
function digits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Format raw digits as CPF: 000.000.000-00 */
export function formatCPF(value: string): string {
  const d = digits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

/** Format raw digits as CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(value: string): string {
  const d = digits(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

/**
 * Progressive mask: auto-detects CPF vs CNPJ based on digit count.
 * Pass this as the `onChange` value transformer for document inputs.
 */
export function maskDocument(value: string): string {
  const d = digits(value)
  if (d.length <= 11) return formatCPF(d)
  return formatCNPJ(d)
}

/** Validate CPF using the standard digit verification algorithm */
export function validateCPF(value: string): boolean {
  const d = digits(value)
  if (d.length !== 11) return false
  // Reject all-same-digit sequences
  if (/^(\d)\1{10}$/.test(d)) return false

  const sum1 = Array.from({ length: 9 }, (_, i) => Number(d[i]) * (10 - i)).reduce(
    (a, b) => a + b,
    0
  )
  const rem1 = (sum1 * 10) % 11
  const check1 = rem1 >= 10 ? 0 : rem1
  if (check1 !== Number(d[9])) return false

  const sum2 = Array.from({ length: 10 }, (_, i) => Number(d[i]) * (11 - i)).reduce(
    (a, b) => a + b,
    0
  )
  const rem2 = (sum2 * 10) % 11
  const check2 = rem2 >= 10 ? 0 : rem2
  return check2 === Number(d[10])
}

/** Validate CNPJ using the standard digit verification algorithm */
export function validateCNPJ(value: string): boolean {
  const d = digits(value)
  if (d.length !== 14) return false
  // Reject all-same-digit sequences
  if (/^(\d)\1{13}$/.test(d)) return false

  const calcDigit = (slice: string, weights: number[]): number => {
    const sum = slice
      .split('')
      .reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0)
    const rem = sum % 11
    return rem < 2 ? 0 : 11 - rem
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const check1 = calcDigit(d.slice(0, 12), w1)
  if (check1 !== Number(d[12])) return false

  const check2 = calcDigit(d.slice(0, 13), w2)
  return check2 === Number(d[13])
}

// ─────────────────────────────────────────────────────────────
// Document expiry helpers
// ─────────────────────────────────────────────────────────────

export type DocExpiryStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry'

export interface DocExpiryInfo {
  status: DocExpiryStatus
  /** Days remaining (positive = future, negative = past, null = no expiry) */
  daysRemaining: number | null
}

/**
 * Compute the expiry status of a document.
 * @param expiresAt ISO date string or null
 * @param warnDays  Days before expiry to start warning (default 30)
 */
export function getDocumentExpiryStatus(
  expiresAt: string | null | undefined,
  warnDays = 30
): DocExpiryInfo {
  if (!expiresAt) return { status: 'no_expiry', daysRemaining: null }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(expiresAt)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) return { status: 'expired', daysRemaining }
  if (daysRemaining <= warnDays) return { status: 'expiring_soon', daysRemaining }
  return { status: 'valid', daysRemaining }
}

// ─────────────────────────────────────────────────────────────
// Currency formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a numeric value as Brazilian Real currency.
 * @example formatCurrency(1500) → "R$ 1.500,00"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Parse a Brazilian Real formatted string back to a number.
 * @example parseCurrency("R$ 1.500,00") → 1500
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─────────────────────────────────────────────────────────────
// Phone formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a Brazilian phone number.
 * Handles both 10-digit (landline) and 11-digit (mobile) numbers.
 * @example formatPhone("11987654321") → "(11) 98765-4321"
 * @example formatPhone("1133334444")  → "(11) 3333-4444"
 */
export function formatPhone(value: string): string {
  const d = digits(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
