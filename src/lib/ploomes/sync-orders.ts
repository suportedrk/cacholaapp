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
import { loadPloomesConfig, resolveUnitId } from './sync'
import { resolveFestaUnit } from './resolve-unit'
import { refreshEventGuestCountFromLatestOrder } from './event-guest-sync'

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

interface PloomesOrderOtherProperty {
  FieldKey?: string
  ObjectValueName?: string | null
  IntegerValue?: number | null
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
  OtherProperties?: PloomesOrderOtherProperty[]
}

// FieldKey da "Unidade Escolhida" no Order (fonte de verdade para pré-reservas)
const ORDER_FIELD_KEY_CHOSEN_UNIT = 'order_EDD14E93-ECEB-4EEE-A362-80416A78E61D'

// FieldKey de "Convidados contratados" no Order (TypeId=4, IntegerValue)
// Fonte de verdade para events.guest_count a partir da v1.10.0.
const ORDER_FIELD_KEY_CONTRACTED_GUESTS = 'order_3620B917-6DCD-4977-824F-F159CC196E29'

function extractChosenUnitName(order: PloomesOrder): string | undefined {
  return order.OtherProperties?.find(
    (p) => p.FieldKey === ORDER_FIELD_KEY_CHOSEN_UNIT,
  )?.ObjectValueName ?? undefined
}

