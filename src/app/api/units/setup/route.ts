// POST /api/units/setup
// Orquestrador final do wizard: atualiza dados básicos, salva mapeamento Ploomes,
// e opcionalmente dispara re-sync do Ploomes para a nova unidade.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDeals } from '@/lib/ploomes/sync'

interface UnitSetupPayload {
  unitId: string
  // Step 1 — dados básicos (opcionais se já existentes)
  name?: string
  address?: string
  phone?: string
  // Step 2 — Ploomes
  ploomesUnitName?: string   // "Cachola MOEMA"
  ploomesObjectId?: number   // ObjectValueId (opcional)
  triggerPloomeSync?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role, id').eq('id', user.id).single()
    if (!profile || !['super_admin', 'diretor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Acesso restrito a super_admin e diretor.' }, { status: 403 })
    }

    const body: UnitSetupPayload = await req.json()
    const { unitId, name, address, phone, ploomesUnitName, ploomesObjectId, triggerPloomeSync } = body

    if (!unitId) {
      return NextResponse.json({ error: 'unitId é obrigatório.' }, { status: 400 })
    }

    // Verificar que a unidade existe
    const { data: unit } = await supabase.from('units').select('id, name').eq('id', unitId).single()
    if (!unit) return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 })

    const results: Record<string, unknown> = {}

    // ── Atualizar dados básicos (se fornecidos) ──────────────────
    if (name || address !== undefined || phone !== undefined) {
      const updatePayload: Record<string, string | null> = {}
      if (name) updatePayload.name = name
      if (address !== undefined) updatePayload.address = address ?? null
      if (phone !== undefined) updatePayload.phone = phone ?? null

      const { error: updateErr } = await supabase
        .from('units')
        .update(updatePayload)
        .eq('id', unitId)

      results.unitUpdated = !updateErr
      if (updateErr) console.error('[setup] Erro ao atualizar unit:', updateErr.message)
    }

    // ── Salvar mapeamento Ploomes ────────────────────────────────
    if (ploomesUnitName?.trim()) {
      const { error: mappingErr } = await supabase
        .from('ploomes_unit_mapping')
        .upsert(
          {
            ploomes_value: ploomesUnitName.trim(),
            ploomes_object_id: ploomesObjectId ?? null,
            unit_id: unitId,
            is_active: true,
          },
          { onConflict: 'ploomes_value' }
        )

      results.ploomesMappingSaved = !mappingErr
      if (mappingErr) console.error('[setup] Erro ao salvar mapeamento Ploomes:', mappingErr.message)
    }

    // ── Re-sync Ploomes (opcional) ───────────────────────────────
    let syncResult = null
    if (triggerPloomeSync && ploomesUnitName?.trim()) {
      try {
        syncResult = await syncDeals(supabase, {
          triggeredBy: 'manual',
          triggeredByUserId: user.id,
          unitId: null, // sync global — resolveUnitId distribui para a unidade correta
        })
        results.syncDone = true
        results.syncDealsFound = syncResult.dealsFound
        results.syncDealsCreated = syncResult.dealsCreated
        results.syncDealsUpdated = syncResult.dealsUpdated
      } catch (syncErr) {
        console.error('[setup] Erro no sync Ploomes:', syncErr)
        results.syncDone = false
      }
    }

    return NextResponse.json({ ok: true, results, syncResult })
  } catch (err) {
    console.error('[POST /api/units/setup]', err)
    return NextResponse.json({ error: 'Erro interno no setup da unidade.' }, { status: 500 })
  }
}
