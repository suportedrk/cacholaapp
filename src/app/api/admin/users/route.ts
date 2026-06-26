import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import {
  hasRole,
  ADMIN_USERS_MANAGE_ROLES,
  VENDEDORA_ROLES,
  UNIT_OPTIONAL_AT_CREATION_ROLES,
  SYSTEM_ONLY_ROLES,
} from '@/config/roles'
import { applyRoleTemplate } from '@/lib/rbac/apply-template'
import { ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/types/database.types'

const VALID_ROLES = Object.keys(ROLE_LABELS) as UserRole[]

interface UnitLink {
  unit_id: string
  is_default: boolean
}

export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const adminSupabase = await createAdminClient()

    const body = await request.json()
    const { name, email, phone, role, seller_id, units } = body as {
      name: string
      email: string
      phone: string | null
      role: UserRole
      seller_id?: string | null
      units?: UnitLink[]
    }

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    // ── Allowlist do cargo (anti mass-assignment) ───────────────────────────
    // `role` vem do cliente; o tipo TypeScript é apagado no build. Validar em
    // runtime contra o catálogo de cargos impede injeção de valor arbitrário.
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Cargo inválido.' }, { status: 400 })
    }
    // Menor privilégio: cargo de sistema (super_admin) só pode ser atribuído
    // por quem já é super_admin — espelha a semântica de SYSTEM_ONLY_ROLES.
    if (hasRole(role, SYSTEM_ONLY_ROLES) && !hasRole(guard.role, SYSTEM_ONLY_ROLES)) {
      return NextResponse.json(
        { error: 'Apenas um Super Admin pode criar outro Super Admin.' },
        { status: 403 }
      )
    }

    // ── Validação de vendedora (vínculo seller_id) ──────────────────────────
    if (hasRole(role, VENDEDORA_ROLES) && !seller_id) {
      return NextResponse.json(
        { error: 'Campo "Vincular à vendedora" é obrigatório para o cargo Vendedora.' },
        { status: 400 }
      )
    }

    if (hasRole(role, VENDEDORA_ROLES) && seller_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sellerCheck } = await (adminSupabase as any)
        .from('sellers')
        .select('id, status, is_system_account')
        .eq('id', seller_id)
        .maybeSingle() as { data: { id: string; status: string; is_system_account: boolean } | null }
      if (!sellerCheck) {
        return NextResponse.json({ error: 'Vendedora não encontrada.' }, { status: 400 })
      }
      if (sellerCheck.status !== 'active' || sellerCheck.is_system_account) {
        return NextResponse.json(
          { error: 'Vendedora inválida: inativa ou conta de sistema.' },
          { status: 400 }
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingUser } = await (adminSupabase as any)
        .from('users')
        .select('id')
        .eq('seller_id', seller_id)
        .maybeSingle() as { data: { id: string } | null }
      if (existingUser) {
        return NextResponse.json(
          { error: 'Esta vendedora já está vinculada a outro usuário.' },
          { status: 400 }
        )
      }
    }

    // ── Validação de unidades (feita ANTES do convite p/ não criar conta órfã) ─
    // Cargos operacionais exigem ao menos 1 unidade; super_admin/diretor (visão
    // global) podem ser criados sem unidade específica.
    const unitRequired = !hasRole(role, UNIT_OPTIONAL_AT_CREATION_ROLES)
    const rawUnits = Array.isArray(units) ? units : []
    // Dedup por unit_id, preservando a marcação de padrão
    const uniqueUnitIds = [...new Set(rawUnits.map((u) => u.unit_id).filter(Boolean))]

    if (unitRequired && uniqueUnitIds.length === 0) {
      return NextResponse.json(
        { error: 'Selecione ao menos 1 unidade para este cargo.' },
        { status: 400 }
      )
    }

    if (uniqueUnitIds.length > 0) {
      const { data: validUnits, error: unitsErr } = await adminSupabase
        .from('units')
        .select('id, is_active')
        .in('id', uniqueUnitIds)
        .returns<{ id: string; is_active: boolean }[]>()
      if (unitsErr) {
        console.error('[POST /api/admin/users] units validation', unitsErr)
        return NextResponse.json({ error: 'Erro ao validar unidades.' }, { status: 500 })
      }
      const validIds = new Set((validUnits ?? []).filter((u) => u.is_active).map((u) => u.id))
      const invalid = uniqueUnitIds.filter((id) => !validIds.has(id))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: 'Uma ou mais unidades selecionadas são inválidas ou estão inativas.' },
          { status: 400 }
        )
      }
    }

    // Garante EXATAMENTE 1 unidade padrão (invariante de user_units.is_default).
    // Respeita a marcação do form; se nenhuma/várias vierem como padrão, usa a 1ª.
    const requestedDefault = rawUnits.find((u) => u.is_default && uniqueUnitIds.includes(u.unit_id))
    const defaultUnitId = requestedDefault?.unit_id ?? uniqueUnitIds[0] ?? null
    const unitRows = uniqueUnitIds.map((unit_id) => ({
      unit_id,
      is_default: unit_id === defaultUnitId,
    }))

    // ── Convite + gravação de role/phone/seller_id ──────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cachola.cloud'

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { name, phone, role },
        redirectTo: `${appUrl}/auth/confirm`,
      },
    )

    if (createError) {
      if (createError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 })
      }
      console.error('[POST /api/admin/users] invite', createError)
      return NextResponse.json({ error: 'Não foi possível enviar o convite.' }, { status: 400 })
    }

    const userId = newUser.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Falha ao criar o usuário.' }, { status: 500 })
    }

    // ── Provisão de acesso (role/phone + unidades + permissões) — aguardado ──
    // Falha aqui NÃO deixa a conta utilizável; em vez de criar conta meio-pronta
    // silenciosamente (comportamento antigo, fire-and-forget), devolvemos um
    // aviso explícito para o admin completar pela tela do usuário.
    try {
      const updatePayload: Record<string, unknown> = {
        role,
        phone: phone ?? null,
      }
      if (seller_id) updatePayload.seller_id = seller_id

      const { error: updErr } = await adminSupabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
      if (updErr) throw updErr

      if (unitRows.length > 0) {
        const { error: linkErr } = await adminSupabase
          .from('user_units')
          .insert(unitRows.map((u) => ({ user_id: userId, unit_id: u.unit_id, is_default: u.is_default })))
        if (linkErr) throw linkErr
      }

      // Template de permissões em escopo GLOBAL (unit_id=null) — check_permission
      // ignora unit_id; este é o mesmo escopo usado por /apply-role-template.
      await applyRoleTemplate(adminSupabase, userId, role, null)
    } catch (provErr) {
      console.error('[POST /api/admin/users] provisioning', provErr)
      return NextResponse.json(
        {
          id: userId,
          warning:
            'Usuário criado e convite enviado, mas as unidades/permissões podem não ter sido aplicadas. Abra a tela do usuário para concluir o vínculo e aplicar o template do cargo.',
        },
        { status: 201 }
      )
    }

    return NextResponse.json({ id: userId }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
