// GET /api/units/[id]/setup-status
// Retorna o status de setup de uma unidade: dados básicos, Ploomes, templates, equipe, prestadores.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id: unitId } = await params
    const supabase = await createAdminClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !['super_admin', 'diretor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Acesso restrito a super_admin e diretor.' }, { status: 403 })
    }

    // Dados básicos da unidade
    const { data: unit } = await supabase
      .from('units').select('id, name, slug, address, phone, is_active').eq('id', unitId).single()
    if (!unit) return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 })

    // Ploomes mapping
    const { data: ploomesMapping } = await supabase
      .from('ploomes_unit_mapping').select('id, ploomes_value').eq('unit_id', unitId).maybeSingle()

    // Contagens de templates
    const [
      { count: checklistTemplates },
      { count: checklistCategories },
      { count: sectors },
      { count: equipmentCategories },
      { count: serviceCategories },
    ] = await Promise.all([
      supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
      supabase.from('checklist_categories').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
      supabase.from('sectors').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
      supabase.from('equipment_categories').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
      supabase.from('service_categories').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
    ])

    // Equipe
    const { count: teamCount } = await supabase
      .from('user_units').select('id', { count: 'exact', head: true }).eq('unit_id', unitId)

    // Prestadores
    const { count: providerCount } = await supabase
      .from('service_providers').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('status', 'active')

    // Deals sincronizados
    const { count: dealCount } = await supabase
      .from('events').select('id', { count: 'exact', head: true }).eq('unit_id', unitId)

    return NextResponse.json({
      unit,
      hasBasicData: !!(unit.name && unit.slug),
      hasPloomesMapping: !!ploomesMapping,
      ploomesValue: ploomesMapping?.ploomes_value ?? null,
      templateCounts: {
        checklistTemplates: checklistTemplates ?? 0,
        checklistCategories: checklistCategories ?? 0,
        sectors: sectors ?? 0,
        equipmentCategories: equipmentCategories ?? 0,
        serviceCategories: serviceCategories ?? 0,
      },
      teamCount: teamCount ?? 0,
      providerCount: providerCount ?? 0,
      dealCount: dealCount ?? 0,
    })
  } catch (err) {
    console.error('[GET /api/units/[id]/setup-status]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
