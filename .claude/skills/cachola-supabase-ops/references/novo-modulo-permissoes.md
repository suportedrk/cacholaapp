# Novo Módulo — Receita de Permissões

Esta é a **receita de bolo** para quando você está criando um módulo NOVO do zero (não apenas adicionando uma rota dentro de um módulo existente). Foi criada porque historicamente a parte de permissões "pingou" em vários lugares e, quando alguém esquecia uma camada, o problema só aparecia em produção.

**Use este arquivo quando:** "estou começando o módulo X do zero, da estrutura à tela final."

**NÃO use quando:** apenas adicionando uma rota nova dentro de um módulo existente — para isso, o checklist em `proxy-and-rbac.md` (skill `cachola-stack`) já basta.

---

## ANTES de começar — 3 decisões de design

Pare 5 minutos e responda. Decidir errado aqui custa retrabalho semanas depois.

### Decisão 1 — O módulo é por unidade ou global?

**Por unidade (`unit_id` preenchido):**
- Cada usuário só vê dados da unidade dele.
- Exemplos: Eventos, Vendas, Manutenção, Atas.
- ✅ Default — provavelmente é o que você quer.

**Global (`unit_id NULL`):**
- Mesmos dados para todos os usuários autorizados, independente de unidade.
- Exemplos: Admin/Users, Admin/Logs, BI consolidado.
- Use SOMENTE se faz sentido um diretor em Pinheiros ver dados de Moema lado a lado.

⚠️ **Misto também é válido**: módulo unit-scoped, mas com role `super_admin` que enxerga tudo (via `is_global_viewer()`). É o padrão mais comum.

### Decisão 2 — Granularidade das ações

**4 actions completas (`view`, `create`, `edit`, `delete`):**
- Use quando os papéis vão ser bem diferentes. Ex: vendedora pode `view` mas não `delete`; gerente pode tudo.
- ✅ Default para módulos de trabalho diário.

**Apenas `view` (acesso binário):**
- Use quando "ou você acessa o módulo, ou não". Ex: BI, Backups.
- Nesse caso, criar e editar geralmente não fazem sentido (BI é leitura).

⚠️ Comece com 4 actions se houver dúvida — **sempre dá para ignorar uma action depois**, mas adicionar action nova depois requer migration + revisão de UI.

### Decisão 3 — Já existe constante similar?

Antes de criar `MODULO_NOVO_ACCESS`, abra `src/config/roles.ts` e procure constante com lista de roles parecida.

- Se existir uma com **exatamente os mesmos roles**, considere reutilizar.
- Se for parecida mas não igual, **crie nova** — não tente "espremer" em constante existente. Vai criar acoplamento ruim.

---

## RECEITA — passo-a-passo

A ordem importa. Faça **de baixo para cima** (banco → app → UI). Assim, em qualquer ponto você pode parar e o que já foi feito está consistente.

### Passo 1 — Migration: criar tabela com RLS desde o nascimento

```sql
-- supabase/migrations/NNN_create_modulo_novo.sql
BEGIN;

CREATE TABLE public.modulo_novo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  -- ... outros campos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

-- ⚠️ OBRIGATÓRIO: ativar RLS antes de criar políticas
ALTER TABLE public.modulo_novo ENABLE ROW LEVEL SECURITY;

-- 4 políticas, uma para cada action
CREATE POLICY "modulo_novo_view"
  ON public.modulo_novo
  FOR SELECT
  TO authenticated
  USING (
    is_global_viewer()
    OR check_permission(auth.uid(), 'modulo_novo', 'view', unit_id)
  );

CREATE POLICY "modulo_novo_create"
  ON public.modulo_novo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'modulo_novo', 'create', unit_id)
  );

CREATE POLICY "modulo_novo_edit"
  ON public.modulo_novo
  FOR UPDATE
  TO authenticated
  USING (
    check_permission(auth.uid(), 'modulo_novo', 'edit', unit_id)
  )
  WITH CHECK (
    check_permission(auth.uid(), 'modulo_novo', 'edit', unit_id)
  );

CREATE POLICY "modulo_novo_delete"
  ON public.modulo_novo
  FOR DELETE
  TO authenticated
  USING (
    check_permission(auth.uid(), 'modulo_novo', 'delete', unit_id)
  );

COMMIT;
```

