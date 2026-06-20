import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit'

// Allowlist em runtime derivada da lista oficial (src/lib/audit.ts).
// Sem isso, qualquer autenticado podia gravar action/module arbitrários
// e forjar a trilha de auditoria.
const VALID_ACTIONS = new Set<string>(AUDIT_ACTIONS)
const VALID_MODULES = new Set<string>(AUDIT_MODULES)

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar ANTES de ler/processar o corpo da requisição.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Ler o corpo e validar contra a lista oficial de ações/módulos.
    const body = await req.json()
    if (typeof body?.action !== 'string' || !VALID_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: 'Ação de auditoria inválida.' }, { status: 400 })
    }
    if (typeof body?.module !== 'string' || !VALID_MODULES.has(body.module)) {
      return NextResponse.json({ error: 'Módulo de auditoria inválido.' }, { status: 400 })
    }

    // 3. Inserir via service_role para contornar RLS.
    const admin = await createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      user_id: user.id,
      action: body.action,
      module: body.module,
      entity_id: typeof body.entityId === 'string' ? body.entityId : null,
      entity_type: typeof body.entityType === 'string' ? body.entityType : body.module,
      old_data: body.oldData ?? null,
      new_data: body.newData ?? null,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
    })

    if (error) {
      // Não ecoar o payload (pode conter PII): só código/mensagem do erro.
      console.error('[audit route] falha ao inserir:', error.code ?? error.message)
      return NextResponse.json({ error: 'Falha ao registrar auditoria.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    console.error('[audit route] erro inesperado ao processar requisição')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
