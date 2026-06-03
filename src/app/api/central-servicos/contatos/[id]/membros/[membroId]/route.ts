import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/central-servicos/contatos/[id]/membros/[membroId] — remove um membro do grupo.
 * Remover membro = EDITAR o grupo → guard check_permission('central_servicos','edit').
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; membroId: string }> },
) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { id: grupoId, membroId } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase
      .from('central_servicos_grupo_membros')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('membro_id', membroId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/central-servicos/contatos/[id]/membros/[membroId]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
