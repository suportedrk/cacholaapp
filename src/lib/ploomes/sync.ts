// ============================================================
// Ploomes CRM — Lógica de Sincronização
// ============================================================
// syncDeals(): busca deals do Ploomes → upsert em public.events.
// Aceita o cliente Supabase admin como parâmetro para não depender
// de cookies() diretamente (reutilizável em cron + API routes).
//
// A configuração de pipeline/stage/status é carregada da tabela
// `ploomes_config` (banco de dados). Fallback para env vars caso
// não haja registro no banco (retrocompatibilidade).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { ploomesGet } from './client'
import { parseDeal } from './field-mapping'
import type { PloomesDeal, SyncResult } from './types'
import type { PloomesConfigRow } from '@/types/database.types'

type AdminClient = SupabaseClient<Database>

// ── Config defaults (fallback quando não há ploomes_config no DB) ─

const DEFAULT_PIPELINE_ID   = parseInt(process.env.PLOOMES_PIPELINE_ID ?? '60000636', 10)
const DEFAULT_STAGE_ID      = parseInt(process.env.PLOOMES_STAGE_FESTA_FECHADA_ID ?? '60004787', 10)
const DEFAULT_STATUS_ID     = parseInt(process.env.PLOOMES_WON_STATUS_ID ?? '1', 10)

// ── Carregar config do banco ──────────────────────────────────

/**
 * Carrega a configuração Ploomes da unidade do banco.
 * Retorna null se não houver config cadastrada (usa fallback de env vars).
 * Se unitId for null, usa a config da primeira unidade ativa encontrada.
 */
export async function loadPloomesConfig(
  supabase: AdminClient,
  unitId: string | null,
): Promise<PloomesConfigRow | null> {
  let query = supabase
    .from('ploomes_config')
    .select('*')
    .eq('is_active', true)

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  const { data } = await query.limit(1).single()
  return data ?? null
}

// ── Resolvedores auxiliares ───────────────────────────────────

/** Retorna o id do primeiro super_admin ativo (para cron sem sessão) */
async function getSystemUserId(supabase: AdminClient): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'super_admin')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!data?.id) throw new Error('Nenhum super_admin encontrado para created_by do cron.')
  return data.id
}

/**
 * Resolve unit_id:
 * - Se `unitId` fornecido, retorna ele diretamente.
 * - Senão, tenta casar `unitName` com `units.name` (case-insensitive).
 * - Fallback: primeira unidade ativa.
 */
async function resolveUnitId(
  supabase: AdminClient,
  unitId: string | null,
  unitName?: string,
): Promise<string | null> {
  if (unitId) return unitId

  if (unitName) {
    const { data } = await supabase
      .from('units')
      .select('id')
      .ilike('name', `%${unitName}%`)
      .eq('is_active', true)
      .limit(1)
      .single()
    if (data?.id) return data.id
  }

  // Fallback: primeira unidade ativa
  const { data: first } = await supabase
    .from('units')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  return first?.id ?? null
}

/**
 * Resolve venue_id a partir do nome.
 * Cria automaticamente se não existir na unidade.
 * Retorna { id, created } onde created=true indica que foi criado agora.
 */
async function resolveVenueId(
  supabase: AdminClient,
  venueName: string,
  unitId: string,
): Promise<{ id: string; created: boolean }> {
  // Buscar existente
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .eq('unit_id', unitId)
    .ilike('name', venueName.trim())
    .limit(1)
    .single()

  if (existing?.id) return { id: existing.id, created: false }

  // Criar novo
  const { data: created, error } = await supabase
    .from('venues')
    .insert({ name: venueName.trim(), unit_id: unitId, is_active: true })
    .select('id')
    .single()

  if (error || !created?.id) {
    throw new Error(`Falha ao criar venue "${venueName}": ${error?.message}`)
  }

  console.info(`[Ploomes sync] Venue criado automaticamente: "${venueName}" (unit ${unitId})`)
  return { id: created.id, created: true }
}

// ── Sync principal ────────────────────────────────────────────

export type SyncOptions = {
  /** Se informado, só processa deals cuja unitName corresponde a esta unit */
  unitId?: string | null
  /** Quem disparou o sync */
  triggeredBy: 'cron' | 'manual' | 'webhook'
  /** ID do usuário que disparou manualmente (null para cron) */
  triggeredByUserId?: string | null
}

