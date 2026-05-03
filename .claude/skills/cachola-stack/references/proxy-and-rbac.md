# Proxy & RBAC — Controle de Acesso Cachola

O Cachola tem controle de acesso em **3 camadas**, cada uma com responsabilidade distinta. Faltar uma cria buraco de segurança ou má UX (usuário entra na rota e só descobre que não pode quando a página tenta carregar dados).

## As 3 camadas

| Camada | Onde | Quando bloqueia | Tecnologia |
|---|---|---|---|
| **1. Edge** | `proxy.ts` (raiz) | Antes de chegar no servidor | Next.js Middleware |
| **2. Server Layout** | `layout.tsx` server component | Antes de renderizar página | `requireRoleServer` |
| **3. API Handler** | `route.ts` em `/api/*` | Em cada chamada de API | `requireRoleApi` |

**Regra de ouro:** rota protegida precisa das **3** camadas. Pular alguma é convite para bug.

## Camada 1 — `proxy.ts` (Edge Middleware)

Roda **antes** de qualquer página/API. Funções:
- Redirecionar usuário não logado → `/login`.
- Trocar de domínio (raro, mas configurável).
- Excluir rotas estáticas e arquivos.

### Matcher — atenção a detalhes

```ts
// proxy.ts
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - api routes (querem proteção própria via requireRoleApi)
     * - _next/static, _next/image (assets do Next)
     * - favicon, icons, opengraph-image (sem extensão)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml).*)',
  ],
}
```

⚠️ **Crítico:** `icon|apple-icon|opengraph-image` (sem extensão `.ico` ou `.png`) — o Next.js gera essas rotas dinamicamente e **não têm extensão na URL**. Se você esquecer de excluir, o middleware tenta proteger e redireciona para `/login`, causando favicon ausente em todo o site.

Já sangramos isso. Não tirar.

### Lógica básica do proxy

```ts
export async function middleware(req: NextRequest) {
  const { supabase, response } = createMiddlewareClient(req)
  const { data: { session } } = await supabase.auth.getSession()

  const isLoginPage = req.nextUrl.pathname === '/login'
  const isPublic = ['/auth/confirm', '/auth/setup-senha'].includes(req.nextUrl.pathname)

  // Não logado tentando acessar rota privada → /login
  if (!session && !isLoginPage && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Logado já tentando ver /login → /dashboard
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return response
}
```

Note: o proxy **não checa role**, apenas presença de sessão. Role é responsabilidade da camada 2.

## Camada 2 — `requireRoleServer` (Server Component)

Em `layout.tsx` ou `page.tsx` server-side, antes de renderizar:

```ts
// src/app/(protegido)/admin/layout.tsx
import { requireRoleServer } from '@/lib/auth/require-role-server'
import { ADMIN_ACCESS } from '@/config/roles'

export default async function AdminLayout({ children }: Props) {
  await requireRoleServer(ADMIN_ACCESS)  // redireciona p/ /403 se não autorizado
  return <>{children}</>
}
```

`requireRoleServer`:
1. Lê sessão via cookies (`createServerClient`).
2. Carrega `profile` do usuário.
3. Verifica se o role do user está na lista permitida.
4. Se não → `redirect('/403')`.

A rota `/403` é **role-aware**: mostra a mensagem certa ("você não tem permissão de admin", "você não tem permissão de vendas", etc.).

## Camada 3 — `requireRoleApi` (Route Handler)

Em qualquer `route.ts` de API:

```ts
// src/app/api/eventos/criar/route.ts
import { requireRoleApi } from '@/lib/auth/require-role-api'
import { EVENTOS } from '@/config/roles'

export async function POST(req: Request) {
  const { user, profile } = await requireRoleApi(EVENTOS)
  // se não autorizado, requireRoleApi já retornou 403/401 — chegando aqui está OK

  // ... lógica da API
}
```

`requireRoleApi`:
1. Lê sessão via cookies.
2. Verifica role.
3. Se não logado → retorna 401.
4. Se logado mas sem role → retorna 403.
5. Se OK → retorna `{ user, profile }` para o handler usar.

**Toda API que muta dados deve usar `requireRoleApi`.** APIs públicas (raras no Cachola) precisam de outro mecanismo (ex: webhook com ValidationKey).

## Constantes de Roles — `src/config/roles.ts`

**Fonte única de verdade.** Toda a lista de roles permitidos para cada módulo mora aqui:

