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
const _DEFAULT_STATUS_ID     = parseInt(process.env.PLOOMES_WON_STATUS_ID ?? '1', 10)

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
 * Resolve unit_id para um deal:
 * 1. Lookup em `ploomes_unit_mapping` pelo ObjectValueName (mais confiável)
 * 2. Fallback: ilike em `units.name` (compatibilidade)
 * 3. Fallback: primeira unidade ativa
 */
export async function resolveUnitId(
  supabase: AdminClient,
  unitName?: string,
): Promise<string | null> {
  // 1. Mapeamento explícito (tabela configurável)
  if (unitName) {
    const { data: mapped } = await supabase
      .from('ploomes_unit_mapping')
      .select('unit_id')
      .eq('ploomes_value', unitName)
      .eq('is_active', true)
      .maybeSingle()
    if (mapped?.unit_id) return mapped.unit_id

    // Avisa sobre valores não mapeados (pode indicar nova unidade no Ploomes)
    console.warn(`[Ploomes sync] Valor de unidade não mapeado: "${unitName}". Usando fallback.`)
  }

  // 2. Fallback: ilike em units.name (legacy)
  if (unitName) {
    const { data } = await supabase
      .from('units')
      .select('id')
      .ilike('name', `%${unitName}%`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id
  }

  // 3. Fallback final: primeira unidade ativa
  const { data: first } = await supabase
    .from('units')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  return first?.id ?? null
}


// ── Sync principal ────────────────────────────────────────────

export type SyncOptions = {
  /** Se informado, só processa deals cuja unitName corresponde a esta unit */
  unitId?: string | null
  /** Quem disparou o sync */
  triggeredBy: 'cron' | 'manual' | 'webhook'
  /** ID do usuário que disparou manualmente (null para cron) */
  triggeredByUserId?: string | null
  /**
   * Se informado, sincroniza APENAS este deal específico (sync cirúrgico).
   * Usado pelo receptor de webhook para evitar re-processar todos os 687 deals.
   * Sem este parâmetro: comportamento padrão — sync completo com paginação.
   */
  dealId?: number | null
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
    dealsMarkedLost: 0,
    dealsErrors: 0,
    typesCreated: 0,
    durationMs: 0,
  }

  // Inserir log de início
  const { data: logRow, error: logInsertErr } = await supabase
    .from('ploomes_sync_log')
    .insert({
      status: 'running',
      triggered_by: options.triggeredBy,
      triggered_by_user_id: options.triggeredByUserId ?? null,
      unit_id: options.unitId ?? null,
    })
    .select('id')
    .single()

  if (logInsertErr) {
    console.error('[Ploomes sync] Falha ao inserir sync_log:', logInsertErr.message)
  }

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
        deals_removed: result.dealsMarkedLost,
        deals_errors: result.dealsErrors,
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
    // User-Key: prioridade para a chave salva no banco; fallback para env var
    const userKey    = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''
    // Regra de negócio: todos os deals no stage "Festa Fechada" são importados.
    // StatusId determina o status do evento:
    //   2 (Perdido) → 'lost' (mantido para estatísticas, oculto por padrão na UI)
    //   demais      → 'confirmed'

    // ── 2. Buscar createdBy ──────────────────────────────────────
    const createdBy = options.triggeredByUserId ?? (await getSystemUserId(supabase))

    // ── 3. Buscar deals do Ploomes ────────────────────────────────
    const allDeals: PloomesDeal[] = []
    const EXPAND = `$expand=OtherProperties,Contact($select=Id,Name,Email,Phones)`
    const SELECT = `$select=Id,Title,ContactId,OwnerId,Amount,StageId,StatusId,CreateDate,LastUpdateDate,OtherProperties`

    if (options.dealId) {
      // ── Sync cirúrgico: apenas um deal específico (ex: disparado por webhook) ──
      // Mantém o filtro de pipeline para garantir que só importamos deals do funil correto.
      const queryParts = [
        `$filter=PipelineId eq ${pipelineId} and StageId eq ${stageId} and Id eq ${options.dealId}`,
        EXPAND,
        SELECT,
      ].join('&')

      const response = await ploomesGet<PloomesDeal>(`Deals?${queryParts}`, userKey)
      allDeals.push(...(response.value ?? []))
    } else {
      // ── Sync completo: paginação com $skip até esgotar todos os deals ──
      // O Ploomes limita resultados por página (100).
      const pageSize = 100
      let skip = 0

      while (true) {
        const queryParts = [
          `$filter=PipelineId eq ${pipelineId} and StageId eq ${stageId}`,
          EXPAND,
          SELECT,
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
    }

    result.dealsFound = allDeals.length

    // ── 4. Processar cada deal ───────────────────────────────────
    for (const deal of allDeals) {
      try {
        const parsed = parseDeal(deal)

        // Determinar a unidade do deal via mapeamento configurável
        const dealUnitId = await resolveUnitId(supabase, parsed.unitName)
        if (!dealUnitId) {
          console.warn(`[Ploomes sync] Deal ${deal.Id}: unit_id não resolvido, pulando.`)
          result.dealsErrors++
          continue
        }

        // Se o sync é scoped a uma unidade específica, pular deals de outras unidades
        if (options.unitId && dealUnitId !== options.unitId) {
          continue
        }

        const unitId = dealUnitId


        // Montar payload do evento
        const eventDate = parsed.eventDate ?? new Date().toISOString().substring(0, 10)
        const startTime = parsed.startTime || '08:00'
        const endTime   = parsed.endTime   || '12:00'

        // Mapear StatusId → status do evento
        // Ploomes padrão: 1=Em aberto, 2=Ganho, 3=Perdido
        // No stage "Festa Fechada": StatusId=3 (Perdido) → lost; demais → confirmed
        const eventStatus = deal.StatusId === 3 ? 'lost' as const : 'confirmed' as const

        const eventPayload = {
          ploomes_deal_id: String(deal.Id),
          ploomes_url: parsed.ploomesUrl,
          title: parsed.title,
          date: eventDate,
          start_time: startTime,
          end_time: endTime,
          status: eventStatus,
          client_name: parsed.clientName,
          client_phone: parsed.clientPhone ?? null,
          client_email: parsed.clientEmail ?? null,
          birthday_person: parsed.birthdayPerson ?? null,
          birthday_age: parsed.age ?? null,
          guest_count: parsed.guestCount ?? null,
          theme: parsed.theme ?? null,
          notes: parsed.notes ?? null,
          unit_id: unitId,
          created_by: createdBy,
          // Logística
          setup_time: parsed.setupTime ?? null,
          teardown_time: parsed.teardownTime ?? null,
          show_time: parsed.showTime ?? null,
          event_location: parsed.eventLocation ?? null,
          duration: parsed.duration ?? null,
          // Serviços contratados
          has_show: parsed.hasShow ?? false,
          photo_video: parsed.photoVideo ?? null,
          decoration_aligned: parsed.decorationAligned ?? false,
          has_decorated_sweets: parsed.hasDecoratedSweets ?? false,
          party_favors: parsed.partyFavors ?? false,
          outside_drinks: parsed.outsideDrinks ?? false,
          // Família
          father_name: parsed.fatherName ?? null,
          school: parsed.school ?? null,
          birthday_date: parsed.birthdayDate ?? null,
          // Financeiro
          payment_method: parsed.paymentMethod ?? null,
          briefing: parsed.briefing ?? null,
          event_category: parsed.eventCategory ?? null,
          cake_flavor: parsed.cakeFlavor ?? null,
          music: parsed.music ?? null,
          adult_count: parsed.adultCount ?? null,
          kids_under4: parsed.kidsUnder4 ?? null,
          kids_over5: parsed.kidsOver5 ?? null,
          deal_amount: parsed.amount ?? null,
        }

        // Verificar se já existe (para contar created vs updated vs lost)
        const { data: existing } = await supabase
          .from('events')
          .select('id, status')
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
            // Detectar transição para/de lost (deal ganho/perdido ou reaberto)
            if (eventStatus === 'lost' && existing.status !== 'lost') {
              result.dealsMarkedLost++
            } else {
              result.dealsUpdated++
            }
          } else {
            if (eventStatus === 'lost') {
              result.dealsMarkedLost++
            } else {
              result.dealsCreated++
            }
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
