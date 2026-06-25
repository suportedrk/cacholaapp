// GET /api/ploomes/deals/[dealId] — Proxy: deal específico com campos parseados
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { SETTINGS_ROLES } from '@/config/roles'
import { ploomesGetOne } from '@/lib/ploomes/client'
import { loadPloomesConfig } from '@/lib/ploomes/sync'
import { parseDeal } from '@/lib/ploomes/field-mapping'
import type { PloomesDeal } from '@/lib/ploomes/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    // Guard: este proxy usa service_role (ignora RLS) e devolve PII de cliente
    // do CRM — restringir a quem administra a integração (super_admin, diretor).
    const guard = await requireRoleApi(SETTINGS_ROLES)
    if (!guard.ok) return guard.response

    const supabase = await createAdminClient()

    const { dealId } = await params

    const dbConfig = await loadPloomesConfig(supabase, null)
    const userKey = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''

    const deal = await ploomesGetOne<PloomesDeal>(
      `Deals(${dealId})?$expand=OtherProperties,Contact($select=Id,Name,Email,Phones),Attachments`,
      userKey,
    )

    return NextResponse.json({ deal, parsed: parseDeal(deal) })
  } catch (err) {
    console.error('[GET /api/ploomes/deals/[dealId]]', err)
    return NextResponse.json({ error: 'Erro ao buscar deal do Ploomes.' }, { status: 500 })
  }
}
