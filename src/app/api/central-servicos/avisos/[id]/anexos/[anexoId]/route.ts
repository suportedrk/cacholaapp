import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import { AVISOS_ANEXOS_BUCKET } from '@/types/central-servicos'

/**
 * DELETE /api/central-servicos/avisos/[id]/anexos/[anexoId] — remove um anexo:
 * apaga a linha de metadata E o objeto no Storage. Ambos passam pela RLS do
 * usuário (delete/edit). Guard: check_permission('central_servicos', 'delete') OU 'edit'.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; anexoId: string }> },
) {
  try {
    let guard = await requirePermissionApi('central_servicos', 'delete')
    if (!guard.ok) guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { anexoId } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    // 1. Busca o storage_path (RLS de view garante que só vê o que pode).
    const { data: anexo, error: fetchErr } = await supabase
      .from('central_servicos_aviso_anexos')
      .select('id, storage_path')
      .eq('id', anexoId)
      .single()

    if (fetchErr || !anexo) {
      return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
    }

    // 2. Remove a linha (RLS de delete reforça a permissão).
    const { error: delErr } = await supabase
      .from('central_servicos_aviso_anexos')
      .delete()
      .eq('id', anexoId)
    if (delErr) throw delErr

    // 3. Remove o objeto do Storage (best-effort; RLS de delete do bucket reforça).
    const { error: storageErr } = await supabase.storage
      .from(AVISOS_ANEXOS_BUCKET)
      .remove([anexo.storage_path])
    if (storageErr) {
      // A linha já saiu; um objeto órfão no bucket não quebra a UI. Apenas loga.
      console.error('[DELETE anexo] objeto de storage não removido:', storageErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/central-servicos/avisos/[id]/anexos/[anexoId]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
