import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/sellers/[id]/link
 *
 * Vincula ou desvincula uma vendedora (sellers.id) a um usuário (users.seller_id).
 * Body: { user_id: string }  → vincula a vendedora ao usuário informado.
 *       { user_id: null }    → desvincula a vendedora do usuário atual (no-op se já solta).
 *
 * Guard: ADMIN_USERS_MANAGE_ROLES (super_admin + diretor) — é escrita em `users`.
 * O `requireRoleApi` já recusa escrita sob "Ver como" (impersonação read-only).
 * A coluna `users.seller_id` é protegida pelo trigger 171 (exige `usuarios:edit`);
 * o mesmo caminho do convite (POST /api/admin/users) já grava seller_id assim.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id: sellerId } = await params

    let body: { user_id?: string | null }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
    }

    // user_id deve ser string (vincular) ou null explícito (desvincular).
    const userId = body.user_id ?? null
    if (userId !== null && typeof userId !== 'string') {
      return NextResponse.json({ error: 'user_id inválido.' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // ── Vendedora existe? ────────────────────────────────────────────────────
    const { data: seller } = await supabase
      .from('sellers')
      .select('id, name, status, is_system_account')
      .eq('id', sellerId)
      .maybeSingle() as {
        data: { id: string; name: string; status: string; is_system_account: boolean } | null
      }
    if (!seller) {
      return NextResponse.json({ error: 'Vendedora não encontrada.' }, { status: 404 })
    }

    // Usuário atualmente vinculado a esta vendedora (se houver).
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, name')
      .eq('seller_id', sellerId)
      .maybeSingle() as { data: { id: string; name: string } | null }

    // ── Desvincular ──────────────────────────────────────────────────────────
    if (userId === null) {
      if (!currentUser) {
        // Já estava sem vínculo — idempotente.
        return NextResponse.json({ ok: true, linked: false })
      }
      const { error: updErr } = await supabase
        .from('users')
        .update({ seller_id: null })
        .eq('id', currentUser.id)
      if (updErr) {
        console.error('[sellers/link] unlink', updErr)
        return NextResponse.json({ error: 'Erro ao desvincular.' }, { status: 500 })
      }
      void logAudit({
        action: 'update',
        module: 'users',
        entityId: currentUser.id,
        entityType: 'user',
        oldData: { seller_id: sellerId, seller_name: seller.name },
        newData: { seller_id: null },
      })
      return NextResponse.json({ ok: true, linked: false })
    }

    // ── Vincular ─────────────────────────────────────────────────────────────
    // Espelha as validações do convite (POST /api/admin/users).
    if (seller.status !== 'active' || seller.is_system_account) {
      return NextResponse.json(
        { error: 'Vendedora inválida: inativa ou conta de sistema.' },
        { status: 400 },
      )
    }
    // A vendedora não pode já estar vinculada a outro usuário (índice único garante isso).
    if (currentUser) {
      return NextResponse.json(
        { error: 'Esta vendedora já está vinculada a outro usuário. Desvincule primeiro.' },
        { status: 409 },
      )
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('id, name, is_active, seller_id')
      .eq('id', userId)
      .maybeSingle() as {
        data: { id: string; name: string; is_active: boolean; seller_id: string | null } | null
      }
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 400 })
    }
    if (!targetUser.is_active) {
      return NextResponse.json({ error: 'Usuário inativo.' }, { status: 400 })
    }
    if (targetUser.seller_id) {
      return NextResponse.json(
        { error: 'Este usuário já está vinculado a outra vendedora.' },
        { status: 400 },
      )
    }

    const { error: linkErr } = await supabase
      .from('users')
      .update({ seller_id: sellerId })
      .eq('id', userId)
    if (linkErr) {
      // Corrida com outra requisição: o índice único uniq_users_seller_id_not_null
      // (ou o vínculo do usuário) foi tomado entre a checagem e o UPDATE.
      if ((linkErr as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: 'Vínculo já tomado por outra operação. Recarregue e tente novamente.' },
          { status: 409 },
        )
      }
      console.error('[sellers/link] link', linkErr)
      return NextResponse.json({ error: 'Erro ao vincular.' }, { status: 500 })
    }
    void logAudit({
      action: 'update',
      module: 'users',
      entityId: targetUser.id,
      entityType: 'user',
      oldData: { seller_id: null },
      newData: { seller_id: sellerId, seller_name: seller.name },
    })
    return NextResponse.json({ ok: true, linked: true })
  } catch (err) {
    console.error('[sellers/link]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
