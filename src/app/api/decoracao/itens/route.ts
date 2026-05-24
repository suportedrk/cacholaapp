import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'
import type { ItemFormInput } from '@/types/decoracao'

function mapPgError(code?: string, msg?: string): { status: number; error: string } | null {
  if (code === '42501') return { status: 403, error: 'Sem permissão para esta operação.' }
  if (msg === 'nome_obrigatorio') return { status: 400, error: 'Nome é obrigatório.' }
  if (msg === 'tipo_invalido') return { status: 400, error: 'Tipo deve ser próprio ou alugado.' }
  if (msg === 'pelo_menos_uma_variacao') return { status: 400, error: 'Cadastre pelo menos uma variação.' }
  if (code === '23514') return { status: 400, error: 'Dados inválidos: verifique os campos da variação.' }
  return null
}

/** Cria item + variações em uma transação atômica via RPC. */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as ItemFormInput
    const nome = body.nome?.trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    if (body.tipo !== 'proprio' && body.tipo !== 'alugado') {
      return NextResponse.json({ error: 'Tipo deve ser próprio ou alugado.' }, { status: 400 })
    }
    if (!Array.isArray(body.variacoes) || body.variacoes.length === 0) {
      return NextResponse.json({ error: 'Cadastre pelo menos uma variação.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data, error } = await supabase.rpc('create_decoracao_item_with_variacoes', {
      p_nome: nome,
      p_tipo: body.tipo,
      p_fornecedor_id: body.tipo === 'alugado' ? body.fornecedor_id ?? null : null,
      p_foto_path: body.foto_path ?? null,
      p_observacoes: body.observacoes?.trim() || null,
      p_ativo: body.ativo ?? true,
      p_variacoes: body.variacoes,
    })

    if (error) {
      const mapped = mapPgError(error.code, error.message)
      if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      throw error
    }

    return NextResponse.json({ data: { id: data } })
  } catch (err) {
    console.error('[POST /api/decoracao/itens]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
