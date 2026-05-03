# RBAC — Referência Cruzada e Dívida Técnica

A camada de **autorização** (quem pode fazer o quê) toca tanto a aplicação Next.js quanto o banco. Esta referência é um índice cruzado entre as 3 camadas + um inventário da dívida técnica conhecida.

## Onde está o que

| Camada | Tecnologia | Detalhes em |
|---|---|---|
| **Edge** (proxy.ts) | Next.js Middleware | `cachola-stack/proxy-and-rbac.md` |
| **Server (UI)** (`requireRoleServer`) | Next.js Server Component | `cachola-stack/proxy-and-rbac.md` |
| **API** (`requireRoleApi`) | Next.js Route Handler | `cachola-stack/proxy-and-rbac.md` |
| **Banco** (RLS + `check_permission`) | Postgres + Supabase | `rls-policies.md` (esta skill) |
| **Constantes de Roles** | `src/config/roles.ts` | `cachola-stack/proxy-and-rbac.md` |

**Por que duas skills cobrem RBAC:**
- `cachola-stack` foca no fluxo Next.js (frontend + API routes).
- `cachola-supabase-ops` (esta) foca no banco (RLS, helpers SQL, `user_permissions`).

Quando estiver implementando uma feature **nova com controle de acesso**, abra **ambas** as referências.

## Arquitetura — visão completa

```
┌─────────────────────────────────────────────────────┐
│  USUÁRIO loga via Google OAuth                       │
│  GoTrue cria/atualiza row em auth.users + public.users│
│  Profile traz `role` (super_admin, diretor, etc.)   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Camada 1 — proxy.ts (Edge)                          │
│  Bloqueia rota privada se sem sessão                 │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Camada 2 — Server Layout                            │
│  requireRoleServer(BI_ACCESS) → /403 se sem role     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Camada 3 — API Route                                │
│  requireRoleApi(VENDAS_MANAGE) → 403 se sem role     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Camada 4 — RLS no Postgres                          │
│  USING (check_permission(auth.uid(), ..., unit_id))  │
│  Última linha de defesa — bloqueia mesmo bug em app  │
└─────────────────────────────────────────────────────┘
```

**Defesa em profundidade:** se UMA camada falhar, a próxima ainda protege. RLS é o último escudo: mesmo que app envie SQL sem filtro, banco filtra.

## `user_permissions` — tabela central

```sql
CREATE TABLE public.user_permissions (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,           -- 'vendas', 'bi', 'eventos', ...
  action TEXT NOT NULL,           -- 'view', 'create', 'edit', 'delete'
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,  -- pode ser NULL p/ permissão global
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES public.users(id),

  UNIQUE (user_id, module, action, unit_id)   -- chave única importante
);
```

A chave única `(user_id, module, action, unit_id)` evita duplicar permissão. Note que `unit_id NULL` significa permissão **global** (não atrelada a unidade) — diferente de "todas as unidades" (que seria N rows, uma por unidade).

## `check_permission()` — função canônica de autorização

```sql
SELECT check_permission(
  p_user_id := auth.uid(),
  p_module := 'vendas',
  p_action := 'edit',
  p_unit_id := '<uuid-unidade>'
);
-- retorna boolean
```

Usado em:
- **RLS policies** das tabelas (camada 4).
- **RPCs** que precisam validar permissão antes de executar.
- **API Routes** indiretamente, via `requireRoleApi` que consulta o profile + `hasRole`.

⚠️ **`check_permission` foi traduzida EN→PT-BR** em migrations 076+077 (CASE permanente). Mensagens de erro hoje saem em português ("permissao_negada" em vez de "permission_denied").

## Hierarquia conceitual

```
super_admin
  ├─ Acesso global irrestrito
  ├─ Pode tudo em qualquer unidade
  └─ Único role com /admin/users e /admin/units

diretor
  ├─ Acesso global de leitura (is_global_viewer = true)
  ├─ Edit em quase tudo
  └─ Sem acesso técnico (admin/users, admin/units)

gerente
  ├─ Acesso à(s) unidade(s) específica(s) (via user_units)
  ├─ Edit em quase tudo dentro da unidade
  └─ Sem acesso entre unidades

vendedora
  ├─ Acesso à(s) unidade(s) específica(s)
  ├─ Edit em deals próprios + Carteira Livre
  └─ View de KPIs próprios

atendente
  ├─ Acesso à(s) unidade(s)
  ├─ View geral, edit limitado
  └─ Pré-venda, eventos consulta

operacional
  └─ Checklists e tarefas operacionais

prestador
  └─ Apenas próprios serviços
```

