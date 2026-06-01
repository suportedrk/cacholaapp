import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'

/**
 * Adiciona uma foto à galeria de montagem da festa.
 * A foto já deve estar no storage (o cliente faz o upload diretamente);
 * este endpoint persiste a linha em decoracao_festa_fotos.
 *
 * Guard RBAC dourado: 'decoracao'.'edit'.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as {
      foto_path?: unknown
      legenda?: unknown
      ordem?: unknown
    }

    const foto_path = typeof body.foto_path === 'string' ? body.foto_path.trim() : ''
    if (!foto_path) {
      return NextResponse.json({ error: 'foto_path obrigatório.' }, { status: 400 })
    }

    const legenda = typeof body.legenda === 'string' ? body.legenda.trim() || null : null
    const ordem   = typeof body.ordem   === 'number' ? body.ordem : 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()

    const { data: foto, error } = await supabase
      .from('decoracao_festa_fotos')
      .insert({
        festa_decoracao_id: id,
        foto_path,
        legenda,
        ordem,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(foto, { status: 201 })
  } catch (err) {
    console.error('[POST /api/decoracao/festa/[id]/fotos]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
