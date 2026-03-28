// POST /api/ploomes/webhook-register — Registra o webhook no Ploomes CRM
//
// Chama a API do Ploomes para registrar a URL do webhook neste app.
// Apenas super_admin pode executar.
//
// Body: { unit_id: string }
// Após registro: salva webhook_url e webhook_registered_at em ploomes_config.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const USER_KEY    = process.env.PLOOMES_USER_KEY ?? ''
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const PLOOMES_API = 'https://api2.ploomes.com'

// ── Tipos da API Ploomes ──────────────────────────────────────

type PloomesWebhook = {
  Id: number
  Url: string
  EntityName: string
  Actions?: string[]
  IsActive?: boolean
}

type PloomesODataResponse<T> = {
  value: T[]
}

// ── Helpers Ploomes API ───────────────────────────────────────

async function ploomesFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!USER_KEY) throw new Error('PLOOMES_USER_KEY não configurada.')

  const res = await fetch(`${PLOOMES_API}/${path}`, {
    ...options,
    headers: {
      'User-Key': USER_KEY,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ploomes API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ── Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Apenas super_admin
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabaseUser
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super_admin pode registrar webhooks.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { unit_id?: string } | null
  const unitId = body?.unit_id

  if (!unitId) {
    return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  }

  const webhookUrl = `${APP_URL}/api/webhooks/ploomes`

  try {
    // ── 1. Verificar se já existe webhook para esta URL ───────
    const existing = await ploomesFetch<PloomesODataResponse<PloomesWebhook>>(
      `Webhooks?$filter=Url eq '${encodeURIComponent(webhookUrl)}'`,
    )

    let webhookId: number | null = null

    if (existing.value.length > 0) {
      // Já registrado — apenas atualizar o registro no banco
      webhookId = existing.value[0].Id
      console.info(`[webhook-register] Webhook já registrado no Ploomes (Id=${webhookId})`)
    } else {
      // ── 2. Registrar webhook novo no Ploomes ─────────────────
      const created = await ploomesFetch<PloomesWebhook>('Webhooks', {
        method: 'POST',
        body: JSON.stringify({
          Url: webhookUrl,
          EntityName: 'Deal',
          // Ações que disparam o webhook
          Actions: ['Win', 'Update'],
          IsActive: true,
        }),
      })

      webhookId = created.Id
      console.info(`[webhook-register] Webhook registrado no Ploomes (Id=${webhookId})`)
    }

    // ── 3. Persistir em ploomes_config ────────────────────────
    const supabase = await createAdminClient()

    const { error: updateError } = await supabase
      .from('ploomes_config')
      .update({
        webhook_url: webhookUrl,
        webhook_registered_at: new Date().toISOString(),
      })
      .eq('unit_id', unitId)

    if (updateError) {
      console.error('[webhook-register] Erro ao salvar no banco:', updateError)
      return NextResponse.json(
        { error: 'Webhook registrado no Ploomes, mas falha ao salvar no banco.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      webhookId,
      webhookUrl,
      message: 'Webhook registrado com sucesso no Ploomes.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ploomes/webhook-register]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
