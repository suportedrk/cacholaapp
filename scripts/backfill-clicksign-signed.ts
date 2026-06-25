#!/usr/bin/env tsx
// =============================================================
// Backfill: contract_signed (Assinado/Clicksign) em ploomes_orders
//           + recomputo do agregado events.contract_signed
// =============================================================
// Uso:
//   npx tsx scripts/backfill-clicksign-signed.ts            (aplica)
//   npx tsx scripts/backfill-clicksign-signed.ts --dry-run  (só relata)
//
// Lê o checkbox "Assinado (Clicksign)" (FieldKey order_7B61B5EB-...,
// TypeId=10 → BoolValue) de TODAS as orders do Ploomes e atualiza as
// linhas correspondentes em ploomes_orders. Depois reagrega events.
//
// Idempotente: pode rodar quantas vezes precisar. Orders ausentes no
// Ploomes (deletadas) permanecem false. Festas sem nenhuma order ficam
// com contract_signed = NULL.
//
// Pré-requisitos: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (lê user_key da ploomes_config) OU PLOOMES_USER_KEY como fallback.
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'
import { refreshEventContractSignedFromOrders } from '../src/lib/ploomes/event-contract-sync'

const BASE_URL = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const FIELD_KEY = 'order_7B61B5EB-7BBB-406E-808E-EE9BDF17AA9C'
const DRY_RUN = process.argv.includes('--dry-run')
const CHUNK = 100

async function ploomesGet<T>(path: string, userKey: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path.replace(/^\//, '')}`, {
    headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
  })
  if (res.status === 429) {
    console.warn('  [429] rate limit — aguardando 65s...')
    await new Promise((r) => setTimeout(r, 65_000))
    return ploomesGet<T>(path, userKey)
  }
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${await res.text().catch(() => '')}`)
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

interface OtherProp { FieldKey?: string; BoolValue?: boolean | null }
interface Order { Id: number; OtherProperties?: OtherProp[] }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!supabaseUrl || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')
  const sb = createClient<Database>(supabaseUrl, serviceKey)

  // user_key (env > ploomes_config)
  let userKey = process.env.PLOOMES_USER_KEY ?? ''
  if (!userKey) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('ploomes_config').select('user_key').eq('is_active', true).limit(1).single()
    userKey = data?.user_key ?? ''
  }
  if (!userKey) throw new Error('user_key não encontrada')
  console.log(`[OK] user_key carregada${DRY_RUN ? ' — modo DRY-RUN' : ''}\n`)

  // 1. Carrega TODAS as orders locais (id → deal_id)
  const localOrders = new Map<number, number | null>()
  {
    let from = 0
    const page = 1000
    while (true) {
      const { data, error } = await sb
        .from('ploomes_orders')
        .select('ploomes_order_id, deal_id')
        .range(from, from + page - 1)
      if (error) throw new Error(`Erro lendo ploomes_orders: ${error.message}`)
      const rows = data ?? []
      for (const r of rows) localOrders.set(r.ploomes_order_id, r.deal_id)
      if (rows.length < page) break
      from += page
    }
  }
  console.log(`Orders locais: ${localOrders.size}`)

  // 2. Paginar /Orders no Ploomes e coletar quem está assinado (e é local)
  const signedLocalIds: number[] = []
  let scanned = 0
  let skip = 0
  const top = 300
  while (true) {
    const res = await ploomesGet<{ value: Order[] }>(
      `Orders?$top=${top}&$skip=${skip}&$orderby=Id asc&$expand=OtherProperties($select=FieldKey,BoolValue)`,
      userKey,
    )
    const orders = res.value ?? []
    for (const o of orders) {
      if (!localOrders.has(o.Id)) continue
      scanned++
      const signed = o.OtherProperties?.some((p) => p.FieldKey === FIELD_KEY && p.BoolValue === true) ?? false
      if (signed) signedLocalIds.push(o.Id)
    }
    if (orders.length < top) break
    skip += top
    await new Promise((r) => setTimeout(r, 250)) // respiração rate limit
  }
  console.log(`Orders locais encontradas no Ploomes: ${scanned}`)
  console.log(`Orders assinadas (BoolValue=true): ${signedLocalIds.length}`)

  if (DRY_RUN) {
    const signedSet = new Set(signedLocalIds)
    const deals = new Set<number>()
    for (const [, dealId] of localOrders) if (dealId != null) deals.add(dealId)
    console.log(`\n[DRY-RUN] Atualizaria ${signedLocalIds.length} orders → true, ${localOrders.size - signedSet.size} → false`)
    console.log(`[DRY-RUN] Reagregaria ${deals.size} festas (deals distintos)`)
    return
  }

  // 3. Atualiza ploomes_orders: signed → true, restante → false
  const signedSet = new Set(signedLocalIds)
  const unsignedIds = [...localOrders.keys()].filter((id) => !signedSet.has(id))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderTable = () => (sb as any).from('ploomes_orders')

  for (const c of chunk(signedLocalIds, CHUNK)) {
    const { error } = await orderTable().update({ contract_signed: true }).in('ploomes_order_id', c)
    if (error) throw new Error(`Erro update true: ${error.message}`)
  }
  for (const c of chunk(unsignedIds, CHUNK)) {
    const { error } = await orderTable().update({ contract_signed: false }).in('ploomes_order_id', c)
    if (error) throw new Error(`Erro update false: ${error.message}`)
  }
  console.log(`\n[OK] ploomes_orders atualizada (${signedLocalIds.length} true, ${unsignedIds.length} false)`)

  // 4. Reagrega events.contract_signed por deal (reusa helper do sync)
  const deals = new Set<number>()
  for (const [, dealId] of localOrders) if (dealId != null) deals.add(dealId)
  let done = 0
  for (const dealId of deals) {
    await refreshEventContractSignedFromOrders(dealId, sb)
    if (++done % 100 === 0) console.log(`  ...reagregados ${done}/${deals.size} deals`)
  }
  console.log(`[OK] events.contract_signed reagregado para ${deals.size} deals`)

  // 5. Relatório final
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: signedEvents } = await (sb as any)
    .from('events').select('id', { count: 'exact', head: true }).eq('contract_signed', true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: unsignedEvents } = await (sb as any)
    .from('events').select('id', { count: 'exact', head: true }).eq('contract_signed', false)
  console.log(`\nResumo events: ${signedEvents ?? 0} assinadas, ${unsignedEvents ?? 0} não assinadas (resto NULL = sem venda)`)
}

main().catch((e) => {
  console.error('[ERRO]', e)
  process.exit(1)
})