### Passo 2 — Migration: conceder permissões para roles padrão

**Esta é a parte mais esquecida.** A política RLS criada no passo 1 chama `check_permission` — mas se nenhum row existir em `user_permissions` para o módulo novo, NINGUÉM acessa, nem `super_admin`.

Padrão: **conceder via grant baseado em role**, não usuário a usuário.

```sql
-- supabase/migrations/NNN_grant_modulo_novo_permissions.sql
BEGIN;

-- Conceder TODAS as actions a super_admin e diretor (acesso global)
INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted_by)
SELECT
  u.id,
  'modulo_novo',
  action_name,
  NULL,  -- NULL = global, vale para qualquer unidade
  NULL   -- granted_by NULL = sistema
FROM public.users u
CROSS JOIN UNNEST(ARRAY['view', 'create', 'edit', 'delete']) AS action_name
WHERE u.role IN ('super_admin', 'diretor')
ON CONFLICT (user_id, module, action, unit_id) DO NOTHING;

-- Conceder por unidade para gerentes (precisam acesso específico)
INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted_by)
SELECT
  uu.user_id,
  'modulo_novo',
  action_name,
  uu.unit_id,
  NULL
FROM public.user_units uu
INNER JOIN public.users u ON u.id = uu.user_id
CROSS JOIN UNNEST(ARRAY['view', 'create', 'edit']) AS action_name  -- gerente NÃO deleta
WHERE u.role = 'gerente'
ON CONFLICT (user_id, module, action, unit_id) DO NOTHING;

-- Conceder somente VIEW para vendedoras (leitura)
INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted_by)
SELECT
  uu.user_id,
  'modulo_novo',
  'view',
  uu.unit_id,
  NULL
FROM public.user_units uu
INNER JOIN public.users u ON u.id = uu.user_id
WHERE u.role = 'vendedora'
ON CONFLICT (user_id, module, action, unit_id) DO NOTHING;

COMMIT;
```

⚠️ **`ON CONFLICT DO NOTHING` é OBRIGATÓRIO.** Sem isso, se a migration rodar 2x, falha por unicidade.

⚠️ **Esta migration cobre USUÁRIOS EXISTENTES.** Para usuários NOVOS criados depois, ver Passo 6.

### Passo 3 — Atualizar `src/config/roles.ts`

```ts
// src/config/roles.ts

// ... constantes existentes ...

// Módulo Novo
export const MODULO_NOVO_ACCESS = [
  'super_admin',
  'diretor',
  'gerente',
  'vendedora'  // se vendedora pode ver
] as const

export const MODULO_NOVO_MANAGE = [
  'super_admin',
  'diretor',
  'gerente'
] as const  // quem pode criar/editar
```

**Convenção de naming:**
- `MODULO_ACCESS` — quem pode entrar no módulo (ver tela).
- `MODULO_MANAGE` — quem pode criar/editar.
- `MODULO_ADMIN` — quem pode deletar / configurar / fazer ações destrutivas.
- `MODULO_<AREA>_<ACTION>` quando precisar granularidade dentro do módulo (ex: `COMMERCIAL_CHECKLIST_ARCHIVE`).

### Passo 4 — Criar a rota protegida (Server)

```tsx
// src/app/(protegido)/modulo-novo/layout.tsx
import { requireRoleServer } from '@/lib/auth/require-role-server'
import { MODULO_NOVO_ACCESS } from '@/config/roles'

export default async function ModuloNovoLayout({
  children
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MODULO_NOVO_ACCESS)
  return <>{children}</>
}
```

### Passo 5 — Criar APIs com `requireRoleApi`

```ts
// src/app/api/modulo-novo/criar/route.ts
import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/require-role-api'
import { MODULO_NOVO_MANAGE } from '@/config/roles'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { user, profile } = await requireRoleApi(MODULO_NOVO_MANAGE)
  // se não autorizado, requireRoleApi já retornou 401/403

  const body = await req.json()
  // validar com zod aqui se quiser

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('modulo_novo')
    .insert({ ...body, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
```

