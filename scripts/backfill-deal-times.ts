#!/usr/bin/env tsx
// =============================================================
// Backfill: start_time + end_time em ploomes_deals
// =============================================================
// Uso: npx tsx scripts/backfill-deal-times.ts
//
// Lê todos os deals nos stages Fechamento (60004416) e
// Assinando Contrato (60056754) com status Em aberto,
// busca os campos de horário na API Ploomes (OtherProperties)
// e atualiza ploomes_deals.start_time / end_time.
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   PLOOMES_USER_KEY (ou configurado em ploomes_config no banco).
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const TARGET_STAGES = [60004416, 60056754] // Fechamento, Assinando Contrato

// ── Ploomes field keys para horários ────────────────────────
const FK_START = 'deal_30E82221-76E2-4882-BB33-F7FB96AC861E'
const FK_END   = 'deal_FD135180-0186-46F1-8AB7-F0E1C02171B3'

// ── Parser de horário (mesmo que field-mapping.ts) ──────────
function parseTime(dtValue: string): string | null {
  const match = /T(\d{2}:\d{2})/.exec(dtValue)
  return match?.[1] ?? null
}

// ── Busca deal completo na API Ploomes ───────────────────────
async function fetchDealFromPloomes(
  dealId: number,
  userKey: string,
): Promise<{ start_time: string | null; end_time: string | null }> {
  const BASE_URL = process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/'
  const url = `${BASE_URL.replace(/\/$/, '')}/Deals?$filter=Id eq ${dealId}&$select=Id&$expand=OtherProperties`

  const res = await fetch(url, {
    headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw new Error(`Ploomes API ${res.status} para deal ${dealId}`)
  }

  const json = (await res.json()) as { value?: Array<{ OtherProperties?: Array<{ FieldKey: string; DateTimeValue?: string }> }> }
  const deal = json.value?.[0]
  if (!deal) return { start_time: null, end_time: null }

  const props = deal.OtherProperties ?? []
  const startProp = props.find((p) => p.FieldKey === FK_START)
  const endProp   = props.find((p) => p.FieldKey === FK_END)

  return {
    start_time: startProp?.DateTimeValue ? parseTime(startProp.DateTimeValue) : null,
    end_time:   endProp?.DateTimeValue   ? parseTime(endProp.DateTimeValue)   : null,
  }
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
    console.error('❌ PLOOMES_USER_KEY é obrigatório para buscar OtherProperties da API.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 1. Buscar deals nos stages alvo
  const { data: deals, error } = await supabase
    .from('ploomes_deals')
    .select('id, ploomes_deal_id, start_time, end_time')
    .in('stage_id', TARGET_STAGES)
    .eq('status_id', 1)

  if (error) {
    console.error('❌ Erro ao buscar deals:', error.message)
    process.exit(1)
  }

  console.info(`📊 ${deals.length} deals para backfill (stages ${TARGET_STAGES.join(', ')}, status Em aberto)`)

  let success = 0, skipped = 0, failed = 0

  for (const deal of deals) {
    try {
      // Pular deals que já têm ambos os horários preenchidos
      if (deal.start_time && deal.end_time) {
        skipped++
        continue
      }

      const { start_time, end_time } = await fetchDealFromPloomes(deal.ploomes_deal_id, userKey)

      if (!start_time && !end_time) {
        console.warn(`⚠️  Deal ${deal.ploomes_deal_id} — sem horário preenchido no Ploomes (regra violada ou campo vazio)`)
        skipped++
        // Rate limit: 600ms entre requisições (~100 req/min)
        await new Promise((r) => setTimeout(r, 600))
        continue
      }

      const { error: updError } = await supabase
        .from('ploomes_deals')
        .update({ start_time, end_time })
        .eq('ploomes_deal_id', deal.ploomes_deal_id)

      if (updError) throw updError

      console.info(`✅ Deal ${deal.ploomes_deal_id} — start=${start_time ?? '—'} end=${end_time ?? '—'}`)
      success++
    } catch (e) {
      console.error(`❌ Deal ${deal.ploomes_deal_id}:`, e instanceof Error ? e.message : e)
      failed++
    }

    // Rate limit: 600ms entre requisições (~100 req/min)
    await new Promise((r) => setTimeout(r, 600))
  }

  console.info(`\n── Resultado ───────────────────────────────────`)
  console.info(`✅ Atualizados : ${success}`)
  console.info(`⚠️  Sem horário : ${skipped}`)
  console.info(`❌ Erros       : ${failed}`)
  console.info(`────────────────────────────────────────────────`)
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
