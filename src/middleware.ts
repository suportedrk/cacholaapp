/**
 * Middleware do Cachola OS
 *
 * Responsabilidades:
 *  1. Atualizar cookies de sessão Supabase a cada request (token refresh).
 *  2. Redirecionar usuários não autenticados de rotas protegidas → /login.
 *  3. Redirecionar usuários autenticados da raiz / → /dashboard.
 *
 * NÃO faz verificação de role aqui — role checks ficam nos layouts
 * (Server Components com acesso ao banco) para evitar latência no edge.
 *
 * Padrão Supabase SSR para middleware:
 *  - Usa createServerClient com request.cookies (NÃO next/headers).
 *  - Precisa de getAll/setAll para manter os cookies sincronizados na response.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas que não precisam de autenticação
const PUBLIC_PATHS = ['/login', '/auth', '/403']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANTE: getUser() (não getSession()) para evitar cache stale de JWT
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Permite acesso a arquivos estáticos e rotas da API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return supabaseResponse
  }

  // Permite rotas públicas
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) {
    // Usuário autenticado tentando acessar /login → redireciona pro dashboard
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Rota protegida sem sessão → login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Aplica middleware a todas as rotas EXCETO:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico e outros arquivos na raiz public
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
