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

> Atualizado em 03/mai/2026: 9 arquivos / 13 ocorrências confirmadas (ver Fase 2 da quitação de dívidas).

**13 ocorrências em 9 arquivos** usam role inline em vez de constante:

**Frontend (atas, checklists, manutenção, onboarding):**

| Arquivo | Padrão inline | Migrar para |
|---|---|---|
| `src/app/(auth)/atas/nova/page.tsx` | `const CREATE_ROLES = ['super_admin','diretor','gerente']` | constante nova `ATAS_ELEVATED_ROLES` em `roles.ts` |
| `src/app/(auth)/atas/page.tsx` | `const ELEVATED_ROLES = ['super_admin','diretor','gerente']` | mesma constante nova acima |
| `src/app/(auth)/atas/[id]/editar/page.tsx` | `const EDIT_ROLES = ['super_admin','diretor','gerente']` | mesma constante nova acima |
| `src/app/(auth)/atas/[id]/page.tsx` | `const ELEVATED_ROLES = ['super_admin','diretor','gerente']` | mesma constante nova acima |
| `src/app/(auth)/checklists/tarefas-equipe/page.tsx` | `['super_admin','diretor','gerente'].includes(...)` | `TEAM_TASKS_ROLES` (já existe) |
| `src/app/(auth)/manutencao/chamados/[id]/page.tsx` | `const MANAGER_ROLES = ['super_admin','diretor','gerente']` | `MAINTENANCE_ADMIN_ROLES` (já existe) |
| `src/components/features/onboarding/setup-checklist-card.tsx` | `['super_admin','diretor','gerente'].includes(...)` | constante a decidir (gerente vê onboarding?) |
| `src/hooks/use-onboarding.ts` | `['super_admin','diretor','gerente'].includes(...)` | mesma constante do item acima |

**Backend (API routes, lib/notifications) — 5 ocorrências em 5 arquivos, mais 4 extras em notifications.ts:**

| Arquivo | Padrão inline | Migrar para |
|---|---|---|
| `src/app/api/ploomes/config/route.ts` | `['super_admin','diretor','gerente'].includes(profile.role)` | `SETTINGS_ROLES` ou nova `PLOOMES_MANAGE_ROLES` |
| `src/app/api/ploomes/sync/route.ts` | mesmo padrão | mesma constante acima |
| `src/app/api/cron/check-provider-alerts/route.ts` | `.in('role', [...])` × 3 | `[...MAINTENANCE_MODULE_ROLES]` ou `PRESTADORES_ACCESS_ROLES` |
| `src/app/api/email/maintenance-emergency/route.ts` | `.in('role', [...])` | `[...MAINTENANCE_MODULE_ROLES]` |
| `src/lib/notifications.ts` | `.in('role', [...])` × 4 | constantes por contexto (ver Fase 2) |

**Por que ainda não foi corrigido:** quitação programada para Fase 2 do projeto de dívida técnica.

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

## Paridade de GRANTs entre dev-local e produção

### O problema

As catalog tables criadas na Migration 071 (`modules`, `roles`, `role_permissions`,
`role_template_audit`) podem ter GRANTs diferentes entre dev-local e produção. A divergência
não causa erro imediato — o Docker local tem defaults mais restritivos que o Supabase
self-hosted da VPS — e só aparece quando alguém recria o banco local do zero.

### Estado verificado (2026-05-03)

Comparação real via `\dp` em ambos os ambientes:

| Tabela | Role | Produção (VPS) | Dev-local |
|--------|------|----------------|-----------|
| `modules` | anon | `arwdDxt` (ALL) | `r` (SELECT) |
| `modules` | authenticated | `arwdDxt` (ALL) | `r` (SELECT) |
| `modules` | service_role | `arwdDxt` (ALL) | `r` (SELECT) |
| `roles` | anon | `arwdDxt` (ALL) | `r` (SELECT) |
| `roles` | authenticated | `arwdDxt` (ALL) | `r` (SELECT) |
| `roles` | service_role | `arwdDxt` (ALL) | `r` (SELECT) |
| `role_permissions` | anon | `arwdDxt` (ALL) | `arwd` |
| `role_permissions` | authenticated | `arwdDxt` (ALL) | `arwd` |
| `role_permissions` | service_role | `arwdDxt` (ALL) | `arwd` |
| `role_template_audit` | anon | `arwdDxt` (ALL) | `arwd` |
| `role_template_audit` | authenticated | `arwdDxt` (ALL) | `arwd` |
| `role_template_audit` | service_role | `arwdDxt` (ALL) | `arwd` |

Legenda: `a`=INSERT `r`=SELECT `w`=UPDATE `d`=DELETE `D`=TRUNCATE `x`=REFERENCES `t`=TRIGGER

**Produção usa o padrão Supabase ("GRANT ALL + RLS enforces").** Dev-local tem grants mais
restritivos provenientes das migrations. Ambos são seguros — RLS em `role_permissions` e
`role_template_audit` garante que apenas `is_super_admin()` pode escrever. A diferença
prática para `modules`/`roles` (read-only intencionalmente) não causa bugs.

### Quando verificar

Após `docker compose down -v` + sync de produção em dev-local, especialmente se a
UI `/admin/cargos` começar a retornar 42501 (violação de RLS) ao tentar salvar templates.

### Comando de diagnóstico

```bash
# Rodar nos dois ambientes e comparar
docker exec cacholaos-db psql -U postgres -d postgres -c "\dp public.modules"
docker exec cacholaos-db psql -U postgres -d postgres -c "\dp public.roles"
docker exec cacholaos-db psql -U postgres -d postgres -c "\dp public.role_permissions"
docker exec cacholaos-db psql -U postgres -d postgres -c "\dp public.role_template_audit"

# Produção
ssh cacholaos-vps "docker exec supabase-db psql -U postgres -d postgres -c '\dp public.role_permissions'"
```

### Fix idempotente para alinhar dev-local com produção

```sql
-- Executar no banco local se os GRANTs estiverem insuficientes
-- GRANT é idempotente: re-executar não causa erro
GRANT ALL ON public.modules           TO anon, authenticated, service_role;
GRANT ALL ON public.roles             TO anon, authenticated, service_role;
GRANT ALL ON public.role_permissions  TO anon, authenticated, service_role;
GRANT ALL ON public.role_template_audit TO anon, authenticated, service_role;
```

> **Nota:** ampliar grants não enfraquece a segurança — RLS em `role_permissions` e
> `role_template_audit` continua exigindo `is_super_admin()` para qualquer escrita.
> `modules` e `roles` não têm policy de escrita, logo são efetivamente read-only
> mesmo com `arwdDxt` concedido.