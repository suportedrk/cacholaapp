import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Edita campos de uma cor de forminha — aceita patch parcial. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as {
      nome?: string
      cor_hex?: string | null
      ativo?: boolean
      foto_url?: string | null
    }

    const patch: Record<string, unknown> = {}

    if ('nome' in body) {
      const nome = body.nome?.trim()
      if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
      patch.nome = nome
    }
    if ('cor_hex' in body) {
      const cor_hex = body.cor_hex?.trim() || null
      if (cor_hex && !HEX_RE.test(cor_hex)) {
        return NextResponse.json({ error: 'Cor inválida — use o formato #RRGGBB.' }, { status: 400 })
      }
      patch.cor_hex = cor_hex
    }
    if ('ativo' in body) patch.ativo = body.ativo
    if ('foto_url' in body) patch.foto_url = body.foto_url ?? null

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data, error } = await supabase
      .from('decoracao_forminha_cores')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Cor de forminha não encontrada.' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PATCH /api/decoracao/forminhas/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
