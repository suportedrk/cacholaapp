// /admin/unidades/[id]/setup — Wizard de setup para unidade existente
// Permissão: apenas super_admin e diretor.

import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { UnitSetupWizard } from '../../setup/components/UnitSetupWizard'
import type { UnitSetupStatus } from '@/hooks/use-unit-setup'

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default async function UnitSetupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: unitId } = await params
  const supabase = await createAdminClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!profile || !['super_admin', 'diretor'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Carregar unidade
  const { data: unit } = await supabase
    .from('units').select('id, name, slug, address, phone, is_active').eq('id', unitId).single()

  if (!unit) redirect('/admin/unidades')

  // Carregar status inicial (server-side para evitar flash)
  const [
    { data: ploomesMapping },
    { count: checklistTemplates },
    { count: checklistCategories },
    { count: sectors },
    { count: equipmentCategories },
    { count: serviceCategories },
    { count: teamCount },
    { count: providerCount },
    { count: dealCount },
  ] = await Promise.all([
    supabase.from('ploomes_unit_mapping').select('id, ploomes_value').eq('unit_id', unitId).maybeSingle(),
    supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
    supabase.from('checklist_categories').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
    supabase.from('sectors').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
    supabase.from('equipment_categories').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
    supabase.from('service_categories').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('is_active', true),
    supabase.from('user_units').select('id', { count: 'exact', head: true }).eq('unit_id', unitId),
    supabase.from('service_providers').select('id', { count: 'exact', head: true }).eq('unit_id', unitId).eq('status', 'active'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('unit_id', unitId),
  ])

  const initialStatus: UnitSetupStatus = {
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
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/unidades"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Unidades
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Configurar: {unit.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete o setup desta unidade em 5 etapas.
          {initialStatus.dealCount > 0 && (
            <> · <span className="text-primary font-medium">{initialStatus.dealCount} deals sincronizados</span></>
          )}
        </p>
      </div>

      {/* Wizard */}
      <UnitSetupWizard unitId={unitId} initialStatus={initialStatus} />
    </div>
  )
}
