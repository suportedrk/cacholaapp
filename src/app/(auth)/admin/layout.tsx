import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Roles com acesso à área administrativa
const ADMIN_ROLES = ['super_admin', 'rh', 'gerente']

/**
 * Layout de Server Component para rotas /admin.
 * Verifica o role do usuário UMA VEZ por navegação,
 * sem adicionar latência ao proxy (que roda em todo request).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    redirect('/dashboard?error=sem_permissao')
  }

  return <>{children}</>
}
