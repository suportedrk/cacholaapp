import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database.types'

export async function POST(request: Request) {
  try {
    // Verificar se o usuário atual é admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const adminRoles: UserRole[] = ['super_admin', 'diretor', 'gerente']
    if (!profile || !adminRoles.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 })
    }

    // Criar usuário com admin client
    const body = await request.json()
    const { name, email, phone, role } = body as {
      name: string
      email: string
      phone: string | null
      role: UserRole
    }

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { name, phone, role },
    })

    if (createError) {
      const msg = createError.message.includes('already registered')
        ? 'Este e-mail já está cadastrado.'
        : createError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // O trigger handle_new_user() cria o registro em public.users automaticamente.
    // Atualizar o role (o trigger usa metadata, mas garantimos aqui também).
    if (newUser.user) {
      await adminSupabase
        .from('users')
        .update({ role, phone: phone ?? null })
        .eq('id', newUser.user.id)
    }

    return NextResponse.json({ id: newUser.user?.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
