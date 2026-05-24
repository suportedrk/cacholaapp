import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES, DECORACAO_DELETE_ROLES } from '@/config/roles'
import type { LocalFormInput } from '@/types/decoracao'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as LocalFormInput
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase
      .from('decoracao_locais')
      .update({
        nome,
        observacoes: body.observacoes?.trim() || null,
        ativo: body.ativo ?? true,
      })
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um local com este nome.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error('[PATCH /api/decoracao/locais/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_DELETE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase
      .from('decoracao_locais')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/locais/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
