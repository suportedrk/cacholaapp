import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Callback de autenticação (e-mail, reset de senha, OAuth, etc.)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // "next" é o parâmetro legado; "redirectTo" é enviado pelo fluxo OAuth do login
  const next = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard'

  // Usar NEXT_PUBLIC_SITE_URL em vez de request.url.origin porque por trás do
  // Nginx o origin interno é sempre http://127.0.0.1:3001 (inacessível pelo browser).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cachola.cloud'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`)
    }
  }

  // Em caso de erro, redirecionar para login com mensagem
  return NextResponse.redirect(`${siteUrl}/login?error=callback_error`)
}
