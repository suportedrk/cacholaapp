// ============================================================
// Backfill de Vendas (Orders) do Ploomes
// ============================================================
// Importa todos os Orders de 2024-01-01 até hoje.
// Processa mês a mês (janelas de CreateDate) para contornar
// a limitação de $skip ≈ 4002 registros da API.
//
// Uso:
//   cd /opt/cacholaapp
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   PLOOMES_USER_KEY=... npx tsx scripts/backfill-orders.ts
//
// Rodar em background para evitar timeout de SSH:
//   nohup bash -c '...' > /tmp/backfill-orders.log 2>&1 &
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { syncOrders } from '../src/lib/ploomes/sync-orders'
import type { Database } from '../src/types/database.types'

// ── Config ───────────────────────────────────────────────────

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BACKFILL_START_YEAR  = 2024
const BACKFILL_START_MONTH = 1 // Janeiro

// ── Main ─────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
    process.exit(1)
  }

  if (!process.env.PLOOMES_USER_KEY) {
    console.error('❌ PLOOMES_USER_KEY é obrigatório')
    process.exit(1)
  }

  const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY)

  const now = new Date()
  console.log(`\n📊 Backfill de Orders — ${BACKFILL_START_YEAR}-${String(BACKFILL_START_MONTH).padStart(2, '0')}-01 até hoje (${now.toISOString().slice(0, 10)})`)
  console.log('─'.repeat(60))

  let totalOrders   = 0
  let totalProducts = 0
  let totalSkippedNoDeal   = 0
  let totalSkippedNullUnit = 0
  let totalErrors   = 0
  const failedMonths: string[] = []

  for (let year = BACKFILL_START_YEAR; year <= now.getFullYear(); year++) {
    const startMonth = (year === BACKFILL_START_YEAR) ? BACKFILL_START_MONTH : 1
    const endMonth   = (year === now.getFullYear())   ? now.getMonth() + 1   : 12

    for (let month = startMonth; month <= endMonth; month++) {
      const monthLabel = `${year}-${String(month).padStart(2, '0')}`
      const startDate  = new Date(year, month - 1, 1)
      const endDate    = new Date(year, month, 1) // primeiro dia do próximo mês (exclusive)

      process.stdout.write(`  📅 ${monthLabel}... `)

      try {
        const result = await syncOrders(supabase, { startDate, endDate })

        totalOrders          += result.ordersUpserted
        totalProducts        += result.productsUpserted
        totalSkippedNoDeal   += result.skippedNoDeal
        totalSkippedNullUnit += result.skippedNullUnit
        totalErrors          += result.errors

        const parts = [
          `orders=${result.ordersUpserted}`,
          `products=${result.productsUpserted}`,
        ]
        if (result.skippedNoDeal)   parts.push(`skipNoDeal=${result.skippedNoDeal}`)
        if (result.skippedNullUnit) parts.push(`skipNullUnit=${result.skippedNullUnit}`)
        if (result.errors)          parts.push(`errors=${result.errors}`)

        console.log(`✓ ${parts.join(' | ')} (${result.durationMs}ms)`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`❌ FALHA: ${msg}`)
        failedMonths.push(monthLabel)
        totalErrors++
      }

      // Pausa entre meses para não sobrecarregar a API
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log('✅ BACKFILL CONCLUÍDO')
  console.log(`   Orders importados:      ${totalOrders}`)
  console.log(`   Produtos importados:    ${totalProducts}`)
  console.log(`   Skipped (sem deal):     ${totalSkippedNoDeal}`)
  console.log(`   Skipped (unit=NULL):    ${totalSkippedNullUnit}`)
  console.log(`   Erros:                  ${totalErrors}`)

  if (failedMonths.length > 0) {
    console.log(`\n⚠️  Meses com falha (re-rodar individualmente): ${failedMonths.join(', ')}`)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
