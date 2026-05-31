import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { sanitizeReceita } from './receita-utils'

interface TemaReceitaBodyItem {
  variacao_id?: string
  quantidade?: number
  ordem?: number
}

interface TemaBody {
  nome?: string
  categoria?: string | null
  ativo?: boolean
  observacoes?: string | null
  personalizado?: boolean
  decoradora_externa?: boolean
  forminha_cor_ids?: string[]
  foto_url?: string | null
  receita?: TemaReceitaBodyItem[]
}

/** Cria um tema de decoração, seus vínculos com cores de forminha e a receita. */
export async function POST(request: Request) {
  try {
    // Convert-as-we-touch (Bloco B): guard por permissão configurável, não cargo.
    const guard = await requirePermissionApi('decoracao', 'create')
    if (!guard.ok) return guard.response

    const body = (await request.json()) as TemaBody
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome do tema é obrigatório.' }, { status: 400 })
    }

    const forminhaIds = Array.isArray(body.forminha_cor_ids)
      ? body.forminha_cor_ids.filter((v) => typeof v === 'string')
      : []

    const receita = sanitizeReceita(body.receita)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data: tema, error } = await supabase
      .from('decoracao_temas')
      .insert({
        nome,
        categoria: body.categoria?.trim() || null,
        ativo: body.ativo ?? true,
        observacoes: body.observacoes?.trim() || null,
        personalizado: body.personalizado ?? false,
        decoradora_externa: body.decoradora_externa ?? false,
        foto_url: body.foto_url ?? null,
      })
      .select()
      .single()

    if (error) throw error

    if (forminhaIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('decoracao_tema_forminhas')
        .insert(forminhaIds.map((fid) => ({ tema_id: tema.id, forminha_cor_id: fid })))
      if (linkErr) throw linkErr
    }

    // Receita por último — gravação atômica via RPC (reconcilia numa transação).
    if (receita.length > 0) {
      const { error: receitaErr } = await supabase.rpc('update_tema_receita', {
        p_tema_id: tema.id,
        p_itens: receita,
      })
      if (receitaErr) throw receitaErr
    }

    return NextResponse.json({ data: tema })
  } catch (err) {
    console.error('[POST /api/decoracao/temas]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
