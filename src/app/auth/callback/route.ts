import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Callback de autenticação (e-mail, reset de senha, OAuth, etc.)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // "next" é o parâmetro legado; "redirectTo" é enviado pelo fluxo OAuth do login
  const next = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Em caso de erro, redirecionar para login com mensagem
  return NextResponse.redirect(`${origin}/login?error=callback_error`)
}
