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

---

## Cuidado em Fase 2: semânticas de `view` distintas por tabela (Aprendizado 5)

Antes de aplicar o molde de ouro a um módulo com **várias tabelas**, mapeie a semântica
de visibilidade de cada tabela. Um único `check_permission(módulo,'view')` é binário —
não distingue sub-recurso. Aplicar a fórmula golden literal em todas as tabelas pode
**expandir acesso** para cargos que têm `view` granted (catálogo) mas eram mais restritos
em tabelas de propriedade.

Os 3 eixos semânticos:

| Eixo | Quem vê | SELECT no molde |
|------|---------|------------------|
| **Catálogo** (lista compartilhada) | quem tem `view` granted | `check_permission(view) AND (is_global_viewer() OR unit_id IS NULL OR unit_id = ANY(get_user_unit_ids()))` |
| **Propriedade** (dono da linha) | dono + global viewer | `is_global_viewer() OR <regra de dono>` — SEM `check_permission(view)` |
| **Estrutural** (admin/auditoria) | só global viewer | `is_global_viewer()` — SEM `check_permission(view)` |

Para o módulo `checklist_comercial` (referência):

- `commercial_task_templates`, `commercial_template_items` → Catálogo
- `commercial_tasks`, `commercial_task_completions` → Propriedade (via `assignee_id`)
- `commercial_stage_automations` → Estrutural

**Heurística de validação:** quando um cargo tem `view` granted mas a regra de negócio
o limita (ex.: vendedora que tem view de templates mas só vê próprias tasks),
ele é o **candidato a expansão silenciosa**. Sempre teste esse cargo cargo a cargo na
matriz ANTES/DEPOIS antes de declarar o módulo migrado.

Ver detalhe e justificativa em
[`docs/rbac/proposta-arquitetura-alvo.md`](../../docs/rbac/proposta-arquitetura-alvo.md)
seção "Aprendizado 5".

---

## Atenção: sub-casos que NÃO precisam de migration de RLS

Antes de iniciar a conversion de um módulo para o molde de ouro, verificar se ele se enquadra
em um dos dois sub-casos abaixo — ambos já estão corretos por design e **não devem ser migrados**.

### Sub-caso PROPRIETÁRIO (ex.: `notificacoes` / tabela `notifications`)

Tabela de dados pessoais cujo acesso correto é `user_id = auth.uid()`.

**Sinais de identificação:**
- RLS usa `user_id = auth.uid()` em vez de `unit_id` ou `check_permission`
- O módulo não tem rota dedicada (componente global, ex.: navbar)
- Sem `unit_id` na tabela

**Regra:** NÃO migrar para `check_permission`. O cadeado é a propriedade, não a permissão de
módulo. As entries em `role_permissions`/`user_permissions` para esses módulos são **decorativas**
— não afetam acesso em runtime.

**Implicação para UI (Fase 3):** não expor toggles por cargo em `/admin/cargos/[code]` para
módulos PROPRIETÁRIO. Não há o que configurar por cargo em dado pessoal.

### Sub-caso AGREGAÇÃO/ROTA (ex.: `dashboard`, `relatorios`)

Módulo sem tabela própria que apenas agrega dados de outras tabelas.

**Sinais de identificação:**
- Sem tabela própria no schema
- A rota consulta múltiplas tabelas de outros módulos
- O `layout.tsx` tem `requireRoleServer(X_ACCESS_ROLES)` como único controle

**Regra:** NÃO há RLS própria para migrar — o dado já é protegido pelas RLS das tabelas-fonte.
O controle real é o **layout guard**. As entries em `role_permissions` são decorativas **hoje**.

**Backlog de UI (Fase 3):** o toggle `view` desses módulos só se tornará funcional quando o
guard de rota for convertido para `check_permission(uid, modulo, 'view')`. Até lá, são decorativos.

Ver detalhe em
[`docs/rbac/proposta-arquitetura-alvo.md`](../../docs/rbac/proposta-arquitetura-alvo.md)
seções "Aprendizado 6" e "Aprendizado 7".

---

## Fase 3 — Tornar os toggles funcionais (helpers de fundação)

A partir da Etapa 0 da Fase 3 (Migration 120) existem 3 helpers que **substituem**
o padrão `requireRoleServer/Api(LISTA_ROLES)` + `IF NOT EXISTS ... role IN` inline
em RPCs por leitura do catálogo configurável de permissões.

