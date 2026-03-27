import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas (não requerem autenticação)
const PUBLIC_ROUTES = ['/login', '/recuperar-senha', '/auth/callback']

// Rotas que requerem roles específicos
const PROTECTED_BY_ROLE: Record<string, string[]> = {
  '/admin': ['super_admin', 'rh', 'gerente'],
  '/relatorios': ['super_admin', 'diretor', 'gerente', 'financeiro'],
}

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

  // Refresh da sessão (IMPORTANTE: não remover)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

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

  // Verificação de role para rotas restritas
  if (user) {
    for (const [routePrefix, allowedRoles] of Object.entries(PROTECTED_BY_ROLE)) {
      if (pathname.startsWith(routePrefix)) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (!userData || !allowedRoles.includes(userData.role)) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          url.searchParams.set('error', 'sem_permissao')
          return NextResponse.redirect(url)
        }
        break
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - arquivos públicos (public/)
     * - sw.js (service worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$|sw\\.js|workbox-.*).*)',
  ],
}
