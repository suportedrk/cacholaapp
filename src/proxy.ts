import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas (não requerem autenticação)
const PUBLIC_ROUTES = ['/login', '/recuperar-senha', '/auth/callback', '/auth/confirm', '/auth/setup-senha', '/email-templates', '/403']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // SUPABASE_INTERNAL_URL: URL interna para rodar de dentro do Docker (cacholaos-kong:8000).
  // O storageKey é forçado para o hostname do browser (localhost) para que o cookie name
  // coincida entre browser (localhost:8000) e servidor (cacholaos-kong:8000).
  const supabaseUrl = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const browserHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { storageKey: `sb-${browserHostname}-auth-token` },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh da sessão (IMPORTANTE: não remover — mantém o cookie atualizado)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rotas /api/ fazem sua própria autenticação (CRON_SECRET, webhook key, etc.)
  // Não redirecionar — deixar passar sem interferência do middleware.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // Verificação de rota pública
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  )

  // Se não autenticado e rota protegida → redirecionar para login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Verificar is_active para usuários autenticados em rotas protegidas.
  // Query leve: SELECT is_active FROM users WHERE id = ? (indexed PK).
  // Cobre tanto email/senha quanto OAuth — bloqueia sessões de usuários desativados.
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', user.id)
      .single()

    if (profile?.is_active === false) {
      // Encerrar sessão e copiar cookies limpos para o redirect
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'inactive')
      const response = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, {
          path: cookie.path,
          domain: cookie.domain,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as 'strict' | 'lax' | 'none' | undefined,
        })
      })
      return response
    }
  }

  // Se autenticado e rota de login → redirecionar para dashboard
  if (user && (pathname === '/login' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Verificação de role por rota é feita nos layouts de Server Component
  // (src/app/(auth)/admin/layout.tsx) — evita query ao banco aqui no proxy
  // o que adicionaria latência extra em CADA request.

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - icon / apple-icon / opengraph-image (Next.js App Router special files)
     * - manifest.json / manifest.webmanifest (PWA — sem exclusão causava redirect para /login)
     * - sw.js + workbox (service worker PWA)
     * - arquivos estáticos por extensão (imagens, fontes, scripts, estilos)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|opengraph-image|manifest\\.json|manifest\\.webmanifest|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|json|woff2?|ttf|eot)$).*)',
  ],
}