⚠️ **Cada rota da API precisa de seu próprio `requireRoleApi`** com a constante apropriada (`MANAGE` para POST/PATCH/DELETE, `ACCESS` para GET).

### Passo 6 — Cadastro automático para usuários NOVOS

A migration do Passo 2 deu permissão para usuários EXISTENTES. Mas e quando um novo usuário é criado depois?

**Solução: trigger no INSERT de `public.users`** (ou em script de seed):

```sql
-- supabase/migrations/NNN_trigger_grant_default_permissions.sql
-- (esta migration só precisa existir UMA vez no projeto, evolui depois)

CREATE OR REPLACE FUNCTION public.grant_default_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Quando user nasce com role super_admin/diretor: tudo, global
  IF NEW.role IN ('super_admin', 'diretor') THEN
    INSERT INTO public.user_permissions (user_id, module, action, unit_id)
    SELECT NEW.id, m, a, NULL
    FROM UNNEST(ARRAY[
      'modulo_novo', 'eventos', 'vendas', 'bi', 'atas'
      -- ... lista completa de módulos
    ]) AS m
    CROSS JOIN UNNEST(ARRAY['view', 'create', 'edit', 'delete']) AS a
    ON CONFLICT (user_id, module, action, unit_id) DO NOTHING;
  END IF;

  -- Para outros roles, permissão é concedida quando user_units é populado
  -- (ver trigger separado em user_units)

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grant_default_permissions
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION grant_default_permissions();
```

⚠️ **Cada vez que um módulo NOVO é criado, atualizar a lista no trigger.** Adicionar nova migration que faz `CREATE OR REPLACE FUNCTION` com a lista expandida.

**Alternativa simples:** se sua app já tem um endpoint `/api/admin/users/create` que faz o INSERT, fazer o cadastro de permissões lá em código TypeScript em vez de trigger SQL. Mais flexível, mais visível em PR review.

### Passo 7 — Sidebar e UI

```tsx
// src/components/layout/sidebar.tsx
import { hasRole, MODULO_NOVO_ACCESS } from '@/config/roles'

{hasRole(profile.role, MODULO_NOVO_ACCESS) && (
  <SidebarItem href="/modulo-novo" icon={IconNovo}>
    Módulo Novo
  </SidebarItem>
)}
```

E botões dentro do módulo:
```tsx
{hasRole(profile.role, MODULO_NOVO_MANAGE) && (
  <Button onClick={handleCreate}>Criar</Button>
)}
```

### Passo 8 — Mensagem `/403` específica

Se um usuário tentar acessar `/modulo-novo` sem permissão, ver a mensagem:

> "Você não tem acesso ao Módulo Novo. Para solicitar, fale com o seu gerente."

Implementação: a `requireRoleServer` redireciona para `/403?from=modulo_novo`. A página `/403` lê o param e mostra mensagem específica. Se a página `/403` não tem essa mensagem ainda, **adicionar** no switch dela.

### Passo 9 — Testar com 2 usuários

**Não pule isso.** Crie/use usuário de teste de 2 roles:
- 1 `super_admin` — vê tudo, pode tudo.
- 1 role específico do seu caso (gerente, vendedora, etc.) — vê só o esperado.

Cenários a testar:
- [ ] Login com role correto → vê o módulo no sidebar.
- [ ] Login com role sem acesso → NÃO vê no sidebar.
- [ ] URL direta `/modulo-novo` com role sem acesso → redireciona para `/403`.
- [ ] API direta (curl com cookie do user sem role) → 403.
- [ ] User com role MANAGE → vê botão "Criar". Sem MANAGE → não vê.
- [ ] User da unidade A → não vê dados da unidade B (RLS).
- [ ] Mensagem `/403` faz sentido.

---

## Cenários comuns que escapam

Lista do que historicamente foi esquecido (por isso virou "trabalhoso"):

