# Cachola OS — Padrão RBAC

Toda verificação de role no Cachola OS segue um padrão único: constantes importadas de
`src/config/roles.ts`, helper `hasRole` para runtime, `requireRoleServer`/`requireRoleApi`
para guards de rota/API. Esta skill cobre o **como escrever** — para arquitetura e histórico
ver [`cachola-supabase-ops/references/rbac-reference.md`](../cachola-supabase-ops/references/rbac-reference.md).

---

## Quando usar esta skill

Consultar **obrigatoriamente** ao escrever qualquer gating de role em qualquer camada:

- Novo `layout.tsx` com guard de rota
- Nova API route com verificação de acesso
- Condicional de UI que exibe/oculta conteúdo por role
- Query Supabase com `.in('role', [...])`
- Nova RLS policy ou função SECURITY DEFINER com guard de role

---

## Quando consultar cada referência

| Tarefa | Arquivo |
|--------|---------|
| "Qual constante usar para este módulo?" | `references/roles-ts-annotated.md` |
| "Como escrever o guard na camada X?" | `references/patterns-by-layer.md` |
| Arquitetura RBAC / `user_permissions` / `check_permission()` | `../cachola-supabase-ops/references/rbac-reference.md` |
| Drift detection — script, CI, allowlist, como funciona | `references/drift-detection.md` |

---

## Regra inviolável: sem literal inline

Nunca escrever array de roles diretamente no código de produção.

```typescript
// ❌ ERRADO — literal inline não é encontrado por grep quando roles mudam
const canEdit = ['super_admin', 'diretor', 'gerente'].includes(profile.role)
```

```typescript
// ✅ CERTO — constante importada; uma mudança propaga para todas as camadas
import { hasRole, VENDAS_MANAGE_ROLES } from '@/config/roles'
const canEdit = hasRole(profile?.role, VENDAS_MANAGE_ROLES)
```

Quando um conjunto de roles muda (ex.: `pos_vendas` adicionado, `gerente` removido), o
literal inline não é localizado pelo grep e o acesso diverge silenciosamente da intenção.

**Dívida quitada (v1.6.1):** 26 hardcodes residuais corrigidos via PR `feat/rbac-drift-detection`.
O codebase agora tem **zero** role literals inline fora de `src/config/roles.ts`,
monitorado automaticamente por `npm run rbac:check` (CI bloqueia regressões).
Ver `references/drift-detection.md` para detalhes.

---

## Fonte única de verdade: src/config/roles.ts

Todas as 27 constantes usam o padrão canônico:

```typescript
export const MINHA_CONSTANTE_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]
```

- `as const` — tuple literal; evita widening para `string[]`
- `satisfies readonly Role[]` — valida em build time que todos os valores são roles válidas;
  TypeScript rejeita role inexistente antes de chegar ao runtime

Helper type-safe para verificação em runtime:

```typescript
export function hasRole<T extends readonly Role[]>(
  role: Role | null | undefined,
  allowed: T,
): role is T[number]
```

Uso: `if (hasRole(profile?.role, BI_ACCESS_ROLES)) { ... }`
— aceita `null`/`undefined`, retorna `false` sem casting adicional.

Ver tabela completa das constantes disponíveis em `references/roles-ts-annotated.md`.

---

## Anti-padrões — NÃO fazer

- **Array literal inline em código de produção** — `['super_admin', 'diretor'].includes(...)`
  → importar constante de `@/config/roles`
- **Constante local no arquivo** — `const ADMIN_ROLES = ['super_admin', ...]` fora de
  `roles.ts` → mover para `roles.ts` ou reusar constante existente (ver dívida técnica em rbac-reference.md)
- **`includes()` sem `hasRole`** — `(allowed as string[]).includes(role)` perde type-safety
  e não trata `null`/`undefined` → usar `hasRole<T>`
- **JWT claim direto no frontend** — `session.user.app_metadata.role` → sempre ler de
  `useAuth().profile?.role` (hydratado do banco, não do token JWT)
- **`.in('role', [...])` inline em queries Supabase** — `.in('role', ['super_admin', 'dir'])`
  → spread de constante: `.in('role', [...MAINTENANCE_MODULE_ROLES])`