function extractContractedGuests(order: PloomesOrder): number | null {
  const prop = order.OtherProperties?.find(
    (p) => p.FieldKey === ORDER_FIELD_KEY_CONTRACTED_GUESTS,
  )
  return prop?.IntegerValue ?? null
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
  /** Orders órfãs removidas pela reconciliação (ausentes no Ploomes ao vivo) */
  ordersRemovedReconcile: number
  /** Deals efetivamente reconciliados (consulta ao Ploomes OK) */
  dealsReconciled: number
  /** Deals pulados na reconciliação por erro/timeout/resposta inválida da API */
  reconcileSkippedApiError: number
  /** Deals pulados por guardrail (100% órfãs mas com Orders vivas de IDs diferentes) */
  reconcileSkippedAllOrphan: number
  /** Deals GANHOS sem nenhuma venda viva — sinalizados (não removidos) p/ correção no Ploomes */
  reconcileWonNoOrder: number
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
 * Resolve unidade de uma Order via DealId → ploomes_deals.
 * Retorna a Pretendida (unit_id) e a Escolhida (escolhida_unit_id) do deal,
 * para o caller montar a hierarquia canônica da festa via resolveFestaUnit.
 *   { unitId, escolhidaUnitId } — encontrado e resolvido
 *   { skip: 'no_deal' }         — DealId não está em ploomes_deals
 *   { skip: 'null_unit'}        — deal existe mas unit_id = NULL
 */
async function resolveOrderUnit(
  supabase: AdminClient,
  dealId: number,
): Promise<{ unitId: string; escolhidaUnitId: string | null } | { skip: 'no_deal' | 'null_unit' }> {
  const { data, error } = await supabase
    .from('ploomes_deals')
    .select('unit_id, escolhida_unit_id')
    .eq('ploomes_deal_id', dealId)
    .maybeSingle()

  if (error) throw new Error(`[Orders Sync] Erro ao buscar deal ${dealId}: ${error.message}`)

  if (!data) return { skip: 'no_deal' }
  if (!data.unit_id) return { skip: 'null_unit' }

  return { unitId: data.unit_id, escolhidaUnitId: data.escolhida_unit_id ?? null }
}

// ── Reconciliação por deal ────────────────────────────────────

export interface ReconcileDealResult {
  /** Orders órfãs removidas (0 em dry-run, ou quando não há órfãs) */
  removed: number
  /**
   * Motivo do skip sem remoção; null = reconciliado com sucesso.
   *  - 'api_error'    : erro/timeout/resposta inválida → não tocar nada (incerteza).
   *  - 'all_orphan'   : 100% órfãs mas o deal tem Orders vivas de IDs diferentes
   *                     (substituição em massa atípica) → revisão manual.
   *  - 'won_no_order' : 0 Orders vivas CONFIRMADO + deal GANHO → anomalia de negócio
   *                     (festa ganha sem venda); sinalizado, não removido.
   */
  skipped: 'api_error' | 'all_orphan' | 'won_no_order' | null
  /** OrderIds identificados como órfãos (úteis p/ dry-run e auditoria) */
  orphanIds: number[]
  /** Título do deal — preenchido no caso 'won_no_order' p/ o sinal de revisão */
  title?: string | null
}

// Stage "Festa Fechada" — espelha a constante de is_festa_ganha (migration 150).
const STAGE_FESTA_FECHADA = 60004787

/**
 * Lê status/stage/título de um deal e aplica o critério canônico is_festa_ganha
 * (migration 150): ganho = status_id=2 OU (stage=Festa Fechada E status≠3 Perdido).
 * Usado quando um deal fica com 0 Orders vivas, para decidir entre remover (deal
 * não-ganho → lixo inócuo) e sinalizar (deal ganho → anomalia de negócio).
 * `found=false` quando o deal não está em ploomes_deals (não classificável → tratar
 * de forma conservadora, sem remover).
 */
async function getDealWonAndTitle(
  supabase: AdminClient,
  dealId: number,
): Promise<{ found: boolean; won: boolean; title: string | null }> {
  const { data, error } = await supabase
    .from('ploomes_deals')
    .select('status_id, stage_id, title')
    .eq('ploomes_deal_id', dealId)
    .maybeSingle()
  if (error || !data) return { found: false, won: false, title: null }
  const won =
    data.status_id === 2 ||
    (data.stage_id === STAGE_FESTA_FECHADA && data.status_id !== 3)
  return { found: true, won, title: data.title ?? null }
}

/**
 * Reconcilia as Orders de UM deal: compara as Orders VIVAS no Ploomes
 * (`GET /Orders?$filter=DealId eq X`) com as locais e remove as locais ausentes
 * (produtos saem por `ON DELETE CASCADE`). É o ponto de entrada por-deal — usado
 * pelo sync e por validações pontuais (ex.: um único deal antes de soltar o sync
 * amplo).
 *
 * Guardrails (remoção automática de dado): em erro/timeout/resposta inválida da
 * API, NÃO remove nada do deal; nunca remove 100% das Orders locais (provável
 * falha de API); `$top=300` com guarda de truncamento. `opts.dryRun` calcula e
 * loga as órfãs SEM remover.
 */
export async function reconcileDealOrders(
  supabase: AdminClient,
  dealId: number,
  userKey: string,
  opts: { dryRun?: boolean } = {},
): Promise<ReconcileDealResult> {
  // 1. Conjunto de Orders VIVAS do deal no Ploomes (só Id)
  let liveIds: Set<number>
  try {
    const resp = await ploomesGet<{ Id: number }>(
      `Orders?$filter=DealId eq ${dealId}&$select=Id&$top=300`,
      userKey,
    )
    if (!resp || !Array.isArray(resp.value)) {
      console.warn(`[Orders Sync][reconcile] Deal ${dealId}: resposta inválida do Ploomes — pulado.`)
      return { removed: 0, skipped: 'api_error', orphanIds: [] }
    }
    // Guarda de truncamento: um deal não deve ter ≥300 Orders; se vier cheio,
    // pode haver paginação truncada → não confiar (fabricaria órfãs falsas).
    if (resp.value.length >= 300) {
      console.warn(`[Orders Sync][reconcile] Deal ${dealId}: ${resp.value.length} Orders (possível truncamento) — pulado por segurança.`)
      return { removed: 0, skipped: 'api_error', orphanIds: [] }
    }
    liveIds = new Set(resp.value.map((o) => o.Id).filter((id): id is number => typeof id === 'number'))
  } catch (err) {
    console.warn(
      `[Orders Sync][reconcile] Deal ${dealId}: erro ao consultar Ploomes — pulado:`,
      err instanceof Error ? err.message : err,
    )
    return { removed: 0, skipped: 'api_error', orphanIds: [] }
  }

  // 2. Orders locais do deal
  const { data: localRows, error: localErr } = await supabase
    .from('ploomes_orders')
    .select('ploomes_order_id')
    .eq('deal_id', dealId)

  if (localErr) {
    console.error(`[Orders Sync][reconcile] Deal ${dealId}: erro ao ler Orders locais — pulado:`, localErr.message)
    return { removed: 0, skipped: 'api_error', orphanIds: [] }
  }

  const localIds  = (localRows ?? []).map((r) => r.ploomes_order_id)
  const orphanIds = localIds.filter((id) => !liveIds.has(id))

  if (orphanIds.length === 0) {
    return { removed: 0, skipped: null, orphanIds: [] }
  }

  // Caso 100% das Orders locais sejam órfãs. A consulta à API JÁ teve sucesso
  // (passou pelos guards de resposta inválida / truncamento / erro), então isto
  // NÃO é falha de API — distinguimos os subcasos:
  if (orphanIds.length === localIds.length) {
    if (liveIds.size > 0) {
      // O deal TEM Orders vivas, porém com IDs totalmente diferentes (substituição
      // em massa atípica). Conservador: não auto-remover; revisão manual.
      console.warn(
        `[Orders Sync][reconcile] Deal ${dealId}: 100% das Orders locais órfãs, mas o deal ` +
        `tem ${liveIds.size} Order(s) viva(s) de IDs diferentes (substituição) — PULADO p/ revisão manual.`,
      )
      return { removed: 0, skipped: 'all_orphan', orphanIds }
    }
    // liveIds vazio = API CONFIRMOU 0 vendas vivas para este deal (exclusão pura).
    const deal = await getDealWonAndTitle(supabase, dealId)
    if (!deal.found) {
      // Não classificável (deal ausente em ploomes_deals) → conservador, não remove.
      console.warn(
        `[Orders Sync][reconcile] Deal ${dealId}: 0 Orders vivas e deal não encontrado em ` +
        `ploomes_deals — PULADO p/ revisão manual. Candidatas: ${orphanIds.join(',')}`,
      )
      return { removed: 0, skipped: 'all_orphan', orphanIds }
    }
    if (deal.won) {
      // Anomalia de negócio: festa GANHA sem nenhuma venda viva. NÃO remover —
      // sinalizar para correção no Ploomes (recriar Order ou rever o ganho).
      console.warn(
        `[Orders Sync][reconcile][SINAL] Deal ${dealId}${deal.title ? ` "${deal.title}"` : ''}: ` +
        `festa GANHA sem venda viva no Ploomes — revisar no Ploomes (recriar Order ou rever ganho). ` +
        `Órfã(s) preservada(s): ${orphanIds.join(',')}`,
      )
      return { removed: 0, skipped: 'won_no_order', orphanIds, title: deal.title }
    }
    // Deal NÃO ganho + 0 vendas vivas confirmado → órfã(s) inócua(s): segue p/ remoção.
    console.warn(
      `[Orders Sync][reconcile] Deal ${dealId}: 0 Orders vivas e deal não-ganho — ` +
      `removendo ${orphanIds.length} órfã(s) inócua(s).`,
    )
  }

  // Dry-run: calcula e loga, sem remover.
  if (opts.dryRun) {
    console.warn(
      `[Orders Sync][reconcile][DRY-RUN] Deal ${dealId}: removeria ${orphanIds.length} órfã(s) ` +
      `[${orphanIds.join(',')}], mantendo ${localIds.length - orphanIds.length}.`,
    )
    return { removed: 0, skipped: null, orphanIds }
  }

  // Remover órfãs (produtos saem por ON DELETE CASCADE)
  const { error: delErr } = await supabase
    .from('ploomes_orders')
    .delete()
    .in('ploomes_order_id', orphanIds)

  if (delErr) {
    console.error(`[Orders Sync][reconcile] Deal ${dealId}: erro ao remover órfãs — pulado:`, delErr.message)
    return { removed: 0, skipped: 'api_error', orphanIds }
  }

  // Auditoria: uma linha por Order removida
  const ts = new Date().toISOString()
  for (const oid of orphanIds) {
    console.warn(
      `[Orders Sync][reconcile][AUDIT] removida OrderId=${oid} DealId=${dealId} em=${ts} ` +
      `motivo="ausente no Ploomes na reconciliação"`,
    )
  }
  return { removed: orphanIds.length, skipped: null, orphanIds }
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
    ordersRemovedReconcile:    0,
    dealsReconciled:           0,
    reconcileSkippedApiError:  0,
    reconcileSkippedAllOrphan: 0,
    reconcileWonNoOrder:       0,
    durationMs:      0,
  }

  // Deals efetivamente tocados nesta rodada (terão Orders reconciliadas ao fim).
  const touchedDeals = new Set<number>()

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
        `$expand=Owner,Creator,Products,OtherProperties`,
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
          const escolhidaUnitId = unitResult.escolhidaUnitId

          // 5b. Resolver chosen_unit_id (Unidade Escolhida do Order, FieldKey EDD14E93)
          const chosenUnitName = extractChosenUnitName(order)
          const chosenUnitId   = chosenUnitName
            ? await resolveUnitId(supabase, chosenUnitName)
            : null

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
                chosen_unit_id:      chosenUnitId ?? null,
                contracted_guests:   extractContractedGuests(order),
              },
              { onConflict: 'ploomes_order_id' },
            )

          if (orderError) {
            result.errors++
            console.error(`[Orders Sync] Erro ao upsert order ${order.Id}:`, orderError.message)
            continue
          }

          result.ordersUpserted++
          touchedDeals.add(order.DealId)

          // Propaga guest_count → events sempre a partir da Order mais recente do Deal
          if (order.DealId) {
            await refreshEventGuestCountFromLatestOrder(order.DealId, supabase)
          }

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
                  // Hierarquia canônica da festa (3 níveis, igual a events.unit_id e
                  // à função SQL resolve_festa_unit): chosen (Order) > Escolhida do
                  // Deal > Pretendida do Deal. Fallback final na Pretendida (unitId).
                  unit_id:            resolveFestaUnit(chosenUnitId, escolhidaUnitId, unitId),
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

    // 10. Reconciliação por deal — remove Orders locais que NÃO existem mais no
    // Ploomes (excluídas/substituídas). O sync é upsert-only e nunca enxerga
    // exclusões; sem isso as Orders viram órfãs e inflam o BI. Só deals tocados
    // nesta rodada. Lógica + guardrails em reconcileDealOrders().
    for (const dealId of touchedDeals) {
      const rec = await reconcileDealOrders(supabase, dealId, userKey)
      if (rec.skipped === 'api_error') {
        result.reconcileSkippedApiError++
      } else if (rec.skipped === 'all_orphan') {
        result.reconcileSkippedAllOrphan++
      } else if (rec.skipped === 'won_no_order') {
        result.reconcileWonNoOrder++
      } else {
        result.dealsReconciled++
        result.ordersRemovedReconcile += rec.removed
      }
      // Rate limit: respiração entre deals (cada deal faz 1 GET no Ploomes)
      await new Promise((r) => setTimeout(r, 600))
    }
  } catch (err) {
    result.errors++
    console.error('[Orders Sync] Erro fatal:', err)
  }

  result.durationMs = Date.now() - startedAt
  console.info(
    `[Orders Sync] Concluído — orders:${result.ordersUpserted} products:${result.productsUpserted} ` +
    `skippedNoDeal:${result.skippedNoDeal} skippedNullUnit:${result.skippedNullUnit} ` +
    `errors:${result.errors} | reconcile: dealsOK:${result.dealsReconciled} ` +
    `órfãsRemovidas:${result.ordersRemovedReconcile} pulosApiErro:${result.reconcileSkippedApiError} ` +
    `pulos100%:${result.reconcileSkippedAllOrphan} ganhoSemVenda:${result.reconcileWonNoOrder} (${result.durationMs}ms)`,
  )
  return result
}

