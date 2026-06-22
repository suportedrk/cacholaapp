import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit'

// Allowlist em runtime derivada da lista oficial (src/lib/audit.ts).
// Sem isso, qualquer autenticado podia gravar action/module arbitrários
// e forjar a trilha de auditoria.
const VALID_ACTIONS = new Set<string>(AUDIT_ACTIONS)
const VALID_MODULES = new Set<string>(AUDIT_MODULES)

// Limites para old_data/new_data. A policy RLS de INSERT em audit_logs é
// WITH CHECK (TRUE), então o servidor é a única barreira contra payload
// abusivo de um autenticado. Não montamos allowlist de chaves por entity_type
// (custaria um registry por tipo); travamos forma + tamanho, que cobre o vetor.
const MAX_AUDIT_FIELD_BYTES = 16 * 1024 // 16 KB por campo (old_data / new_data)
const MAX_AUDIT_FIELD_KEYS = 100

/**
 * Valida um campo de diff de auditoria (old_data/new_data).
 * Aceita: ausente/null, ou objeto JSON simples (não array, não primitivo)
 * com no máx. MAX_AUDIT_FIELD_KEYS chaves e MAX_AUDIT_FIELD_BYTES serializado.
 * Retorna mensagem de erro (PT-BR) ou null se válido.
 */
function validateAuditField(label: string, value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    return `${label} deve ser um objeto.`
  }
  if (Object.keys(value as Record<string, unknown>).length > MAX_AUDIT_FIELD_KEYS) {
    return `${label} excede o número máximo de campos.`
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_AUDIT_FIELD_BYTES) {
    return `${label} excede o tamanho máximo permitido.`
  }
  return null
}

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

    // 2b. Travar forma e tamanho de old_data/new_data (anti-payload abusivo).
    const oldDataErr = validateAuditField('old_data', body.oldData)
    if (oldDataErr) return NextResponse.json({ error: oldDataErr }, { status: 400 })
    const newDataErr = validateAuditField('new_data', body.newData)
    if (newDataErr) return NextResponse.json({ error: newDataErr }, { status: 400 })

    // 2c. Teto de tamanho em entity_type/entity_id (TEXT sem cap no schema,
    // mesma policy WITH CHECK(TRUE) → mesmo vetor de bloat que old/new_data).
    const entityType = typeof body.entityType === 'string'
      ? body.entityType.slice(0, 200)
      : body.module
    const entityId = typeof body.entityId === 'string'
      ? body.entityId.slice(0, 200)
      : null

    // x-forwarded-for pode vir como "ip1, ip2, ip3" ou forjado; a coluna é INET
    // e rejeita lixo → INSERT 500 → trilha perdida em silêncio. Pega só o 1º IP
    // e zera se não tiver cara de IP (evita quebrar o insert por header malformado).
    const rawIp = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '')
      .split(',')[0]
      .trim()
    const ip = /^[0-9a-fA-F.:]{1,45}$/.test(rawIp) ? rawIp : null

    // 3. Inserir via service_role para contornar RLS.
    const admin = await createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      user_id: user.id,
      action: body.action,
      module: body.module,
      entity_id: entityId,
      entity_type: entityType,
      old_data: body.oldData ?? null,
      new_data: body.newData ?? null,
      ip,
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
