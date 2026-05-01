# Auth & Session — Padrão Cachola

A camada de autenticação do Cachola é centralizada e tem regras estritas. **Violar uma destas regras causa loops de login, queries duplicadas, ou dados de unidade errada vazando entre usuários.**

## Arquitetura — em uma frase

`AuthBootstrap` (singleton) gerencia sessão + perfil + unidades → `useAuth()` é leitor puro → `AppReadyGate` bloqueia render até `isSessionReady && _hasHydrated` → componentes consomem `useAuth()` sem nunca chamar `getSession()`/`getUser()` direto.

## Regras absolutas

### 1. ❌ NUNCA chamar `getSession()` ou `getUser()` em hooks/componentes

```tsx
// ❌ NUNCA FAÇA ISSO
function useDealsCount() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()  // ❌
  // ...
}
```

A sessão é "captada" uma vez pelo `AuthBootstrap` e exposta via Zustand. Qualquer chamada extra:
- Cria contenção em `navigator.locks`.
- Pode retornar sessão **stale** se o token estiver mid-refresh.
- Em produção sob carga, faz GoTrue (Supabase auth) receber rajadas desnecessárias.

```tsx
// ✅ Certo — useAuth é leitor puro
function useDealsCount() {
  const { session, profile, activeUnitId } = useAuth()
  return useQuery({
    queryKey: ['deals-count', activeUnitId],
    enabled: !!session && isSessionReady,  // ⚠️ regra 3 abaixo
    queryFn: async () => {
      const supabase = createClient()  // ⚠️ regra 2 abaixo
      // ...
    }
  })
}
```

### 2. ✅ `createClient()` SEMPRE dentro do `queryFn`

```tsx
// ❌ Errado — singleton de módulo
const supabase = createClient()  // no topo do arquivo

export function useFoo() {
  return useQuery({
    queryFn: () => supabase.from('foo').select()
  })
}
```

```tsx
// ✅ Certo — instância criada por execução
export function useFoo() {
  return useQuery({
    queryFn: async () => {
      const supabase = createClient()
      return supabase.from('foo').select()
    }
  })
}
```

**Por quê:** o cliente Supabase tem estado interno (token, refresh promise). Compartilhar entre queries paralelas faz `navigator.locks` serializar tudo. Em tab inativa, isso causa deadlock.

### 3. ✅ `enabled: !!session && isSessionReady` — NUNCA `!!activeUnitId`

```tsx
// ❌ Errado
enabled: !!activeUnitId

// ✅ Certo
const { session } = useAuth()
const isSessionReady = useAuth(s => s.isSessionReady)

useQuery({
  enabled: !!session && isSessionReady,
  queryKey: ['x', activeUnitId],
  queryFn: ...
})
```

**Por quê:** `activeUnitId` pode mudar (usuário trocando de unidade) — se você usar como gate de `enabled`, a query refaz toda hora. `session` + `isSessionReady` é estável e indica "auth pronto pra rodar".

A unidade entra na `queryKey`, não no `enabled` — assim TanStack Query cacheia separado por unidade automaticamente.

### 4. `storageKey = hostname.split('.')[0]`

No init do cliente Supabase:

```ts
// src/lib/supabase/client.ts
const storageKey = typeof window !== 'undefined'
  ? window.location.hostname.split('.')[0]
  : 'cachola'

export function createClient() {
  return createBrowserClient(url, anon, {
    auth: { storageKey, /* ... */ }
  })
}
```

**Por quê:**
- `cachola.cloud` → storageKey `cachola` → cookie funciona em `app.cachola.cloud`, `api.cachola.cloud`, etc.
- Hostname completo (`app.cachola.cloud`) → storageKey diferente em cada subdomínio → token não compartilha → **login loop infinito**.

Já sangramos isso uma vez. Não tocar.

### 5. `networkMode: 'always'` — global no QueryClient

```ts
// src/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',  // ⚠️ obrigatório
      staleTime: 30_000,
      retry: 1,
    }
  }
})
```

**Por quê:** o default `'online'` consulta `navigator.onLine` antes de cada fetch. Em tabs inativas, browser as vezes reporta `online: false` por economia de bateria → query trava. `'always'` ignora isso.

### 6. `AppReadyGate` — não renderizar até auth pronto

`src/components/auth/AppReadyGate.tsx` envolve a árvore. Mostra spinner enquanto:

```ts
const ready = useAuth(s => s.isSessionReady && s._hasHydrated)
if (!ready) return <FullPageSpinner />
return children
```

