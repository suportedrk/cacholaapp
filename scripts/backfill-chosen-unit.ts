#!/usr/bin/env tsx
// scripts/backfill-chosen-unit.ts
// Backfill cirúrgico: popula ploomes_orders.chosen_unit_id para pré-reservas ativas
// lendo o FieldKey order_EDD14E93-ECEB-4EEE-A362-80416A78E61D da API do Ploomes.
//
// Uso:
//   npx tsx scripts/backfill-chosen-unit.ts [--all] [--dry-run]
//
// Por padrão (sem --all): limita-se a orders de deals em stage 60004416 ou 60056754
// com event_date >= hoje (pré-reservas ativas). Use --all para processar todos os orders.
//
// --dry-run: exibe o que seria feito sem escrever no banco.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PLOOMES_USER_KEY       = process.env.PLOOMES_USER_KEY!

const ORDER_FIELD_KEY_CHOSEN_UNIT = 'order_EDD14E93-ECEB-4EEE-A362-80416A78E61D'
const DELAY_MS = 150 // ~120 req/min safe limit

// ─── Args ────────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const FULL_ALL = args.includes('--all')

// ─── Ploomes helper ───────────────────────────────────────────────────────────

async function fetchOrderOtherProperties(
  orderId: number,
  userKey: string,
): Promise<string | null> {
  const url =
    `https://api2.ploomes.com/Orders(${orderId})?$expand=OtherProperties`
  const res = await fetch(url, { headers: { 'User-Key': userKey } })
  if (!res.ok) {
    console.warn(`[Ploomes] Order ${orderId} → HTTP ${res.status}`)
    return null
  }
  const json = await res.json()
  const prop = (json.OtherProperties ?? []).find(
    (p: { FieldKey?: string }) => p.FieldKey === ORDER_FIELD_KEY_CHOSEN_UNIT,
  )
  return (prop?.ObjectValueName as string | null) ?? null
}

// ─── Unit resolver ────────────────────────────────────────────────────────────

async function resolveUnitId(
  supabase: ReturnType<typeof createClient<Database>>,
  unitName: string | null,
): Promise<string | null> {
  if (!unitName) return null
  const { data } = await (supabase as any)
    .from('ploomes_unit_mapping')
    .select('unit_id')
    .eq('ploomes_unit_name', unitName)
    .maybeSingle()
  return data?.unit_id ?? null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PLOOMES_USER_KEY) {
    console.error('Variáveis de ambiente faltando: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLOOMES_USER_KEY')
    process.exit(1)
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Determinar orders-alvo
  let query = (supabase as any)
    .from('ploomes_orders')
    .select('ploomes_order_id, deal_id, unit_id, chosen_unit_id')

  if (!FULL_ALL) {
    // Apenas pré-reservas ativas (stage 60004416 | 60056754, event_date >= hoje)
    const { data: activeDeals } = await (supabase as any)
      .from('ploomes_deals')
      .select('ploomes_deal_id')
      .in('stage_id', [60004416, 60056754])
      .eq('status_id', 1)
      .gte('event_date', new Date().toISOString().slice(0, 10))

    const dealIds: number[] = (activeDeals ?? []).map((d: { ploomes_deal_id: number }) => d.ploomes_deal_id)
    if (dealIds.length === 0) {
      console.info('[Backfill] Nenhuma pré-reserva ativa encontrada.')
      return
    }
    console.info(`[Backfill] ${dealIds.length} deal(s) de pré-reserva ativa: ${dealIds.join(', ')}`)
    query = query.in('deal_id', dealIds)
  }

  const { data: orders, error: ordersError } = await query
  if (ordersError) { console.error(ordersError); process.exit(1) }

  console.info(`[Backfill] ${orders.length} order(s) a processar. dry-run=${DRY_RUN}`)

  // 2. Processar cada order
  let updated = 0
  let skipped = 0
  let errors  = 0

  for (const order of orders) {
    await new Promise((r) => setTimeout(r, DELAY_MS))

    const chosenUnitName = await fetchOrderOtherProperties(order.ploomes_order_id, PLOOMES_USER_KEY)
    const chosenUnitId   = await resolveUnitId(supabase, chosenUnitName)

    if (!chosenUnitName) {
      console.info(`  Order ${order.ploomes_order_id} (deal ${order.deal_id}): campo vazio no Ploomes — skip`)
      skipped++
      continue
    }

    if (!chosenUnitId) {
      console.warn(`  Order ${order.ploomes_order_id}: unitName="${chosenUnitName}" sem mapeamento em ploomes_unit_mapping — skip`)
      skipped++
      continue
    }

    const diverge = order.unit_id !== chosenUnitId
    const action  = order.chosen_unit_id ? 'UPDATE' : 'INSERT'

    console.info(
      `  Order ${order.ploomes_order_id} (deal ${order.deal_id}): ` +
      `${chosenUnitName} → chosen_unit_id=${chosenUnitId} ${diverge ? '⚠️ DIVERGE de unit_id' : '(igual)'} [${action}]`,
    )

    if (!DRY_RUN) {
      const { error } = await (supabase as any)
        .from('ploomes_orders')
        .update({ chosen_unit_id: chosenUnitId })
        .eq('ploomes_order_id', order.ploomes_order_id)

      if (error) {
        console.error(`  ERRO ao atualizar order ${order.ploomes_order_id}:`, error.message)
        errors++
        continue
      }
    }

    updated++
  }

  // 3. Backfill events.unit_id para pré-reservas ativas com divergência
  if (!DRY_RUN && !FULL_ALL) {
    console.info('\n[Backfill] Propagando chosen_unit_id para events.unit_id (event_date >= hoje)...')

    const { data: divergedOrders } = await (supabase as any)
      .from('ploomes_orders')
      .select('deal_id, chosen_unit_id, unit_id')
      .not('chosen_unit_id', 'is', null)
      .neq('chosen_unit_id', '00000000-0000-0000-0000-000000000000')

    for (const o of (divergedOrders ?? [])) {
      if (o.chosen_unit_id === o.unit_id) continue

      const { data: evt } = await (supabase as any)
        .from('events')
        .select('id, unit_id, date')
        .eq('ploomes_deal_id', String(o.deal_id))
        .gte('date', new Date().toISOString().slice(0, 10))
        .maybeSingle()

      if (!evt) continue

      if (evt.unit_id !== o.chosen_unit_id) {
        const { error } = await (supabase as any)
          .from('events')
          .update({ unit_id: o.chosen_unit_id })
          .eq('id', evt.id)

        console.info(
          `  Event ${evt.id} (deal ${o.deal_id}, date=${evt.date}): ` +
          `unit_id ${evt.unit_id} → ${o.chosen_unit_id}`,
        )
        if (error) console.error(`  ERRO:`, error.message)
      }
    }
  }

  console.info(`\n[Backfill] Concluído — updated:${updated} skipped:${skipped} errors:${errors}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
