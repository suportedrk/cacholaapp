import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import type { CategoriaFormInput } from '@/types/decoracao'

export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('decoracao', 'create')
    if (!guard.ok) return guard.response

    const body = (await request.json()) as CategoriaFormInput
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data: userRes } = await supabase.auth.getUser()
    const created_by = userRes?.user?.id ?? null

    // Calcular MAX(ordem)+1 para novas categorias irem ao final da lista
    const { data: maxRow } = await supabase
      .from('decoracao_categorias')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
      .single()

    const ordem = maxRow ? (maxRow.ordem as number) + 1 : 0

    const { data, error } = await supabase
      .from('decoracao_categorias')
      .insert({ nome, ativo: body.ativo ?? true, ordem, created_by })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe uma categoria com este nome.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/decoracao/categorias]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
