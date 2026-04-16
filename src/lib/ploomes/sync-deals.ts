// ============================================================
// Ploomes CRM — Sync expandido de TODOS os deals para BI
// ============================================================
// syncDealsForBI(): busca TODOS os deals do pipeline (sem filtro
// de stage) e faz upsert em public.ploomes_deals.
//
// Sync PARALELO ao syncDeals (events). NÃO altera events.
// O cron executa ambos em sequência.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { ploomesGet } from './client'
import { parseDeal } from './field-mapping'
import { loadPloomesConfig, resolveUnitId } from './sync'
import type { PloomesDeal, DealsBISyncResult } from './types'

type AdminClient = SupabaseClient<Database>

// FieldKeys dos campos básicos não cobertos por parseDeal
const FIELD_KEY_UNIT = 'deal_A583075F-D19C-4034-A479-36625C621660'

// Status IDs do Ploomes
const STATUS_NAMES: Record<number, string> = {
  1: 'Em aberto',
  2: 'Ganho',
  3: 'Perdido',
}

function getStatusName(statusId: number): string {
  return STATUS_NAMES[statusId] ?? `Desconhecido (${statusId})`
}

function extractUnitName(deal: PloomesDeal): string | undefined {
  const prop = deal.OtherProperties?.find((p) => p.FieldKey === FIELD_KEY_UNIT)
  return prop?.ObjectValueName ?? undefined
}

/**
 * Extrai data e horários do deal via parseDeal().
 * Reutiliza a lógica de field-mapping já validada no sync de eventos.
 */
function extractDealDateTimes(deal: PloomesDeal): {
  event_date: string | null
  start_time: string | null
  end_time:   string | null
} {
  const parsed = parseDeal(deal)
  return {
    event_date: parsed.eventDate ?? null,
    start_time: parsed.startTime ?? null,
    end_time:   parsed.endTime   ?? null,
  }
}

export async function syncDealsForBI(
  supabase: AdminClient,
  unitId?: string | null,
): Promise<DealsBISyncResult> {
  const startedAt = Date.now()
  const result: DealsBISyncResult = { total: 0, created: 0, updated: 0, errors: 0, durationMs: 0 }

  try {
    // 1. Carregar config do banco (mesma lógica do sync de eventos)
    const dbConfig = await loadPloomesConfig(supabase, unitId ?? null)
    const pipelineId = dbConfig?.pipeline_id ?? parseInt(process.env.PLOOMES_PIPELINE_ID ?? '60000636', 10)
    const userKey    = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''

    if (!userKey) {
      console.error('[BI Sync] User-Key do Ploomes não configurada.')
      result.errors++
      result.durationMs = Date.now() - startedAt
      return result
    }

    // 2. Buscar TODOS os deals do pipeline com paginação OData
    const allDeals: PloomesDeal[] = []
    const pageSize = 100
    let skip = 0

    while (true) {
      const queryParts = [
        `$filter=PipelineId eq ${pipelineId}`,
        `$select=Id,Title,ContactId,OwnerId,Amount,StageId,StatusId,CreateDate,LastUpdateDate`,
        `$expand=OtherProperties,Contact($select=Id,Name,Email,Phones),Stage($select=Id,Name),Owner($select=Id,Name,Email)`,
        `$top=${pageSize}`,
        `$skip=${skip}`,
        `$orderby=CreateDate desc`,
      ].join('&')

      const response = await ploomesGet<PloomesDeal>(`Deals?${queryParts}`, userKey)
      const page = response.value ?? []
      allDeals.push(...page)

      if (page.length < pageSize) break
      skip += pageSize
    }

    result.total = allDeals.length
    console.info(`[BI Sync] ${allDeals.length} deals encontrados no pipeline ${pipelineId}`)

    // 3. Upsert em ploomes_deals
    for (const deal of allDeals) {
      try {
        if (!deal.Id || !deal.StageId || !deal.StatusId || !deal.CreateDate) {
          console.warn(`[BI Sync] Deal inválido (campos obrigatórios ausentes):`, deal.Id)
          result.errors++
          continue
        }

        const unitName  = extractUnitName(deal)
        const dealUnitId = await resolveUnitId(supabase, unitName)

        // Se sync scoped a uma unidade, pular deals de outras unidades
        if (unitId && dealUnitId !== unitId) continue

        const { event_date, start_time, end_time } = extractDealDateTimes(deal)

        // Verificar se já existe evento vinculado
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id')
          .eq('ploomes_deal_id', String(deal.Id))
          .maybeSingle()

        const { error } = await supabase
          .from('ploomes_deals')
          .upsert(
            {
              ploomes_deal_id:    deal.Id,
              title:              deal.Title ?? null,
              contact_name:       deal.Contact?.Name ?? null,
              contact_email:      deal.Contact?.Email ?? null,
              contact_phone:      deal.Contact?.Phones?.[0]?.PhoneNumber ?? null,
              deal_amount:        deal.Amount ?? null,
              stage_id:           deal.StageId,
              stage_name:         deal.Stage?.Name ?? null,
              status_id:          deal.StatusId,
              status_name:        getStatusName(deal.StatusId),
              unit_id:            dealUnitId,
              ploomes_create_date: deal.CreateDate,
              ploomes_last_update: deal.LastUpdateDate ?? null,
              event_date,
              start_time,
              end_time,
              owner_id:           deal.OwnerId ?? null,
              owner_name:         deal.Owner?.Name ?? null,
              event_id:           existingEvent?.id ?? null,
            },
            { onConflict: 'ploomes_deal_id' },
          )

        if (error) {
          result.errors++
          console.error(`[BI Sync] Erro ao upsert deal ${deal.Id}:`, error.message)
        } else {
          result.created++
        }
      } catch (err) {
        result.errors++
        console.error(`[BI Sync] Exception deal ${deal.Id}:`, err)
      }
    }
  } catch (err) {
    result.errors++
    console.error('[BI Sync] Erro fatal:', err)
  }

  result.durationMs = Date.now() - startedAt
  console.info(`[BI Sync] Concluído — total:${result.total} ok:${result.created} erros:${result.errors} (${result.durationMs}ms)`)
  return result
}