```ts
export const ADMIN_ACCESS = ['super_admin', 'diretor'] as const
export const ADMIN_USERS = ['super_admin'] as const
export const ADMIN_UNITS = ['super_admin'] as const
export const ADMIN_LOGS = ['super_admin', 'diretor'] as const

export const BI_ACCESS = ['super_admin', 'diretor', 'gerente'] as const
export const ATAS = ['super_admin', 'diretor', 'gerente'] as const
export const ATENDIMENTO = ['super_admin', 'diretor', 'gerente', 'atendente'] as const
export const VENDAS = ['super_admin', 'diretor', 'gerente', 'vendedora'] as const
export const VENDAS_MODULE = ['super_admin', 'diretor', 'gerente', 'vendedora'] as const
export const VENDAS_MANAGE = ['super_admin', 'diretor', 'gerente'] as const

export const COMMERCIAL_CHECKLIST_ACCESS = [...] as const
export const COMMERCIAL_CHECKLIST_MANAGE = [...] as const
export const OPERATIONAL_CHECKLIST = [...] as const

export const MAINTENANCE_MODULE = [...] as const
export const MAINTENANCE_ADMIN = [...] as const

export const EVENTOS = [...] as const
export const PRESTADORES_ACCESS = [...] as const
export const TEAM_TASKS = [...] as const
export const SETTINGS = [...] as const
export const DASHBOARD = [...] as const
export const BACKUP_VIEW = [...] as const

export const GLOBAL_VIEWER = ['super_admin', 'diretor'] as const

// Helper genérico
export function hasRole<T extends readonly string[]>(
  role: string,
  allowed: T
): boolean {
  return (allowed as readonly string[]).includes(role)
}
```

## ❌ Anti-pattern — role inline

```tsx
// ❌ Errado — role array hardcoded inline
{['super_admin', 'diretor', 'gerente'].includes(profile.role) && (
  <Button>Editar</Button>
)}
```

```tsx
// ✅ Certo — usar constante
import { hasRole, ATAS_MANAGE } from '@/config/roles'

{hasRole(profile.role, ATAS_MANAGE) && (
  <Button>Editar</Button>
)}
```

**Por quê:**
- Inline duplica em 6+ lugares (sua memória já mapeou: 5 em Atas, 1 em Manutenção/chamados).
- Mudar uma regra (ex: incluir `coordenador`) requer caçar em todos.
- Diff de PR fica ilegível.
- Erros de digitação não são detectados (`'super_admins'` passa).

**Dívida técnica conhecida:** existem 6 lugares no código com role inline (5 em Atas, 1 em Manutenção). Quando mexer nessas áreas, **migrar para constante**.

## Roles do Cachola — semântica

| Role | Quem é | Acesso típico |
|---|---|---|
| `super_admin` | Bruno (dono) | Tudo |
| `diretor` | Sócios/diretores | Quase tudo, exceto config técnica |
| `gerente` | Gerência operacional | BI, Atas, Vendas, Eventos, Manutenção |
| `vendedora` | Time comercial | Vendas, Eventos (próprios) |
| `atendente` | Atendimento ao cliente | Eventos (consulta), Pré-venda |
| `operacional` | Operação de festa | Checklists, Manutenção (operacional) |
| `prestador` | Fornecedor externo | Prestadores (próprios serviços) |

A tabela exata pode ter mais roles dependendo da evolução — sempre conferir em `src/config/roles.ts` para a lista atualizada.

## Tela de erro — `/403`

Componente único em `src/app/403/page.tsx`. Recebe (via search param ou contexto) o módulo que foi negado e mostra mensagem específica:
- "Você não tem acesso ao módulo de Vendas. Fale com o diretor para solicitar."
- "Esta área é restrita a administradores."

Sempre redirecionar com contexto. **Nunca mostre mensagem genérica "Acesso negado"** — frustra usuário.

## Sidebar e UI — esconder vs. desabilitar

**Sempre esconder** itens de menu para os quais o usuário não tem role. Não mostrar item desabilitado (causa frustração).

```tsx
// src/components/layout/sidebar.tsx
{hasRole(profile.role, BI_ACCESS) && (
  <SidebarItem href="/bi">BI</SidebarItem>
)}
```

Combinado com `requireRoleServer` na rota, fica seguro mesmo se usuário tentar URL direto.

## Sidebar — active state ("most specific match")

Pequeno detalhe de UX importante: ao destacar item ativo, fazer "most specific match":

```tsx
// 1. Filtra todos os itens cuja href é prefixo da URL atual
// 2. Ordena por length desc
// 3. Ativa o primeiro (= mais específico)

const matches = items
  .filter(item => pathname.startsWith(item.href))
  .sort((a, b) => b.href.length - a.href.length)

const activeItem = matches[0]?.href
```

Sem isso, em URL `/admin/users/123`, ativa tanto `/admin` quanto `/admin/users` — visualmente confuso.

## Checklist antes de commitar nova rota protegida

- [ ] Proxy.ts matcher cobre? (geralmente sim, exceto se for rota especial)
- [ ] Layout server component faz `requireRoleServer(<CONSTANTE>)`?
- [ ] Cada API Route da rota faz `requireRoleApi(<CONSTANTE>)`?
- [ ] Sidebar esconde item via `hasRole`?
- [ ] Constante existe em `src/config/roles.ts` (ou criar lá, não inline)?
- [ ] Mensagem `/403` faz sentido?
