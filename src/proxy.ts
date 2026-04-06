import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas (não requerem autenticação)
const PUBLIC_ROUTES = ['/login', '/recuperar-senha', '/auth/callback', '/auth/confirm', '/email-templates']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
     * - manifest.json / manifest.webmanifest (PWA — sem exclusão causava redirect para /login)
     * - sw.js + workbox (service worker PWA)
     * - arquivos estáticos por extensão (imagens, fontes, scripts, estilos)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|manifest\\.webmanifest|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|json|woff2?|ttf|eot)$).*)',
  ],
}