// ─────────────────────────────────────────────────────────────
// syncSingleDealToBI
// Atualiza ploomes_deals para um único deal (chamado pelo webhook).
// Não altera a tabela events — apenas mantém ploomes_deals em sync
// para que a VIEW pre_reservas_ploomes_view reflita mudanças em tempo real.
// ─────────────────────────────────────────────────────────────

export async function syncSingleDealToBI(
  supabase: AdminClient,
  dealId:   number,
): Promise<void> {
  try {
    // 1. Carregar config (userKey)
    const dbConfig = await loadPloomesConfig(supabase, null)
    const pipelineId = dbConfig?.pipeline_id ?? parseInt(process.env.PLOOMES_PIPELINE_ID ?? '60000636', 10)
    const userKey    = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''

    if (!userKey) {
      console.warn('[BI Sync single] User-Key não configurada — skip ploomes_deals update.')
      return
    }

    // 2. Buscar o deal específico
    const queryParts = [
      `$filter=PipelineId eq ${pipelineId} and Id eq ${dealId}`,
      `$select=Id,Title,ContactId,OwnerId,Amount,StageId,StatusId,CreateDate,LastUpdateDate`,
      `$expand=OtherProperties,Contact($select=Id,Name,Email,Phones),Stage($select=Id,Name),Owner($select=Id,Name,Email)`,
    ].join('&')

    const response = await ploomesGet<PloomesDeal>(`Deals?${queryParts}`, userKey)
    const deal = response.value?.[0]

    if (!deal) {
      console.warn(`[BI Sync single] Deal ${dealId} não encontrado no pipeline ${pipelineId}.`)
      return
    }

    if (!deal.Id || !deal.StageId || !deal.StatusId || !deal.CreateDate) {
      console.warn(`[BI Sync single] Deal ${dealId} com campos obrigatórios ausentes.`)
      return
    }

    // 3. Resolver unit_id
    const unitName   = extractUnitName(deal)
    const dealUnitId = await resolveUnitId(supabase, unitName)

    // 4. Extrair datas e horários
    const { event_date, start_time, end_time } = extractDealDateTimes(deal)

    // 5. Verificar FK para events
    const { data: existingEvent } = await supabase
      .from('events')
      .select('id')
      .eq('ploomes_deal_id', String(deal.Id))
      .maybeSingle()

    // 6. Upsert em ploomes_deals
    const { error } = await supabase
      .from('ploomes_deals')
      .upsert(
        {
          ploomes_deal_id:     deal.Id,
          title:               deal.Title ?? null,
          contact_name:        deal.Contact?.Name ?? null,
          contact_email:       deal.Contact?.Email ?? null,
          contact_phone:       deal.Contact?.Phones?.[0]?.PhoneNumber ?? null,
          deal_amount:         deal.Amount ?? null,
          stage_id:            deal.StageId,
          stage_name:          deal.Stage?.Name ?? null,
          status_id:           deal.StatusId,
          status_name:         getStatusName(deal.StatusId),
          unit_id:             dealUnitId,
          ploomes_create_date: deal.CreateDate,
          ploomes_last_update: deal.LastUpdateDate ?? null,
          event_date,
          start_time,
          end_time,
          owner_id:            deal.OwnerId ?? null,
          owner_name:          deal.Owner?.Name ?? null,
          event_id:            existingEvent?.id ?? null,
        },
        { onConflict: 'ploomes_deal_id' },
      )

    if (error) {
      console.error(`[BI Sync single] Erro ao upsert deal ${dealId}:`, error.message)
    } else {
      console.info(`[BI Sync single] Deal ${dealId} atualizado em ploomes_deals (stage=${deal.StageId}, start=${start_time ?? '—'}, end=${end_time ?? '—'})`)
    }
  } catch (err) {
    console.error(`[BI Sync single] Exception deal ${dealId}:`, err)
  }
}
