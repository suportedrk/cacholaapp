# patterns-by-layer — Snippets canônicos de RBAC por camada

> Código real, não pseudocódigo. Copiar e adaptar o nome da constante.

---

## 1. Layout server (RSC) — guard de rota

```typescript
// src/app/(auth)/modulo/layout.tsx
import { requireRoleServer } from '@/lib/auth/require-role'
import { MAINTENANCE_MODULE_ROLES } from '@/config/roles'

export default async function Layout({ children }: { children: React.ReactNode }) {
  // redirect('/403') automaticamente se role insuficiente
  await requireRoleServer(MAINTENANCE_MODULE_ROLES)
  return <>{children}</>
}
```

Guard em Server Component. `requireRoleServer` faz redirect interno — o browser recebe
`NEXT_REDIRECT`, não HTTP 307. Validar com browser logado na role errada, não com `curl`.

---

## 2. API route — guard com retorno de resposta

```typescript
// src/app/api/meu-endpoint/route.ts
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'

export async function POST(request: Request) {
  const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
  if (!guard.ok) return guard.response  // NextResponse 401 ou 403

  // ... lógica do handler
}
```

`requireRoleApi` retorna `{ ok: true }` ou `{ ok: false, response: NextResponse }`.
Não lançar exception — retornar a `response` diretamente.

---

## 3. Condicional de UI no client com hasRole

```typescript
'use client'
import { hasRole, VENDAS_MANAGE_ROLES, TEMPLATE_MANAGE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'

export function ActionMenu() {
  const { profile } = useAuth()

  const canManage = hasRole(profile?.role, VENDAS_MANAGE_ROLES)
  const canAdmin  = hasRole(profile?.role, TEMPLATE_MANAGE_ROLES)

  return (
    <>
      {canManage && <ManageButton />}
      {canAdmin  && <AdminPanel />}
    </>
  )
}
```

`profile?.role` pode ser `undefined` enquanto carrega — `hasRole` retorna `false` sem
tratar explicitamente o estado de loading. Nunca ler `session.user.app_metadata.role`.

---

## 4. Query Supabase com .in() — spread de constante

```typescript
import { createClient } from '@/lib/supabase/server'
import { MAINTENANCE_MODULE_ROLES } from '@/config/roles'

const supabase = createClient()

// Buscar usuários com acesso a manutenção para enviar notificação
const { data: recipients } = await supabase
  .from('users')
  .select('id, name, email')
  .in('role', [...MAINTENANCE_MODULE_ROLES])  // spread obrigatório: .in() espera string[]
  .eq('is_active', true)
```

O spread `[...CONSTANTE]` é necessário porque `.in()` espera `string[]`, não `readonly`.
Não duplicar a lista de roles inline — sempre importar a constante.

---

## 5. RLS policy — referenciando função SECURITY DEFINER

```sql
-- Migration: nova policy em tabela sensível
-- is_super_admin() é SECURITY DEFINER — lê public.users, não auth.jwt()
-- Evita mismatch claim JWT vs banco (ver CLAUDE.md seção storageKey)

CREATE POLICY "super_admin manage minha_tabela"
  ON public.minha_tabela
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Para acesso de leitura por role mais amplo:
CREATE POLICY "authenticated view minha_tabela"
  ON public.minha_tabela
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    )
  );
```

Usar subquery em `public.users` (não `auth.jwt() ->> 'role'`) — fonte de verdade é o banco.
Ver Migration 076/077 no histórico: o CASE EN→PT-BR em `check_permission()` existe por isso.

> O array de roles na policy SQL não pode importar de `roles.ts` — mesma limitação do Pattern 6. Quando uma constante TypeScript mudar (ex.: adicionar role ao `MAINTENANCE_MODULE_ROLES`), revisar manualmente as policies que replicam o mesmo conjunto. Listar policies afetadas no comentário da migration.

---

## 6. Função SECURITY DEFINER — guard de role

```sql
-- Migration: RPC restrita a roles do módulo X
CREATE OR REPLACE FUNCTION get_meu_dado(p_unit_id UUID)
RETURNS TABLE (id UUID, valor TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Guard: apenas roles com acesso ao módulo
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT d.id, d.valor
    FROM public.minha_tabela d
    WHERE d.unit_id = p_unit_id;
END;
$$;
```

O array de roles na função SQL não pode importar de `roles.ts` — é uma limitação conhecida.
Ao adicionar uma role à constante TypeScript correspondente, lembrar de atualizar os RPCs
que replicam o mesmo conjunto. Listar os RPCs afetados no comentário da migration.
