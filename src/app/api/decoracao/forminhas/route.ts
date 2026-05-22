import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Cria uma cor de forminha para um número 1–26 ainda livre. */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as {
      numero?: number
      nome?: string
      cor_hex?: string | null
      ativo?: boolean
    }

    const numero = Number(body.numero)
    const nome = body.nome?.trim()
    const cor_hex = body.cor_hex?.trim() || null

    if (!Number.isInteger(numero) || numero < 1 || numero > 26) {
      return NextResponse.json({ error: 'Número deve ser um inteiro entre 1 e 26.' }, { status: 400 })
    }
    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }
    if (cor_hex && !HEX_RE.test(cor_hex)) {
      return NextResponse.json({ error: 'Cor inválida — use o formato #RRGGBB.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any

    const { data, error } = await supabase
      .from('decoracao_forminha_cores')
      .insert({ numero, nome, cor_hex, ativo: body.ativo ?? true })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Já existe a forminha número ${numero}.` }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[POST /api/decoracao/forminhas]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
