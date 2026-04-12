// POST /api/ploomes/sync — Dispara sincronização manual com o Ploomes CRM
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDeals } from '@/lib/ploomes/sync'
import { logAudit } from '@/lib/audit'

const DEBOUNCE_MS = 2 * 60 * 1000 // 2 minutos

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // Verificar sessão
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Verificar permissão (super_admin, diretor ou gerente)
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'diretor', 'gerente'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão para disparar sync.' }, { status: 403 })
    }

    // Debounce: checar se já tem sync rodando nos últimos 2 minutos
    const { data: runningSync } = await supabase
      .from('ploomes_sync_log')
      .select('id, started_at')
      .eq('status', 'running')
      .gte('started_at', new Date(Date.now() - DEBOUNCE_MS).toISOString())
      .limit(1)
      .single()

    if (runningSync) {
      return NextResponse.json(
        { error: 'Uma sincronização já está em andamento. Aguarde 2 minutos.' },
        { status: 429 },
      )
    }

    // Opcional: filtrar por unidade específica
    const body = await req.json().catch(() => ({}))
    const unitId: string | null = body?.unit_id ?? null

    // Executar sync
    const result = await syncDeals(supabase, {
      triggeredBy: 'manual',
      triggeredByUserId: user.id,
      unitId,
    })

    // Audit log
    await logAudit({
      action: 'create',
      module: 'events',
      entityType: 'ploomes_sync',
      newData: result as unknown as import('@/types/database.types').Json,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[POST /api/ploomes/sync]', err)
    return NextResponse.json({ error: 'Erro interno ao executar sync.' }, { status: 500 })
  }
}