// ── Varredura periódica de segurança (global) ─────────────────

/** PipelineId do funil CACHOLA — escopo da varredura. */
const PIPELINE_CACHOLA = 60000636
/**
 * Piso de plausibilidade: se a listagem viva CACHOLA vier abaixo disso, presume-se
 * incompleta e ABORTA (proteção contra API truncada). O universo vivo CACHOLA é
 * ~1.800; 1.000 é folga grande o suficiente p/ só disparar em falha catastrófica.
 */
const SWEEP_LIVE_MIN_PLAUSIBLE = 1000
/**
 * Teto de volume por execução: se as órfãs candidatas excederem isto, ABORTA em vez
 * de remover (provável listagem incompleta inflando falsas órfãs). O passivo já foi
 * limpo; em regime normal as órfãs chegam a conta-gotas, bem abaixo de 100.
 */
const SWEEP_VOLUME_CAP = 100

export interface ReconcileAllResult {
  liveCount: number
  localCount: number
  orphansFound: number
  orphanDeals: number
  /** Orders órfãs removidas (0 em dry-run) */
  removed: number
  /** Deals GANHOS sem venda viva — sinalizados (não removidos) */
  wonSignaled: number
  /** Deals pulados na reconciliação por-deal (erro de API / substituição atípica) */
  skipped: number
  /** null = executou; caso contrário, motivo do ABORT global (nada removido) */
  aborted: null | 'incomplete_listing' | 'volume_cap' | 'no_user_key' | 'db_error'
  /** Sinais "festa ganha sem venda" (DealId, título, órfãs) p/ revisão humana */
  signals: { dealId: number; title: string | null; orphanIds: number[] }[]
  durationMs: number
}

