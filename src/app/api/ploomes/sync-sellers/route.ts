import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncSellersFromPloomes } from '@/lib/ploomes/sync-sellers'
import { logAudit } from '@/lib/audit'
import { hasRole, SELLERS_MANAGE_ROLES } from '@/config/roles'
import type { Json } from '@/types/database.types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // Verificar sessão
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Verificar role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !hasRole(profile.role, SELLERS_MANAGE_ROLES)) {
      return NextResponse.json(
        { error: 'Sem permissão para sincronizar vendedoras.' },
        { status: 403 },
      )
    }

    // Executar sync
    const result = await syncSellersFromPloomes(supabase)

    // Registrar auditoria
    await logAudit({
      action: 'create',
      module: 'settings',
      entityType: 'sellers_sync',
      newData: result as unknown as Json,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[POST /api/ploomes/sync-sellers]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
