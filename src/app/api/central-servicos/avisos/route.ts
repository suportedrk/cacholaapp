import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import {
  AVISO_CATEGORIAS,
  AVISO_PRIORIDADES,
  CONTATO_UNIDADES,
  type AvisoFormInput,
} from '@/types/central-servicos'

/**
 * POST /api/central-servicos/avisos — publica um aviso.
 * Guard: check_permission('central_servicos', 'create'). A RLS reforça no banco.
 */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'create')
    if (!guard.ok) return guard.response

    const body = (await request.json()) as AvisoFormInput
    const titulo = body.titulo?.trim()
    const conteudo = body.conteudo?.trim()

    if (!titulo) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 })
    if (!conteudo) return NextResponse.json({ error: 'Conteúdo é obrigatório.' }, { status: 400 })
    if (!AVISO_CATEGORIAS.includes(body.categoria)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }
    if (!AVISO_PRIORIDADES.includes(body.prioridade)) {
      return NextResponse.json({ error: 'Prioridade inválida.' }, { status: 400 })
    }
    if (!CONTATO_UNIDADES.includes(body.unidade)) {
      return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { data: userRes } = await supabase.auth.getUser()
    const created_by = userRes?.user?.id ?? null

    const { data, error } = await supabase
      .from('central_servicos_avisos')
      .insert({
        titulo,
        conteudo,
        categoria: body.categoria,
        prioridade: body.prioridade,
        unidade: body.unidade,
        publicado_em: body.publicado_em || new Date().toISOString(),
        expira_em: body.expira_em || null,
        created_by,
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/central-servicos/avisos]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
