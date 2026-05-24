import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'
import type { LocalFormInput } from '@/types/decoracao'

export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as LocalFormInput
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data: user } = await supabase.auth.getUser()
    const created_by = user?.user?.id ?? null

    const { data, error } = await supabase
      .from('decoracao_locais')
      .insert({
        nome,
        observacoes: body.observacoes?.trim() || null,
        ativo: body.ativo ?? true,
        created_by,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um local com este nome.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/decoracao/locais]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