### 🚨 Sidebar mostra mas API não bloqueia
**Sintoma:** usuário vê item no menu, clica, recebe erro 500.
**Causa:** `hasRole` no sidebar OK, mas API route esqueceu `requireRoleApi`.
**Prevenção:** Passo 5 do checklist.

### 🚨 API bloqueia mas RLS não
**Sintoma:** funciona normal, até alguém descobrir que via Supabase Studio dá pra ler tudo.
**Causa:** `requireRoleApi` na route OK, mas `ALTER TABLE x ENABLE ROW LEVEL SECURITY` esquecido.
**Prevenção:** Passo 1, linha "OBRIGATÓRIO".

### 🚨 RLS criada mas user_permissions vazia
**Sintoma:** ninguém acessa o módulo, nem super_admin. Tela vazia.
**Causa:** Política RLS criada (Passo 1) mas migration de grant (Passo 2) não foi feita ou não rodou.
**Prevenção:** verificar `SELECT count(*) FROM user_permissions WHERE module = 'modulo_novo'` em dev antes do deploy.

### 🚨 Funciona em dev, quebra em prod
**Sintoma:** após deploy, todos os usuários sem acesso.
**Causa:** migration de grant (Passo 2) usou IDs de unidade hardcoded de dev (UUIDs locais), prod tem outros UUIDs.
**Prevenção:** SEMPRE referenciar via `WHERE u.role = 'X'` ou JOIN com `user_units`, NUNCA UUID literal.

### 🚨 Novo user criado depois não tem acesso
**Sintoma:** funcionário novo entra, sidebar não mostra módulo X.
**Causa:** migration de grant rodou só para users existentes. User novo não recebe.
**Prevenção:** Passo 6 (trigger ou lógica em `/api/admin/users/create`).

### 🚨 Constante criada mas não exportada
**Sintoma:** import quebra build.
**Causa:** constante adicionada em `roles.ts` mas sem `export`.
**Prevenção:** seguir template do Passo 3 que tem `export const` explícito.

### 🚨 Permissão removida visualmente, mas dados ainda acessíveis
**Sintoma:** sidebar escondeu, botão sumiu, mas API ainda retorna 200 em chamada direta.
**Causa:** UI escondeu mas `requireRoleApi` da rota não foi atualizado.
**Prevenção:** **A camada de API é a verdade**. Sidebar/botões são *presentation*, segurança é a API + RLS. Se você tirou de um lugar, tire dos 3.

### 🚨 Migration de grant antes da migration de tabela
**Sintoma:** deploy quebra com "table does not exist".
**Causa:** migration `NNN_grant_*.sql` numerada antes de `NNN_create_*.sql`.
**Prevenção:** sempre `create` ANTES de `grant` na numeração sequencial.

---

## Ordem das migrations — exemplo concreto

Se você está criando o módulo "Tarefas" (hipotético):

```
078_create_tasks_table.sql           # cria tabela + RLS + 4 políticas
079_grant_tasks_permissions.sql      # popula user_permissions para users existentes
080_update_default_permissions_trigger.sql  # adiciona 'tasks' à lista do trigger
```

A ordem importa. 078 antes de 079 antes de 080.

---

## Tabela final — checklist consolidado

Use isso como "definition of done" do módulo:

| # | Camada | O que | Done? |
|---|---|---|---|
| 1 | Banco | Tabela criada com RLS ativada |  |
| 2 | Banco | 4 políticas (view/create/edit/delete) |  |
| 3 | Banco | Migration de grant para users existentes |  |
| 4 | Banco | Trigger de novo user atualizado (se for o caso) |  |
| 5 | Config | Constante(s) em `src/config/roles.ts` |  |
| 6 | Server | `layout.tsx` com `requireRoleServer` |  |
| 7 | API | Cada route com `requireRoleApi` apropriado |  |
| 8 | UI | Sidebar com `hasRole` |  |
| 9 | UI | Botões de ação com `hasRole` |  |
| 10 | UI | Mensagem `/403` específica criada |  |
| 11 | Test | Testado com 2 roles |  |
| 12 | Test | Testado com 2 unidades (se unit-scoped) |  |

Se algum item não estiver feito, **o módulo não está pronto para produção**.