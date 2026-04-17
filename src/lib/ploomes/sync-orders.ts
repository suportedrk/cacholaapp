// ============================================================
// Ploomes CRM — Sync de Vendas (Orders)
// ============================================================
// syncOrders(): busca Orders do Ploomes → upsert em
// ploomes_orders + ploomes_order_products.
//
// Resolução de unit_id: DealId → ploomes_deals.unit_id
// Se deal não encontrado OU unit_id=NULL no deal → SKIP com log.
//
// Group/Family dos produtos: catálogo /Products?$expand=Group,Family
// carregado 1x por run como Map<ProductId, {groupName, familyName}>.
// Se catálogo falhar → abortar sync.
//
// Sync incremental: MAX(ploomes_last_update) da tabela local.
// Backfill: passar startDate/endDate explícitos (janelas mensais).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { ploomesGet } from './client'
import { loadPloomesConfig } from './sync'

type AdminClient = SupabaseClient<Database>

// ── Types internos ────────────────────────────────────────────

interface PloomesOrderOwner {
  Id: number
  Name: string
  Email?: string
}

interface PloomesOrderProduct {
  Id: number
  OrderId: number
  DealId?: number
  ProductId?: number
  ProductName?: string
  ProductCode?: string
  Quantity?: number
  UnitPrice?: number
  Discount?: number
  Total?: number
  Bonus?: boolean
  OwnerId?: number
  OrderDate?: string
}

interface PloomesOrder {
  Id: number
  OrderNumber?: number
  Date?: string
  DealId?: number
  ContactId?: number
  ContactName?: string
  StageId?: number
  Amount?: number
  Discount?: number
  OwnerId?: number
  CreatorId?: number
  OriginQuoteId?: number
  DocumentUrl?: string
  CreateDate?: string
  LastUpdateDate?: string
  Owner?: PloomesOrderOwner
  Creator?: PloomesOrderOwner
  Products?: PloomesOrderProduct[]
}

interface ProductCatalogEntry {
  groupName: string | null
  familyName: string | null
}

export interface SyncOrdersOptions {
  /** Se não informado, usa MAX(ploomes_last_update) da tabela local */
  startDate?: Date
  /** Se não informado, usa agora */
  endDate?: Date
}

export interface SyncOrdersResult {
  ordersUpserted: number
  productsUpserted: number
  /** Orders com DealId não encontrado em ploomes_deals (outro pipeline) */
  skippedNoDeal: number
  /** Orders com deal encontrado mas unit_id = NULL */
  skippedNullUnit: number
  errors: number
  durationMs: number
}

// ── Catálogo de Produtos ──────────────────────────────────────

/**
 * Carrega o catálogo completo de produtos do Ploomes com Group e Family.
 * Retorna Map<ProductId, {groupName, familyName}>.
 * Lança erro se a API falhar (bloqueia o sync conforme decisão do advisor).
 */
async function loadProductCatalog(userKey: string): Promise<Map<number, ProductCatalogEntry>> {
  const catalog = new Map<number, ProductCatalogEntry>()
  const pageSize = 100
  let skip = 0

  while (true) {
    const response = await ploomesGet<{
      Id: number
      GroupId?: number
      FamilyId?: number
      Name?: string
      Group?: { Id: number; Name: string }
      Family?: { Id: number; Name: string }
    }>(`Products?$top=${pageSize}&$skip=${skip}&$expand=Group,Family`, userKey)

    const page = response.value ?? []
    for (const p of page) {
      catalog.set(p.Id, {
        groupName:  p.Group?.Name  ?? null,
        familyName: p.Family?.Name ?? null,
      })
    }

    if (page.length < pageSize) break
    skip += pageSize
  }

  console.info(`[Orders Sync] Catálogo de produtos carregado: ${catalog.size} itens`)
  return catalog
}

// ── Resolução de unit_id ──────────────────────────────────────

/**
 * Resolve unit_id de uma Order via DealId → ploomes_deals.
 * Retorna:
 *   { unitId: string }   — encontrado e resolvido
 *   { skip: 'no_deal' }  — DealId não está em ploomes_deals
 *   { skip: 'null_unit'} — deal existe mas unit_id = NULL
 */
