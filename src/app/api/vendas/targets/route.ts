import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { VENDAS_TARGETS_MANAGE_ROLES } from '@/config/roles'
import { logAudit } from '@/lib/audit'

/**
 * Metas de venda (faturamento) por vendedora/mês — cadastro manual.
 *
 * POST   { seller_id, period_month, target_revenue } → upsert da meta do mês.
 * DELETE { seller_id, period_month }                 → remove a meta do mês.
 *
 * Guard: requireRoleApi(VENDAS_TARGETS_MANAGE_ROLES) = super_admin + diretor
 * (decisão de produto; recusa escrita sob "Ver como"). Role-based de propósito:
 * o módulo 'vendas','edit' do template inclui gerente (drift), e a decisão é só
 * diretoria. RLS da tabela (check_permission 'vendas','edit') é defesa adicional;
 * a escrita roda via createAdminClient (com sessão, atua como o próprio usuário).
 */

const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/
const MAX_REVENUE = 9_999_999_999.99 // teto do numeric(12,2)

/** 'YYYY-MM' ou 'YYYY-MM-DD' → 'YYYY-MM-01' (1º dia do mês, exigido pelo CHECK). */
function toFirstOfMonth(raw: string): string | null {
  if (!MONTH_RE.test(raw)) return null
  const [y, m] = raw.split('-')
  const mm = Number(m)
  if (mm < 1 || mm > 12) return null
  return `${y}-${m}-01`
}

async function resolveSeller(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  sellerId: unknown,
): Promise<
  | { ok: true; seller: { id: string; primary_unit_id: string | null } }
  | { ok: false; response: NextResponse }
> {
  if (typeof sellerId !== 'string' || !sellerId) {
    return { ok: false, response: NextResponse.json({ error: 'seller_id inválido.' }, { status: 400 }) }
  }
  const { data: seller } = await admin
    .from('sellers')
    .select('id, status, is_system_account, primary_unit_id')
    .eq('id', sellerId)
    .maybeSingle() as {
      data: { id: string; status: string; is_system_account: boolean; primary_unit_id: string | null } | null
    }
  if (!seller) {
    return { ok: false, response: NextResponse.json({ error: 'Vendedora não encontrada.' }, { status: 404 }) }
  }
  if (seller.status !== 'active' || seller.is_system_account) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Vendedora inválida: inativa ou conta de sistema.' },
        { status: 400 },
      ),
    }
  }
  return { ok: true, seller: { id: seller.id, primary_unit_id: seller.primary_unit_id } }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(VENDAS_TARGETS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    let body: { seller_id?: unknown; period_month?: unknown; target_revenue?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
    }

    const period = typeof body.period_month === 'string' ? toFirstOfMonth(body.period_month) : null
    if (!period) {
      return NextResponse.json({ error: 'Mês inválido (use AAAA-MM).' }, { status: 400 })
    }

    const revenue = Number(body.target_revenue)
    if (!Number.isFinite(revenue) || revenue < 0 || revenue > MAX_REVENUE) {
      return NextResponse.json({ error: 'Valor da meta inválido.' }, { status: 400 })
    }

    const admin = await createAdminClient()
    const sellerCheck = await resolveSeller(admin, body.seller_id)
    if (!sellerCheck.ok) return sellerCheck.response
    const seller = sellerCheck.seller

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('sales_targets')
      .upsert(
        {
          seller_id: seller.id,
          unit_id: seller.primary_unit_id,
          period_month: period,
          target_revenue: revenue,
          created_by: guard.userId, // auth garantido pelo guard (não vem do payload)
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id,period_month' },
      )
    if (error) {
      console.error('[vendas/targets] upsert', error)
      return NextResponse.json({ error: 'Erro ao salvar a meta.' }, { status: 500 })
    }

    void logAudit({
      action: 'update',
      module: 'settings',
      entityType: 'sales_target',
      newData: { seller_id: seller.id, period_month: period, target_revenue: revenue },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[vendas/targets][POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireRoleApi(VENDAS_TARGETS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    let body: { seller_id?: unknown; period_month?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
    }

    const period = typeof body.period_month === 'string' ? toFirstOfMonth(body.period_month) : null
    if (!period) {
      return NextResponse.json({ error: 'Mês inválido (use AAAA-MM).' }, { status: 400 })
    }
    if (typeof body.seller_id !== 'string' || !body.seller_id) {
      return NextResponse.json({ error: 'seller_id inválido.' }, { status: 400 })
    }

    const admin = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('sales_targets')
      .delete()
      .eq('seller_id', body.seller_id)
      .eq('period_month', period)
    if (error) {
      console.error('[vendas/targets] delete', error)
      return NextResponse.json({ error: 'Erro ao remover a meta.' }, { status: 500 })
    }

    void logAudit({
      action: 'delete',
      module: 'settings',
      entityType: 'sales_target',
      oldData: { seller_id: body.seller_id, period_month: period },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[vendas/targets][DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