/**
 * Varredura periódica de segurança: lista TODAS as Orders vivas do funil CACHOLA no
 * Ploomes, compara com o banco e reconcilia cada deal com órfã reusando
 * `reconcileDealOrders` (mesma lógica/guardrails — remove deal não-ganho com 0 vivas,
 * sinaliza deal ganho com 0 vivas, pula em erro de API). Cobre o caso que o sync por
 * janela de data NUNCA toca: deals cuja única venda foi excluída no Ploomes — eles não
 * entram em `touchedDeals` (não têm Order na janela), logo a reconciliação por-deal do
 * `syncOrders` jamais os alcança.
 *
 * Como age GLOBAL, é mais defensiva que o sync:
 *  - A listagem viva CACHOLA precisa concluir a paginação sem erro E vir plausível
 *    (≥ SWEEP_LIVE_MIN_PLAUSIBLE). Qualquer sinal de incompletude → ABORTA, nada é
 *    removido, e loga erro p/ alerta.
 *  - Sanity de volume: órfãs candidatas acima de SWEEP_VOLUME_CAP → ABORTA (provável
 *    listagem incompleta) em vez de remover.
 *
 * `opts.dryRun` calcula e loga tudo sem remover (validação pré-ativação em produção).
 */
export async function reconcileAllOrders(
  supabase: AdminClient,
  userKey: string,
  opts: { dryRun?: boolean } = {},
): Promise<ReconcileAllResult> {
  const startedAt = Date.now()
  const dryRun = opts.dryRun ?? false
  const result: ReconcileAllResult = {
    liveCount: 0, localCount: 0, orphansFound: 0, orphanDeals: 0,
    removed: 0, wonSignaled: 0, skipped: 0, aborted: null, signals: [],
    durationMs: 0,
  }
  const finish = (aborted: ReconcileAllResult['aborted']) => {
    result.aborted = aborted
    result.durationMs = Date.now() - startedAt
    return result
  }

  if (!userKey) {
    console.error('[Orders Sweep] User-Key ausente — ABORTADO (nada removido).')
    return finish('no_user_key')
  }

  // 1. Listar TODOS os OrderIds vivos do funil CACHOLA (paginado).
  const liveIds = new Set<number>()
  const pageSize = 300
  let skip = 0
  try {
    while (true) {
      const resp = await ploomesGet<{ Id: number }>(
        `Orders?$filter=Deal/PipelineId eq ${PIPELINE_CACHOLA}&$select=Id&$top=${pageSize}&$skip=${skip}&$orderby=Id`,
        userKey,
      )
      if (!resp || !Array.isArray(resp.value)) {
        console.error('[Orders Sweep] Resposta inválida na listagem viva — ABORTADO (nada removido).')
        return finish('incomplete_listing')
      }
      for (const o of resp.value) if (typeof o.Id === 'number') liveIds.add(o.Id)
      if (resp.value.length < pageSize) break
      skip += pageSize
      await new Promise((r) => setTimeout(r, 400))
    }
  } catch (err) {
    console.error(
      '[Orders Sweep] Erro na listagem viva — ABORTADO (nada removido):',
      err instanceof Error ? err.message : err,
    )
    return finish('incomplete_listing')
  }

  result.liveCount = liveIds.size

  // Guardrail de plausibilidade: listagem suspeitamente pequena → ABORTA.
  if (liveIds.size < SWEEP_LIVE_MIN_PLAUSIBLE) {
    console.error(
      `[Orders Sweep] Vivos=${liveIds.size} < piso ${SWEEP_LIVE_MIN_PLAUSIBLE} — listagem suspeita, ` +
      `ABORTADO (nada removido).`,
    )
    return finish('incomplete_listing')
  }

  // 2. Órfãs locais = Orders no banco ausentes no conjunto vivo CACHOLA.
  //    (ploomes_orders já é escopado ao funil CACHOLA pelo sync.)
  const { data: localRows, error: localErr } = await supabase
    .from('ploomes_orders')
    .select('ploomes_order_id, deal_id')

  if (localErr) {
    console.error('[Orders Sweep] Erro ao ler Orders locais — ABORTADO:', localErr.message)
    return finish('db_error')
  }

  const local = localRows ?? []
  result.localCount = local.length
  const orphanRows = local.filter((r) => r.deal_id != null && !liveIds.has(r.ploomes_order_id))
  result.orphansFound = orphanRows.length
  const orphanDeals = [...new Set(orphanRows.map((r) => r.deal_id as number))]
  result.orphanDeals = orphanDeals.length

  // 3. Sanity de volume: muitas órfãs de uma vez = provável listagem incompleta.
  if (orphanRows.length > SWEEP_VOLUME_CAP) {
    console.error(
      `[Orders Sweep] ${orphanRows.length} órfãs candidatas > teto ${SWEEP_VOLUME_CAP} — ABORTADO ` +
      `(nada removido). Provável listagem incompleta.`,
    )
    return finish('volume_cap')
  }

  if (orphanDeals.length === 0) {
    console.info('[Orders Sweep] Nenhuma órfã encontrada — banco em dia com o Ploomes.')
    return finish(null)
  }

  // 4. Reconciliar cada deal órfão reusando a lógica por-deal (mesmos guardrails).
  for (const dealId of orphanDeals) {
    const rec = await reconcileDealOrders(supabase, dealId, userKey, { dryRun })
    if (rec.skipped === 'won_no_order') {
      result.wonSignaled++
      result.signals.push({ dealId, title: rec.title ?? null, orphanIds: rec.orphanIds })
    } else if (rec.skipped === 'api_error' || rec.skipped === 'all_orphan') {
      result.skipped++
    } else {
      result.removed += dryRun ? rec.orphanIds.length : rec.removed
    }
    // Rate limit: respiração entre deals (cada deal faz 1 GET no Ploomes).
    await new Promise((r) => setTimeout(r, 600))
  }

  result.durationMs = Date.now() - startedAt
  console.info(
    `[Orders Sweep] ${dryRun ? 'DRY-RUN ' : ''}concluído — vivos:${result.liveCount} ` +
    `locais:${result.localCount} órfãs:${result.orphansFound} dealsÓrfãos:${result.orphanDeals} ` +
    `${dryRun ? 'removeria' : 'removidas'}:${result.removed} ganhoSemVenda:${result.wonSignaled} ` +
    `pulos:${result.skipped} (${result.durationMs}ms)`,
  )
  return result
}
