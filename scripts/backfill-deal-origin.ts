#!/usr/bin/env tsx
// =============================================================
// Backfill: origin_id + origin_name em ploomes_deals
// =============================================================
// Uso:
//   npx tsx scripts/backfill-deal-origin.ts --dry-run   # só conta, não altera
//   npx tsx scripts/backfill-deal-origin.ts              # aplica de fato
//
// Lógica:
//   Busca os deals dos últimos 12 meses com $expand=Origin e
//   atualiza os campos origin_id / origin_name em ploomes_deals.
//   Deals sem OriginId são ignorados (NULL já é o padrão).
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   PLOOMES_USER_KEY, PLOOMES_PIPELINE_ID (opcional, default 60000636)
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN    = process.argv.includes('--dry-run')
const BASE_URL   = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const PIPELINE_ID = parseInt(process.env.PLOOMES_PIPELINE_ID ?? '60000636', 10)
const PAGE_SIZE  = 100
const RATE_LIMIT_MS = 100

// 12 meses atrás — Ploomes exige DateTimeOffset com timezone (ex: 2025-05-02T00:00:00-03:00)
const CUTOFF_DATE = new Date()
CUTOFF_DATE.setMonth(CUTOFF_DATE.getMonth() - 12)
const CUTOFF_ISO = CUTOFF_DATE.toISOString().substring(0, 10) + 'T00:00:00-03:00'

// ── Ploomes API ───────────────────────────────────────────────

interface PloomesOrigin { Id: number; Name: string }
interface PloomesDealOrigin {
  Id: number
  OriginId?: number
  Origin?: PloomesOrigin
}

async function fetchDealsWithOrigin(userKey: string): Promise<PloomesDealOrigin[]> {
  const all: PloomesDealOrigin[] = []
  let skip = 0
  let page = 0

  console.info(`📅 Filtro: CreateDate >= ${CUTOFF_ISO}`)
  console.info(`📦 Pipeline: ${PIPELINE_ID}\n`)

  while (true) {
    const qs = [
      `$filter=PipelineId eq ${PIPELINE_ID} and CreateDate ge ${CUTOFF_ISO}`,
      `$select=Id,OriginId`,
      `$expand=Origin($select=Id,Name)`,
      `$top=${PAGE_SIZE}`,
      `$skip=${skip}`,
      `$orderby=CreateDate desc`,
    ].join('&')

    const res = await fetch(`${BASE_URL}/Deals?${qs}`, {
      headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) throw new Error(`Ploomes API ${res.status} na página ${page} (skip=${skip})`)

    const json = (await res.json()) as { value?: PloomesDealOrigin[] }
    const chunk = json.value ?? []
    all.push(...chunk)

    page++
    console.info(`  · página ${page} (skip=${skip}): ${chunk.length} deals`)
    if (chunk.length < PAGE_SIZE) break
    skip += PAGE_SIZE

    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  return all
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const userKey     = process.env.PLOOMES_USER_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
    process.exit(1)
  }
  if (!userKey) {
    console.error('❌ PLOOMES_USER_KEY é obrigatório.')
    process.exit(1)
  }

  if (DRY_RUN) {
    console.info('🔍 MODO DRY-RUN — nenhuma alteração será feita no banco.\n')
  } else {
    console.info('🚀 MODO REAL — atualizando ploomes_deals no banco.\n')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── 1. Buscar deals da API Ploomes ───────────────────────────
  console.info(`── Etapa 1: Buscando deals com Origin (últimos 12 meses)…`)
  const deals = await fetchDealsWithOrigin(userKey)

  const withOrigin    = deals.filter((d) => d.OriginId != null)
  const withoutOrigin = deals.filter((d) => d.OriginId == null)

  console.info(`\n📊 Total buscado        : ${deals.length} deals`)
  console.info(`✅ Com OriginId          : ${withOrigin.length}`)
  console.info(`⚪ Sem OriginId (NULL)   : ${withoutOrigin.length}`)
  const pct = deals.length > 0 ? ((withOrigin.length / deals.length) * 100).toFixed(1) : '0.0'
  console.info(`📈 Cobertura             : ${pct}%`)

  // Mostrar distribuição de origens (sempre, mesmo no dry-run)
  const originCounts: Record<string, { id: number; count: number }> = {}
  for (const d of withOrigin) {
    const name = d.Origin?.Name ?? `ID ${d.OriginId}`
    if (!originCounts[name]) originCounts[name] = { id: d.OriginId!, count: 0 }
    originCounts[name].count++
  }
  console.info(`\n── Distribuição de origens:`)
  Object.entries(originCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, { id, count }]) =>
      console.info(`   [${id}] ${name}: ${count} deals`)
    )

  if (DRY_RUN) {
    console.info(`\n✅ Dry-run concluído — ${withOrigin.length} deals seriam atualizados.`)
    console.info(`   Execute sem --dry-run para aplicar as alterações.`)
    return
  }

  // ── 2. Atualizar ploomes_deals no banco ──────────────────────
  console.info(`\n── Etapa 2: Atualizando ploomes_deals…`)

  let updated = 0, skipped = 0, errors = 0

  for (const deal of withOrigin) {
    const { error } = await supabase
      .from('ploomes_deals')
      .update({
        origin_id:   deal.OriginId!,
        origin_name: deal.Origin?.Name ?? null,
      })
      .eq('ploomes_deal_id', deal.Id)

    if (error) {
      console.error(`❌ deal ${deal.Id}:`, error.message)
      errors++
    } else {
      updated++
    }
  }

  // Deals sem origin: registrar mas não alterar (NULL já é default)
  skipped = withoutOrigin.length

  console.info(`\n── Resultado ─────────────────────────────────────`)
  console.info(`✅ ploomes_deals atualizados : ${updated}`)
  console.info(`⚪ Sem OriginId (mantidos)   : ${skipped}`)
  console.info(`❌ Erros                      : ${errors}`)
  console.info(`\n✅ Backfill de origin concluído.`)
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
