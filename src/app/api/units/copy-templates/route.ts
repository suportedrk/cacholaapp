// POST /api/units/copy-templates
// Duplica templates operacionais de uma unidade origem para uma unidade destino.
// Cria novos IDs (gen_random_uuid) — não copia IDs originais.
// Pula entidades que já existem na unidade destino (por nome).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { Priority } from '@/types/database.types'
import { hasRole, ADMIN_UNITS_MANAGE_ROLES } from '@/config/roles'

interface CopyTemplatesPayload {
  sourceUnitId: string
  targetUnitId: string
  /** Quais entidades copiar — padrão: todas */
  include?: {
    checklistTemplates?: boolean
    checklistCategories?: boolean
    sectors?: boolean
    equipmentCategories?: boolean
    serviceCategories?: boolean
  }
}

interface CopyResult {
  checklistTemplates: number
  checklistCategories: number
  sectors: number
  equipmentCategories: number
  serviceCategories: number
  skipped: number
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !hasRole(profile.role, ADMIN_UNITS_MANAGE_ROLES)) {
      return NextResponse.json({ error: 'Acesso restrito a super_admin e diretor.' }, { status: 403 })
    }

    const body: CopyTemplatesPayload = await req.json()
    const { sourceUnitId, targetUnitId, include = {} } = body

    if (!sourceUnitId || !targetUnitId) {
      return NextResponse.json({ error: 'sourceUnitId e targetUnitId são obrigatórios.' }, { status: 400 })
    }
    if (sourceUnitId === targetUnitId) {
      return NextResponse.json({ error: 'Origem e destino não podem ser a mesma unidade.' }, { status: 400 })
    }

    const copyAll = Object.keys(include).length === 0
    const should = (key: keyof typeof include) => copyAll || include[key] !== false

    const result: CopyResult = {
      checklistTemplates: 0,
      checklistCategories: 0,
      sectors: 0,
      equipmentCategories: 0,
      serviceCategories: 0,
      skipped: 0,
    }

    // ── Checklist Categories ─────────────────────────────────────
    if (should('checklistCategories')) {
      const { data: srcCats } = await supabase
        .from('checklist_categories')
        .select('name, sort_order')
        .eq('unit_id', sourceUnitId)
        .eq('is_active', true)

      const { data: existingCats } = await supabase
        .from('checklist_categories')
        .select('name')
        .eq('unit_id', targetUnitId)

      const existingNames = new Set((existingCats ?? []).map((c) => c.name.toLowerCase()))

      for (const cat of srcCats ?? []) {
        if (existingNames.has(cat.name.toLowerCase())) { result.skipped++; continue }
        await supabase.from('checklist_categories').insert({
          name: cat.name,
          sort_order: cat.sort_order,
          unit_id: targetUnitId,
          is_active: true,
        })
        result.checklistCategories++
      }
    }

    // ── Checklist Templates + Items ──────────────────────────────
    if (should('checklistTemplates')) {
      const { data: srcTemplates } = await supabase
        .from('checklist_templates')
        .select('*, template_items(*)')
        .eq('unit_id', sourceUnitId)
        .eq('is_active', true)

      const { data: existingTpls } = await supabase
        .from('checklist_templates')
        .select('title')
        .eq('unit_id', targetUnitId)

      const existingTitles = new Set((existingTpls ?? []).map((t) => t.title.toLowerCase()))

      for (const tpl of srcTemplates ?? []) {
        if (existingTitles.has(tpl.title.toLowerCase())) { result.skipped++; continue }

        const { data: newTpl } = await supabase
          .from('checklist_templates')
          .insert({
            title: tpl.title,
            category: tpl.category,
            // category_id não é copiado — IDs de categoria são diferentes na unidade destino
            category_id: null,
            unit_id: targetUnitId,
            created_by: user.id,
            is_active: true,
            description: tpl.description,
            estimated_duration_minutes: tpl.estimated_duration_minutes,
            default_priority: tpl.default_priority,
            recurrence_rule: tpl.recurrence_rule,
          })
          .select('id')
          .single()

        if (newTpl?.id && Array.isArray(tpl.template_items)) {
          const items = (tpl.template_items as Array<{
            description: string; sort_order: number; default_priority: string;
            default_estimated_minutes: number | null; notes_template: string | null;
            requires_photo: boolean; is_required: boolean;
          }>).map((item) => ({
            template_id: newTpl.id,
            description: item.description,
            sort_order: item.sort_order,
            default_priority: item.default_priority as Priority,
            default_estimated_minutes: item.default_estimated_minutes,
            // default_assigned_to não é copiado — usuários são por unidade
            notes_template: item.notes_template,
            requires_photo: item.requires_photo,
            is_required: item.is_required,
          }))

          if (items.length > 0) {
            await supabase.from('template_items').insert(items)
          }
        }

        result.checklistTemplates++
      }
    }

    // ── Sectors ─────────────────────────────────────────────────
    if (should('sectors')) {
      const { data: srcSectors } = await supabase
        .from('maintenance_sectors')
        .select('name, sort_order')
        .eq('unit_id', sourceUnitId)
        .eq('is_active', true)

      const { data: existingSectors } = await supabase
        .from('maintenance_sectors').select('name').eq('unit_id', targetUnitId)

      const existingNames = new Set((existingSectors ?? []).map((s) => s.name.toLowerCase()))

      for (const sector of srcSectors ?? []) {
        if (existingNames.has(sector.name.toLowerCase())) { result.skipped++; continue }
        await supabase.from('maintenance_sectors').insert({
          name: sector.name,
          sort_order: sector.sort_order,
          unit_id: targetUnitId,
          is_active: true,
        })
        result.sectors++
      }
    }

    // ── Equipment Categories ─────────────────────────────────────
    if (should('equipmentCategories')) {
      const { data: srcEquipCats } = await supabase
        .from('equipment_categories')
        .select('name, sort_order')
        .eq('unit_id', sourceUnitId)
        .eq('is_active', true)

      const { data: existingEquipCats } = await supabase
        .from('equipment_categories').select('name').eq('unit_id', targetUnitId)

      const existingNames = new Set((existingEquipCats ?? []).map((c) => c.name.toLowerCase()))

      for (const cat of srcEquipCats ?? []) {
        if (existingNames.has(cat.name.toLowerCase())) { result.skipped++; continue }
        await supabase.from('equipment_categories').insert({
          name: cat.name,
          sort_order: cat.sort_order,
          unit_id: targetUnitId,
          is_active: true,
        })
        result.equipmentCategories++
      }
    }

    // ── Service Categories ───────────────────────────────────────
    if (should('serviceCategories')) {
      const { data: srcServiceCats } = await supabase
        .from('service_categories')
        .select('name, slug, description, icon, color, sort_order')
        .eq('unit_id', sourceUnitId)
        .eq('is_active', true)

      const { data: existingServiceCats } = await supabase
        .from('service_categories').select('name').eq('unit_id', targetUnitId)

      const existingNames = new Set((existingServiceCats ?? []).map((c) => c.name.toLowerCase()))

      for (const cat of srcServiceCats ?? []) {
        if (existingNames.has(cat.name.toLowerCase())) { result.skipped++; continue }

        // Garantir slug único na unidade destino
        const baseSlug = cat.slug
        let finalSlug = baseSlug
        const { data: slugConflict } = await supabase
          .from('service_categories').select('id').eq('unit_id', targetUnitId).eq('slug', baseSlug).maybeSingle()
        if (slugConflict) finalSlug = `${baseSlug}-${Date.now()}`

        await supabase.from('service_categories').insert({
          name: cat.name,
          slug: finalSlug,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          sort_order: cat.sort_order,
          unit_id: targetUnitId,
          is_active: true,
        })
        result.serviceCategories++
      }
    }

    console.info('[copy-templates] Resultado:', result)

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[POST /api/units/copy-templates]', err)
    return NextResponse.json({ error: 'Erro interno ao copiar templates.' }, { status: 500 })
  }
}