export async function syncDeals(
  supabase: AdminClient,
  options: SyncOptions,
): Promise<SyncResult> {
  const startedAt = Date.now()
  const result: SyncResult = {
    dealsFound: 0,
    dealsCreated: 0,
    dealsUpdated: 0,
    dealsErrors: 0,
    venuesCreated: 0,
    typesCreated: 0,
    durationMs: 0,
  }

  // Inserir log de início
  const { data: logRow } = await supabase
    .from('ploomes_sync_log')
    .insert({
      status: 'running',
      triggered_by: options.triggeredBy,
      triggered_by_user_id: options.triggeredByUserId ?? null,
      unit_id: options.unitId ?? null,
    })
    .select('id')
    .single()

  const logId = logRow?.id

  const finishLog = async (status: 'success' | 'error', errorMessage?: string) => {
    result.durationMs = Date.now() - startedAt
    if (!logId) return
    await supabase
      .from('ploomes_sync_log')
      .update({
        finished_at: new Date().toISOString(),
        status,
        deals_found: result.dealsFound,
        deals_created: result.dealsCreated,
        deals_updated: result.dealsUpdated,
        deals_errors: result.dealsErrors,
        venues_created: result.venuesCreated,
        types_created: result.typesCreated,
        error_message: errorMessage ?? null,
      })
      .eq('id', logId)
  }

  try {
    // ── 1. Carregar config do banco (ou usar defaults de env vars) ──
    const dbConfig = await loadPloomesConfig(supabase, options.unitId ?? null)

    const pipelineId = dbConfig?.pipeline_id ?? DEFAULT_PIPELINE_ID
    const stageId    = dbConfig?.stage_id    ?? DEFAULT_STAGE_ID
    const statusId   = dbConfig?.won_status_id ?? DEFAULT_STATUS_ID

    // ── 2. Buscar createdBy ──────────────────────────────────────
    const createdBy = options.triggeredByUserId ?? (await getSystemUserId(supabase))

    // ── 3. Buscar deals do Ploomes ───────────────────────────────
    const query = [
      `$filter=PipelineId eq ${pipelineId} and StageId eq ${stageId} and StatusId eq ${statusId}`,
      `$expand=OtherProperties,Contact($select=Id,Name,Email,Phones)`,
      `$select=Id,Title,ContactId,OwnerId,Amount,StageId,StatusId,CreateDate,LastUpdateDate,OtherProperties`,
      `$top=200`,
      `$orderby=CreateDate desc`,
    ].join('&')

    const response = await ploomesGet<PloomesDeal>(`Deals?${query}`)
    const deals = response.value ?? []
    result.dealsFound = deals.length

    // ── 4. Processar cada deal ───────────────────────────────────
    for (const deal of deals) {
      try {
        const parsed = parseDeal(deal)

        // Se filtrando por unit, verificar correspondência
        if (options.unitId) {
          const resolved = await resolveUnitId(supabase, options.unitId, parsed.unitName)
          if (resolved !== options.unitId) {
            // Deal não pertence a esta unidade — pular
            continue
          }
        }

        const unitId = await resolveUnitId(supabase, options.unitId ?? null, parsed.unitName)
        if (!unitId) {
          console.warn(`[Ploomes sync] Deal ${deal.Id}: unit_id não resolvido, pulando.`)
          result.dealsErrors++
          continue
        }

        // Resolver venue_id
        let venueId: string | null = null
        if (parsed.venueName) {
          const v = await resolveVenueId(supabase, parsed.venueName, unitId)
          venueId = v.id
          if (v.created) result.venuesCreated++
        }

        // Montar payload do evento
        const eventDate = parsed.eventDate ?? new Date().toISOString().substring(0, 10)
        const startTime = parsed.startTime || '08:00'
        const endTime   = parsed.endTime   || '12:00'

        const eventPayload = {
          ploomes_deal_id: String(deal.Id),
          ploomes_url: parsed.ploomesUrl,
          title: parsed.title,
          date: eventDate,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed' as const,
          client_name: parsed.clientName,
          birthday_person: parsed.birthdayPerson ?? null,
          birthday_age: parsed.age ?? null,
          guest_count: parsed.guestCount ?? null,
          venue_id: venueId,
          unit_id: unitId,
          created_by: createdBy,
        }

        // Verificar se já existe (para contar created vs updated)
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('ploomes_deal_id', String(deal.Id))
          .single()

        const { error: upsertError } = await supabase
          .from('events')
          .upsert(eventPayload, { onConflict: 'ploomes_deal_id' })

        if (upsertError) {
          console.error(`[Ploomes sync] Erro ao upsert deal ${deal.Id}:`, upsertError.message)
          result.dealsErrors++
        } else {
          if (existing) {
            result.dealsUpdated++
          } else {
            result.dealsCreated++
          }
        }
      } catch (dealErr) {
        console.error(`[Ploomes sync] Erro no deal ${deal.Id}:`, dealErr)
        result.dealsErrors++
      }
    }

    await finishLog('success')
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Ploomes sync] Erro fatal:', msg)
    result.errorMessage = msg
    await finishLog('error', msg)
    return result
  }
}
