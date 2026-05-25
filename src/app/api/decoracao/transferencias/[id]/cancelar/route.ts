import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'

/**
 * POST /api/decoracao/transferencias/[id]/cancelar
 * Cancela a transferência em trânsito: devolve saldo à origem, status='cancelada'.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 })
    }

    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('cancelar_transferencia', {
      p_id: id,
    })

    if (error) {
      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Sem permissão para cancelar transferência.' },
          { status: 403 },
        )
      }
      const message =
        typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : 'Erro ao cancelar transferência.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/decoracao/transferencias/[id]/cancelar]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
