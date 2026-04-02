// GET /api/units/[id]/copyable-data
// Retorna o que pode ser copiado de uma unidade (para o Step 3 do wizard).

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

    // Checklist templates com contagem de itens
    const { data: rawTemplates } = await supabase
      .from('checklist_templates')
      .select('id, title, template_items(id)')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('title')

    const checklistTemplates = (rawTemplates ?? []).map((t) => ({
      id: t.id,
      name: t.title,
      itemCount: Array.isArray(t.template_items) ? t.template_items.length : 0,
    }))

    // Demais entidades
    const [
      { data: rawCategories },
      { data: rawSectors },
      { data: rawEquipCats },
      { data: rawServiceCats },
    ] = await Promise.all([
      supabase.from('checklist_categories').select('id, name').eq('unit_id', unitId).eq('is_active', true).order('name'),
      supabase.from('sectors').select('id, name').eq('unit_id', unitId).eq('is_active', true).order('name'),
      supabase.from('equipment_categories').select('id, name').eq('unit_id', unitId).eq('is_active', true).order('name'),
      supabase.from('service_categories').select('id, name').eq('unit_id', unitId).eq('is_active', true).order('name'),
    ])

    return NextResponse.json({
      checklistTemplates,
      checklistCategories: rawCategories ?? [],
      sectors: rawSectors ?? [],
      equipmentCategories: rawEquipCats ?? [],
      serviceCategories: rawServiceCats ?? [],
    })
  } catch (err) {
    console.error('[GET /api/units/[id]/copyable-data]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