async function resolveOrderUnit(
  supabase: AdminClient,
  dealId: number,
): Promise<{ unitId: string } | { skip: 'no_deal' | 'null_unit' }> {
  const { data, error } = await supabase
    .from('ploomes_deals')
    .select('unit_id')
    .eq('ploomes_deal_id', dealId)
    .maybeSingle()

  if (error) throw new Error(`[Orders Sync] Erro ao buscar deal ${dealId}: ${error.message}`)

  if (!data) return { skip: 'no_deal' }
  if (!data.unit_id) return { skip: 'null_unit' }

  return { unitId: data.unit_id }
}

// ── Sync principal ────────────────────────────────────────────

export async function syncOrders(
  supabase: AdminClient,
  opts: SyncOrdersOptions = {},
): Promise<SyncOrdersResult> {
  const startedAt = Date.now()
  const result: SyncOrdersResult = {
    ordersUpserted:  0,
    productsUpserted: 0,
    skippedNoDeal:   0,
    skippedNullUnit: 0,
    errors:          0,
    durationMs:      0,
  }

  try {
    // 1. Carregar config (user_key)
    const dbConfig = await loadPloomesConfig(supabase, null)
    const userKey  = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''

    if (!userKey) {
      console.error('[Orders Sync] User-Key do Ploomes não configurada.')
      result.errors++
      result.durationMs = Date.now() - startedAt
      return result
    }

    // 2. Carregar catálogo de produtos (aborta se falhar)
    const productCatalog = await loadProductCatalog(userKey)

    // 3. Determinar janela de tempo
    let startDate  = opts.startDate
    const endDate  = opts.endDate ?? new Date()

    if (!startDate) {
      // Incremental: pega o MAX(ploomes_last_update) do banco
      const { data: maxRow } = await supabase
        .from('ploomes_orders')
        .select('ploomes_last_update')
        .order('ploomes_last_update', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (maxRow?.ploomes_last_update) {
        // +1ms para não re-processar o último registro
        startDate = new Date(new Date(maxRow.ploomes_last_update).getTime() + 1)
        console.info(`[Orders Sync] Incremental desde: ${startDate.toISOString()}`)
      } else {
        // Tabela vazia — buscar últimas 48h como fallback seguro
        startDate = new Date(Date.now() - 48 * 60 * 60 * 1000)
        console.info('[Orders Sync] Tabela vazia — buscando últimas 48h')
      }
    }

    // 4. Paginar Orders via LastUpdateDate
    const pageSize = 300
    let skip = 0

    // Para backfill por janela mensal (startDate+endDate explícitos): usar CreateDate
    // Para incremental: usar LastUpdateDate
    const isBackfill = !!opts.startDate
    const dateField  = isBackfill ? 'CreateDate' : 'LastUpdateDate'

    const startIso = startDate.toISOString()
    const endIso   = endDate.toISOString()

    console.info(`[Orders Sync] Buscando ${dateField} >= ${startIso} e < ${endIso}`)

    while (true) {
      const queryParts = [
        `$filter=${dateField} ge ${startIso} and ${dateField} lt ${endIso}`,
        `$expand=Owner,Creator,Products`,
        `$top=${pageSize}`,
        `$skip=${skip}`,
        `$orderby=${dateField} asc`,
      ].join('&')

      const response = await ploomesGet<PloomesOrder>(`Orders?${queryParts}`, userKey)
      const page = response.value ?? []

      if (page.length === 0) break

      for (const order of page) {
        try {
          if (!order.Id || !order.DealId) {
            console.warn(`[Orders Sync] Order sem Id ou DealId — skip`, order.Id)
            result.errors++
            continue
          }

          // 5. Resolver unit_id
          const unitResult = await resolveOrderUnit(supabase, order.DealId)
          if ('skip' in unitResult) {
            if (unitResult.skip === 'no_deal') {
              result.skippedNoDeal++
              console.debug(`[Orders Sync] Skip order ${order.Id}: DealId ${order.DealId} não encontrado em ploomes_deals`)
            } else {
              result.skippedNullUnit++
              console.debug(`[Orders Sync] Skip order ${order.Id}: Deal ${order.DealId} sem unit_id`)
            }
            continue
          }

          const unitId = unitResult.unitId

          // 6. Normalizar data do Order
          const orderDate = order.Date
            ? order.Date.slice(0, 10)
            : (order.CreateDate ?? '').slice(0, 10)

          if (!orderDate || orderDate.length < 10) {
            console.warn(`[Orders Sync] Order ${order.Id} sem data válida — skip`)
            result.errors++
            continue
          }

          // 7. Upsert em ploomes_orders
          const { error: orderError } = await supabase
            .from('ploomes_orders')
            .upsert(
              {
                ploomes_order_id:    order.Id,
                order_number:        order.OrderNumber ?? null,
                deal_id:             order.DealId,
                unit_id:             unitId,
                date:                orderDate,
                amount:              order.Amount ?? 0,
                discount:            order.Discount ?? 0,
                owner_id:            order.OwnerId ?? order.Owner?.Id ?? null,
                owner_name:          order.Owner?.Name ?? null,
                owner_email:         order.Owner?.Email ?? null,
                creator_id:          order.CreatorId ?? order.Creator?.Id ?? null,
                creator_name:        order.Creator?.Name ?? null,
                stage_id:            order.StageId ?? null,
                contact_id:          order.ContactId ?? null,
                contact_name:        order.ContactName ?? null,
                origin_quote_id:     order.OriginQuoteId ?? null,
                document_url:        order.DocumentUrl ?? null,
                ploomes_create_date: order.CreateDate ?? null,
                ploomes_last_update: order.LastUpdateDate ?? null,
              },
              { onConflict: 'ploomes_order_id' },
            )

          if (orderError) {
            result.errors++
            console.error(`[Orders Sync] Erro ao upsert order ${order.Id}:`, orderError.message)
            continue
          }

          result.ordersUpserted++

          // 8. Limpar produtos antigos da Order antes de re-inserir
          // Necessário porque o Ploomes reatribui IDs ao editar uma Order,
          // fazendo com que o upsert por ploomes_product_id acumule duplicatas.
          const { error: deleteError } = await supabase
            .from('ploomes_order_products')
            .delete()
            .eq('order_id', order.Id)

          if (deleteError) {
            result.errors++
            console.error(
              `[Orders Sync] Falha ao limpar produtos antigos da order ${order.Id}:`,
              deleteError.message,
            )
            continue // skip entire order to avoid partial state
          }

          // 9. Upsert produtos da Order
          const products = order.Products ?? []
          for (const prod of products) {
            if (!prod.Id) continue

            const catalogEntry = prod.ProductId ? productCatalog.get(prod.ProductId) : undefined
            const prodDate = prod.OrderDate
              ? prod.OrderDate.slice(0, 10)
              : orderDate

            const { error: prodError } = await supabase
              .from('ploomes_order_products')
              .upsert(
                {
                  ploomes_product_id: prod.Id,
                  order_id:           order.Id,
                  deal_id:            prod.DealId ?? order.DealId ?? null,
                  unit_id:            unitId,
                  product_id:         prod.ProductId ?? null,
                  product_name:       prod.ProductName ?? null,
                  product_code:       prod.ProductCode ?? null,
                  group_name:         catalogEntry?.groupName ?? null,
                  family_name:        catalogEntry?.familyName ?? null,
                  quantity:           prod.Quantity ?? 1,
                  unit_price:         prod.UnitPrice ?? 0,
                  discount:           prod.Discount ?? 0,
                  total:              prod.Total ?? 0,
                  bonus:              prod.Bonus ?? false,
                  owner_id:           prod.OwnerId ?? order.Owner?.Id ?? null,
                  owner_name:         order.Owner?.Name ?? null,
                  order_date:         prodDate,
                },
                { onConflict: 'ploomes_product_id' },
              )

            if (prodError) {
              result.errors++
              console.error(`[Orders Sync] Erro ao upsert produto ${prod.Id}:`, prodError.message)
            } else {
              result.productsUpserted++
            }
          }
        } catch (err) {
          result.errors++
          console.error(`[Orders Sync] Exception order ${order?.Id}:`, err)
        }
      }

      if (page.length < pageSize) break
      skip += pageSize

      // Delay suave entre páginas (rate limit)
      await new Promise((r) => setTimeout(r, 200))
    }
  } catch (err) {
    result.errors++
    console.error('[Orders Sync] Erro fatal:', err)
  }

  result.durationMs = Date.now() - startedAt
  console.info(
    `[Orders Sync] Concluído — orders:${result.ordersUpserted} products:${result.productsUpserted} ` +
    `skippedNoDeal:${result.skippedNoDeal} skippedNullUnit:${result.skippedNullUnit} ` +
    `errors:${result.errors} (${result.durationMs}ms)`,
  )
  return result
}
