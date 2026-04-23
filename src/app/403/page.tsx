import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * Página 403 — Acesso Negado
 *
 * Server Component — lê o role do usuário para determinar o destino
 * do link "Voltar". freelancer e entregador são redirecionados para
 * /checklists/minhas-tarefas (não têm acesso ao /dashboard).
 * Usuários sem sessão recebem link para /login.
 */
export default async function ForbiddenPage() {
  let backHref = '/dashboard'
  let backLabel = 'Voltar ao início'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      backHref = '/login'
      backLabel = 'Ir para o login'
    } else {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'freelancer' || profile?.role === 'entregador') {
        backHref = '/checklists/minhas-tarefas'
        backLabel = 'Ir para Minhas Tarefas'
      }
    }
  } catch {
    // fallback silencioso — mantém /dashboard
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="icon-brand rounded-full p-4">
        <ShieldX className="h-10 w-10" />
      </span>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          Acesso negado
        </h1>
        <p className="text-text-secondary max-w-sm">
          Você não tem permissão para acessar esta página. Se acredita que isso é
          um erro, fale com o administrador do sistema.
        </p>
      </div>

      <Link
        href={backHref}
        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {backLabel}
      </Link>
    </div>
  )
}
