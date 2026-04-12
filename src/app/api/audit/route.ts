import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Identificar o usuário autenticado via ANON key (respeita sessão)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Inserir via service_role para contornar RLS
    const admin = await createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      user_id: user.id,
      action: body.action,
      module: body.module,
      entity_id: body.entityId ?? null,
      entity_type: body.entityType ?? body.module,
      old_data: body.oldData ?? null,
      new_data: body.newData ?? null,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
    })

    if (error) {
      console.error('[audit route]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[audit route]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