### Helpers TypeScript ([src/lib/auth/require-permission.ts](../../src/lib/auth/require-permission.ts))

```ts
// Layout (Server Component) — substitui requireRoleServer(X_ROLES)
await requirePermissionServer('eventos', 'view')

// API Route Handler — substitui requireRoleApi(X_ROLES)
const guard = await requirePermissionApi('manutencao', 'edit')
if (!guard.ok) return guard.response
```

Comportamento:
- Sem sessão → `redirect('/login')` (server) ou `401` (api)
- `check_permission` retorna `false`/erro → `redirect('/403')` (server) ou `403` (api)
- `check_permission` retorna `true` → continua

super_admin é bypassado dentro da própria `check_permission` (early return na
função), portanto os helpers herdam o bypass sem código adicional.

### Helper plpgsql `check_permission_or_raise(p_module, p_action)`

Para RPCs SECURITY DEFINER, substitui o bloco:

```sql
-- ❌ ANTIGO — cargo hard-coded
IF NOT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()
    AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
) THEN
  RAISE EXCEPTION 'insufficient_privilege';
END IF;
```

por uma única linha que lê o catálogo:

```sql
-- ✅ NOVO — permissão configurável
PERFORM public.check_permission_or_raise('bi', 'view');
```

ERRCODE 42501 é mantido. Substituição é mecânica, mas exige confirmar que
`user_permissions` cobre todos os cargos que tinham acesso pelo `role IN`
antigo (auditoria + backfill aditivo se faltar — Aprendizado 1).

### Quando NÃO usar os helpers de permissão

Mantenha `requireRoleServer/Api(X_ROLES)` ou `IF NOT EXISTS ... role IN` inline
nestes casos:

- **Estruturais** (Aprendizado 4): `units`, `role_permissions`, `role_default_perms`,
  `role_template_audit`, `pre_reservas_diretoria` writes, gestão do próprio RBAC.
- **Sub-rotas de gerência** que expandiriam o público se mapeadas para `'edit'`
  do módulo pai (D2 abaixo).
- **Lógica de negócio dependente de cargo per se** (D3): `isVendedora`,
  `isManager`, `GLOBAL_VIEWER_ROLES`, `IMPERSONATION_ROLES`,
  `OPERATIONAL_MOBILE_ROLES` (redirect pós-login).

### Decisões aprovadas para a fase de conversão

- **D1 — RPCs de Vendas mapeiam para `('vendas', 'view')`.** `get_upsell_*`,
  `get_recompra_*`, `get_vendas_*`, `get_event_sales_summary` convertem para
  `check_permission_or_raise('vendas', 'view')`. Gerente (já fora de
  `VENDAS_MODULE_ROLES` desde v1.5.1) naturalmente não tem `vendas.view`.
- **D2 — Sub-rotas de gerência NÃO mapeiam para `'edit'` se expandem público.**
  Ex.: `/vendas/checklist/{equipe,templates,automacoes}` hoje exige
  `COMMERCIAL_CHECKLIST_MANAGE_ROLES` (super_admin, diretor); mapear para
  `('checklist_comercial', 'edit')` incluiria `pos_vendas` (que tem `edit`
  granted pelo backfill da Fase 2) e expandiria indevidamente. Regra:
  conferir sempre, sub-rota a sub-rota; se expande, MANTER trava de cargo até
  existir controle fino (`kind='control'`).
- **D3 — Decisões por cargo per se permanecem `hasRole`.** `isVendedora`,
  `isManager`, `canViewAll` (unit switcher) — todas Categoria B do
  diagnóstico. Não viram toggle.
- **D4 — Ordem de conversão dos módulos** (do mais isolado ao mais
  entrelaçado, validando invisível a cada PR): Backups → Equipamentos →
  Atas → Logs → Vendedoras → Manutenção → Decoração → Prestadores →
  Checklists → Eventos → Configurações → Checklist Comercial → Vendas →
  BI (broad + narrow) → Dashboard → Relatórios → Notificações.

Ver detalhe e justificativa em
[`docs/rbac/proposta-arquitetura-alvo.md`](../../docs/rbac/proposta-arquitetura-alvo.md)
seção "Fase 3 — Decisões aprovadas para a conversão".