(Lista canônica em `src/config/roles.ts`.)

## Constantes de Role no Cachola

Lista **completa atual** (sempre conferir `src/config/roles.ts` para versão atualizada):

```ts
// Admin
ADMIN_ACCESS, ADMIN_USERS, ADMIN_UNITS, ADMIN_LOGS

// BI / Atas
BI_ACCESS, ATAS, ATENDIMENTO

// Vendas
VENDAS, VENDAS_MODULE, VENDAS_MANAGE

// Checklists
COMMERCIAL_CHECKLIST_ACCESS, COMMERCIAL_CHECKLIST_MANAGE,
COMMERCIAL_CHECKLIST_ARCHIVE, OPERATIONAL_CHECKLIST

// Manutenção
MAINTENANCE_MODULE, MAINTENANCE_ADMIN

// Outros
EVENTOS, PRESTADORES_ACCESS, TEAM_TASKS,
SETTINGS, DASHBOARD, BACKUP_VIEW, GLOBAL_VIEWER

// Helper
hasRole<T extends readonly string[]>(role, allowed): boolean
```

## ⚠️ Dívida técnica conhecida — roles inline

**6 lugares no código** usam role inline em vez de constante:

| Lugar | Como | Migrar para |
|---|---|---|
| `src/app/(protegido)/atas/...` (5 ocorrências) | `['super_admin','diretor','gerente'].includes(profile.role)` | constante (provável `ATAS_MANAGE`, criar) |
| `src/components/maintenance/chamados/...` (1) | mesmo padrão inline | constante (provável `MAINTENANCE_TICKETS_MANAGE`) |

**Por que ainda não foi corrigido:** decisão pendente sobre o nome canônico das constantes (Bruno precisa decidir).

**Quando mexer nessas áreas:** pegar a oportunidade para migrar. Não criar mais inline em código novo.

## Padrões — quando NULL vs UUID em `unit_id`

```ts
// Permissão global (não atrelada a unidade)
{ user_id, module: 'admin', action: 'view', unit_id: NULL }

// Permissão por unidade
{ user_id, module: 'vendas', action: 'edit', unit_id: '<uuid-pinheiros>' }
{ user_id, module: 'vendas', action: 'edit', unit_id: '<uuid-moema>' }
```

Função `check_permission` aceita `unit_id NULL` na chamada também:
- Se a permissão registrada tem `unit_id NULL` (global), ela libera para qualquer unidade.
- Se a chamada passa `unit_id NULL`, busca permissão global.

## Tela `/403` role-aware

Componente `src/app/403/page.tsx` recebe contexto e mostra mensagem específica:

> "Você não tem acesso ao módulo de Vendas. Para solicitar, fale com um diretor."

Em vez do genérico "Acesso negado". Usuários respondem muito melhor.

## Fluxo completo — exemplo prático

**Cenário:** vendedora abre `/vendas` e tenta editar um deal de outra unidade.

1. **Edge (proxy.ts):** sessão válida → passa.
2. **Server (`/vendas/layout.tsx`):** `requireRoleServer(VENDAS)` → vendedora está em VENDAS → passa.
3. **UI:** carrega `useDealsList` → `useQuery` → API `/api/deals?unitId=outra`.
4. **API (`/api/deals/route.ts`):** `requireRoleApi(VENDAS)` → passa (role correto).
5. **API faz query:** `supabase.from('ploomes_deals').select(...).eq('unit_id', 'outra')`.
6. **RLS no banco:** política `USING (unit_id = ANY(get_user_unit_ids()))` → `'outra'` NÃO está nas unidades dela → retorna 0 rows.
7. **UI:** vendedora vê tela vazia. Não vê deals de outra unidade.

**Defesa em profundidade funcionou.** Mesmo que o frontend tivesse bug e mandasse `unitId=outra`, RLS bloqueia.

## Checklist nova feature com permissão

- [ ] Constante de role apropriada existe em `src/config/roles.ts`?
- [ ] Layout/server component faz `requireRoleServer`?
- [ ] Cada API route faz `requireRoleApi`?
- [ ] Sidebar esconde via `hasRole`?
- [ ] Tabela tem RLS ativada com políticas para todas as 4 actions?
- [ ] Usa helpers SQL (`is_global_viewer`, `get_user_unit_ids`, `check_permission`) em vez de SQL inline?
- [ ] Testado com 2 roles diferentes (super_admin + role real)?
- [ ] Mensagem `/403` faz sentido se for negado?
- [ ] Não introduziu role inline (`['super_admin', 'diretor']`)?