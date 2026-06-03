import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/central-servicos/contatos/[id]/membros — adiciona um membro ao grupo.
 * [id] = grupo (contato tipo grupo); body { membro_id } = contato tipo pessoa.
 * Adicionar membro = EDITAR o grupo → guard check_permission('central_servicos','edit').
 * A regra grupo×pessoa é reforçada pelo trigger trg_validate_grupo_membro.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { id: grupoId } = await params
    const body = (await request.json()) as { membro_id?: string }
    const membroId = body.membro_id?.trim()
    if (!membroId) return NextResponse.json({ error: 'membro_id é obrigatório.' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    // Validação amigável (o trigger é o backstop autoritativo).
    const { data: contatos } = await supabase
      .from('central_servicos_contatos')
      .select('id, tipo')
      .in('id', [grupoId, membroId])

    const grupo = contatos?.find((c: { id: string }) => c.id === grupoId)
    const membro = contatos?.find((c: { id: string }) => c.id === membroId)
    if (!grupo || grupo.tipo !== 'grupo') {
      return NextResponse.json({ error: 'O destino não é um grupo.' }, { status: 400 })
    }
    if (!membro || membro.tipo !== 'pessoa') {
      return NextResponse.json({ error: 'Só é possível adicionar pessoas a um grupo.' }, { status: 400 })
    }

    const { data: userRes } = await supabase.auth.getUser()
    const created_by = userRes?.user?.id ?? null

    const { data, error } = await supabase
      .from('central_servicos_grupo_membros')
      .insert({ grupo_id: grupoId, membro_id: membroId, created_by })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Esta pessoa já é membro do grupo.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/central-servicos/contatos/[id]/membros]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