**Não renderize componentes que dependem de auth fora desse gate.** Senão, o primeiro render acontece sem session, hooks calculam errado, e quando session chega, há um re-render com dados pulando.

### 7. `visibilitychange` listener — refresh ao retornar à tab

`AuthBootstrap` instala um listener:

```ts
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void supabase.auth.refreshSession()
  }
})
```

Sem isso, usuário volta à tab depois de horas e a sessão expirada não é renovada até o próximo request falhar com 401. Com isso, renovamos preventivamente.

## Mutations — sempre via API Route

```tsx
// ❌ NUNCA — insert direto do client
const { data } = await supabase.from('events').insert({ /* ... */ })
```

Mutations sensíveis (criar evento, atualizar deal, etc.) sempre via API Route com `createAdminClient` (service role):

```ts
// src/app/api/events/create/route.ts
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  // 1. Validar sessão do user via supabaseServer (cookies)
  // 2. Validar role via requireRoleApi
  // 3. Executar com adminClient (service role bypass RLS quando intencional)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('events')
    .insert({ ... })
    .select()
    .single()

  return NextResponse.json({ data })
}
```

**Por quê:**
- RLS bem desenhado bloqueia direto-do-client em casos sensíveis.
- API Route permite log centralizado, validação extra (zod), e usa role seguro (service role) só onde decidido.
- Webhooks externos (Ploomes) também caem em API Routes — pattern consistente.

## Cliente público vs. admin

| Quando | Cliente | Onde criar |
|---|---|---|
| Leitura no client (queries, RLS protege) | `createClient()` (browser) | `src/lib/supabase/client.ts` |
| Leitura/escrita no server component | `createServerClient()` (cookies) | `src/lib/supabase/server.ts` |
| Mutation com bypass de RLS (intencional) | `createAdminClient()` (service role) | `src/lib/supabase/admin.ts` — **só em API Routes** |

**`createAdminClient` JAMAIS chamado em código que roda no browser.** Service role key não pode vazar.

## Setup do Supabase em ENV

Para o cliente browser, só duas variáveis (públicas):
```
NEXT_PUBLIC_SUPABASE_URL=https://api.cachola.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Para o admin client (server-only):
```
SUPABASE_SERVICE_ROLE_KEY=...
```

A `SERVICE_ROLE_KEY` **nunca** prefixada com `NEXT_PUBLIC_` — senão Next.js inclui no bundle do browser e fica exposta.

## Variáveis GoTrue importantes

No `docker-compose` do Supabase self-hosted:
- `ADDITIONAL_REDIRECT_URLS` (não `GOTRUE_URI_ALLOW_LIST` — esse é o nome **antigo**) — incluir `/auth/confirm`, `/auth/callback`, `/**`.
- `GOTRUE_MAILER_EXTERNAL_HOSTS=api.cachola.cloud` — suprime warning não-crítico no boot.
- `SMTP_*` — para emails de invite/recovery (cuidado: o nodemailer do Cachola usa SEUS próprios SMTP_* na env Next.js, é OUTRA camada).

Ao trocar qualquer dessas, é obrigatório:
```bash
docker compose up -d --force-recreate <service>
```
Restart sozinho **não** recarrega env.

## Convidar novo usuário — fluxo completo

1. Admin loga em `/admin/users/new`.
2. Backend chama `inviteUserByEmail(email)` (GoTrue).
3. GoTrue envia email com link `/auth/confirm?token=...`.
4. Usuário clica → `/auth/confirm` valida token → redireciona para `/auth/setup-senha`.
5. `/auth/setup-senha` faz `updateUser({ password })`.
6. Migration 028 garante que apenas emails Gmail registrados em `users` podem fazer login OAuth — bloqueia gmail desconhecido.

## Debugging — sintomas comuns

| Sintoma | Causa provável |
|---|---|
| Login loop infinito | `storageKey` errado (hostname completo) |
| Queries em tab inativa travando | `networkMode` não é `'always'` |
| "Session expired" toda hora | falta `visibilitychange` listener |
| Dados aparecem e somem ao montar | renderização fora do `AppReadyGate` |
| Query refaz toda vez que troca unidade | `enabled: !!activeUnitId` (errado) |
| `auth.users INSERT` retorna 500 | falta token fields non-NULL (confirmation_token, etc.) — não inserir direto |
| Deadlock em paralelo | `createClient()` no topo do módulo (singleton) |
