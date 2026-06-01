import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { DECORACAO_BUCKETS } from '@/lib/constants'

/**
 * DELETE — Remove uma foto da galeria: apaga a linha no banco e o
 * arquivo no storage. Ordem: DB primeiro (mais seguro — se storage
 * falhar, o órfão é coberto pelo cron futuro; o inverso deixaria
 * referência quebrada no banco).
 *
 * PATCH — Atualiza apenas a legenda da foto.
 *
 * Guard RBAC dourado: 'decoracao'.'edit' (remover/editar foto = editar
 * a decoração, sem exigir 'delete' separado — alinhado com a RLS).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fotoId: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id, fotoId } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    // Busca para confirmar que pertence à festa correta e obter o path.
    const { data: foto, error: fetchErr } = await supabase
      .from('decoracao_festa_fotos')
      .select('id, foto_path')
      .eq('id', fotoId)
      .eq('festa_decoracao_id', id)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!foto) {
      return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    }

    // 1. Remove a linha do banco (ordem segura: DB primeiro).
    const { error: deleteErr } = await supabase
      .from('decoracao_festa_fotos')
      .delete()
      .eq('id', fotoId)

    if (deleteErr) throw deleteErr

    // 2. Remove o arquivo do storage (fire-and-forget; órfão coberto por cron futuro).
    supabase.storage
      .from(DECORACAO_BUCKETS.festa)
      .remove([foto.foto_path])
      .catch((err: unknown) => {
        console.warn('[DELETE foto storage orphan]', foto.foto_path, err)
      })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/festa/[id]/fotos/[fotoId]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; fotoId: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id, fotoId } = await params
    const body = (await request.json()) as { legenda?: unknown }

    const legenda = typeof body.legenda === 'string' ? body.legenda.trim() || null : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase
      .from('decoracao_festa_fotos')
      .update({ legenda })
      .eq('id', fotoId)
      .eq('festa_decoracao_id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/decoracao/festa/[id]/fotos/[fotoId]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
