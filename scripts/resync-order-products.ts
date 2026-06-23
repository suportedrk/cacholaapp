#!/usr/bin/env tsx
// scripts/resync-order-products.ts
//
// Re-sincroniza os PRODUTOS de uma Order específica para limpar ghost-rows
// (linhas-fantasma de produto que sobraram quando o Ploomes reatribuiu
// ploomes_product_id ao editar a Order — ver fix do commit 8b8c589).
//
// Reutiliza `syncOrders` (que faz `DELETE FROM ploomes_order_products WHERE
// order_id = X` ANTES de re-inserir) numa janela de CreateDate apertada em torno
// da Order alvo. Idempotente: re-rodar não causa dano.
//
// Uso:
//   npx tsx scripts/resync-order-products.ts <orderId>            # dry-run (só lê)
//   npx tsx scripts/resync-order-products.ts <orderId> --apply    # aplica o fix
//
// Achado da auditoria (23/06/2026): Order 601460638 tem cópia dupla das 9 linhas
// de produto (~R$107,6k de inflação no BI). Rodar:
//   npx tsx scripts/resync-order-products.ts 601460638            # confere
//   npx tsx scripts/resync-order-products.ts 601460638 --apply    # corrige

/* eslint-disable no-console -- script CLI: a saída no console é o propósito */
import { createClient } from '@supabase/supabase-js'
import { syncOrders } from '../src/lib/ploomes/sync-orders'
import type { Database } from '../src/types/database.types'

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PLOOMES_USER_KEY     = process.env.PLOOMES_USER_KEY!

const args    = process.argv.slice(2)
const APPLY   = args.includes('--apply')
const orderId = Number(args.find((a) => /^\d+$/.test(a)))

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Snapshot = { dealId: number | null; amount: number; count: number; sum: number }

async function snapshot(
  supabase: ReturnType<typeof createClient<Database>>,
  id: number,
): Promise<Snapshot> {
  const { data: order, error: orderErr } = await supabase
    .from('ploomes_orders')
    .select('deal_id, amount')
    .eq('ploomes_order_id', id)
    .maybeSingle()
  if (orderErr) {
    const devHint = orderErr.code === '42501'
      ? ' (quirk do PostgREST no DEV — service_role não é honrada; rodar em PRODUÇÃO)'
      : ''
    throw new Error(`Falha ao ler ploomes_orders: ${orderErr.message}${devHint}`)
  }

  const { data: prods, error: prodErr } = await supabase
    .from('ploomes_order_products')
    .select('total')
    .eq('order_id', id)
  if (prodErr) throw new Error(`Falha ao ler ploomes_order_products: ${prodErr.message}`)

  const count = prods?.length ?? 0
  const sum = (prods ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0)
  return {
    dealId: (order?.deal_id as number | null) ?? null,
    amount: Number(order?.amount ?? 0),
    count,
    sum,
  }
}

/** Busca a CreateDate da Order direto no Ploomes (a API não suporta Orders(id)). */
async function fetchOrderCreateDate(id: number, userKey: string): Promise<Date | null> {
  const url = `https://api2.ploomes.com/Orders?$filter=Id eq ${id}&$select=Id,CreateDate`
  const res = await fetch(url, { headers: { 'User-Key': userKey } })
  if (!res.ok) return null
  const json = (await res.json()) as { value?: Array<{ Id: number; CreateDate?: string }> }
  const cd = json.value?.[0]?.CreateDate
  return cd ? new Date(cd) : null
}

function printSnapshot(label: string, s: Snapshot) {
  const diff = s.sum - s.amount
  console.log(`   ${label}: deal=${s.dealId ?? '—'} | produtos=${s.count} | SUM=${fmtBRL(s.sum)} | amount=${fmtBRL(s.amount)} | Δ=${fmtBRL(diff)}`)
}

async function main() {
  if (!orderId) {
    console.error('❌ Informe o orderId. Ex.: npx tsx scripts/resync-order-products.ts 601460638 [--apply]')
    process.exit(1)
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.')
    process.exit(1)
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log(`\n🔎 Order ${orderId} — estado ATUAL`)
  const before = await snapshot(supabase, orderId)
  if (before.dealId === null && before.count === 0) {
    console.error(`❌ Order ${orderId} não encontrada em ploomes_orders.`)
    process.exit(1)
  }
  printSnapshot('antes', before)

  if (!APPLY) {
    console.log('\nℹ️  Dry-run (nada foi escrito). Para aplicar o fix:')
    console.log(`    npx tsx scripts/resync-order-products.ts ${orderId} --apply\n`)
    return
  }

  if (!PLOOMES_USER_KEY) {
    console.error('❌ PLOOMES_USER_KEY ausente — necessária para o re-sync.')
    process.exit(1)
  }

  console.log('\n⏳ Buscando CreateDate da Order no Ploomes…')
  const createDate = await fetchOrderCreateDate(orderId, PLOOMES_USER_KEY)
  if (!createDate || Number.isNaN(createDate.getTime())) {
    console.error('❌ Não foi possível obter a CreateDate da Order no Ploomes.')
    process.exit(1)
  }

  // Janela apertada (±6h) em torno da CreateDate — robusta a pequeno skew,
  // mínima colateral. syncOrders com startDate explícito filtra por CreateDate.
  const startDate = new Date(createDate.getTime() - 6 * 60 * 60 * 1000)
  const endDate   = new Date(createDate.getTime() + 6 * 60 * 60 * 1000)
  console.log(`   CreateDate=${createDate.toISOString()} | janela=[${startDate.toISOString()} , ${endDate.toISOString()})`)

  console.log('\n⏳ Re-sincronizando (DELETE WHERE order_id + re-insert dos produtos)…')
  const result = await syncOrders(supabase, { startDate, endDate })
  console.log(`   syncOrders: orders=${result.ordersUpserted} produtos=${result.productsUpserted} erros=${result.errors}`)

  console.log(`\n✅ Order ${orderId} — estado APÓS o re-sync`)
  const after = await snapshot(supabase, orderId)
  printSnapshot('depois', after)

  const fixed = before.count !== after.count || Math.abs(before.sum - after.sum) > 0.01
  console.log(
    `\n${fixed ? '✅' : 'ℹ️'} ${fixed ? 'Mudança detectada' : 'Sem mudança'}: ` +
    `produtos ${before.count}→${after.count}, SUM ${fmtBRL(before.sum)}→${fmtBRL(after.sum)}.`,
  )
  if (Math.abs(after.sum - after.amount) <= 0.01) {
    console.log('   SUM(produtos) == amount da Order. ✔️')
  } else {
    console.log(`   Atenção: SUM ainda difere de amount (Δ=${fmtBRL(after.sum - after.amount)}) — ` +
      'pode ser desconto legítimo (preço negociado vs tabela). Validar manualmente.')
  }
}

main().catch((err) => {
  console.error('❌ Erro:', err instanceof Error ? err.message : err)
  process.exit(1)
})
