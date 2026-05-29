# FASE A — Levantamento read-only do módulo Checklist Comercial

> Documento de diagnóstico. **Nenhuma migration, RLS, guard ou build foi alterado.**
> Branch: `develop`. Data: 2026-05-28.
> Referência metodológica: `.claude/skills/cachola-rbac-pattern/SKILL.md` (receita de conversão,
> D1–D4, Passos 1–6) e `docs/rbac/proposta-arquitetura-alvo.md` (Aprendizados 1, 5, 8).

---

## Achado principal (leia primeiro)

**A camada de banco deste módulo JÁ FOI convertida para o molde de ouro na Fase 2
(migration 117, deployada em v1.27.0 em 2026-05-26).** As 5 tabelas (18 policies),
as funções de visibilidade (`can_view_commercial_template`, `can_view_commercial_task`)
e o RPC `apply_commercial_template` já leem `check_permission(...)`, e fazem isso
**respeitando a semântica por tabela (Aprendizado 5)** — Catálogo usa `check_permission(view)`,
Propriedade e Estrutural deliberadamente NÃO usam.

Consequência: **o escopo líquido da Fase 3 para este módulo é só a camada de aplicação
(os guards de rota — os 4 `layout.tsx`).** Não há trabalho de RLS pendente. E desse escopo,
apenas **1 guard é Conversível** (a raiz `/vendas/checklist`); os 3 sub-layouts de gerência
são **D2-hold** (converter expandiria o público para `pos_vendas`).

---

## 1) Inventário de superfícies de acesso

### 1.1 Guards de rota (Server Layouts) — camada de aplicação

| # | Superfície | Arquivo:linha | Guard atual |
|---|-----------|---------------|-------------|
| L1 | Raiz do módulo `/vendas/checklist` | [layout.tsx:14](../../src/app/(auth)/vendas/checklist/layout.tsx#L14) | `requireRoleServer(COMMERCIAL_CHECKLIST_ACCESS_ROLES)` → super_admin, diretor, vendedora, pos_vendas |
| L2 | `/vendas/checklist/automacoes` | [automacoes/layout.tsx:14](../../src/app/(auth)/vendas/checklist/automacoes/layout.tsx#L14) | `requireRoleServer(COMMERCIAL_CHECKLIST_MANAGE_ROLES)` → super_admin, diretor |
| L3 | `/vendas/checklist/equipe` | [equipe/layout.tsx:14](../../src/app/(auth)/vendas/checklist/equipe/layout.tsx#L14) | `requireRoleServer(COMMERCIAL_CHECKLIST_MANAGE_ROLES)` → super_admin, diretor |
| L4 | `/vendas/checklist/templates` | [templates/layout.tsx:15](../../src/app/(auth)/vendas/checklist/templates/layout.tsx#L15) | `requireRoleServer(COMMERCIAL_CHECKLIST_MANAGE_ROLES)` → super_admin, diretor |

**Sub-rota `/templates/[id]`:** NÃO tem `layout.tsx` próprio — **herda** o guard de
`templates/layout.tsx` (L4). Confirmado: o único arquivo é
[templates/[id]/page.tsx](../../src/app/(auth)/vendas/checklist/templates/[id]/page.tsx).

### 1.2 Condicionais de UI por cargo (pages)

Nenhum `canViewFestaValues`, `isVendedora`, `isManager` ou `role IN` inline neste módulo.
Apenas `hasRole` com a constante de arquivamento:

| # | Superfície | Arquivo:linha | Condicional |
|---|-----------|---------------|-------------|
| U1 | Botão excluir automação | [automacoes/page.tsx:36](../../src/app/(auth)/vendas/checklist/automacoes/page.tsx#L36) | `canDelete = hasRole(profile?.role, COMMERCIAL_CHECKLIST_ARCHIVE_ROLES)` → super_admin, diretor |
| U2 | Botão arquivar/reativar template (lista) | [templates/page.tsx:38](../../src/app/(auth)/vendas/checklist/templates/page.tsx#L38) | `canArchive = hasRole(profile?.role, COMMERCIAL_CHECKLIST_ARCHIVE_ROLES)` → super_admin, diretor |
| U3 | Botão arquivar template (detalhe) | [templates/[id]/page.tsx:51](../../src/app/(auth)/vendas/checklist/templates/[id]/page.tsx#L51) | `canArchive = hasRole(profile?.role, COMMERCIAL_CHECKLIST_ARCHIVE_ROLES)` → super_admin, diretor |

> U1–U3 vivem DENTRO das rotas de gerência (já guardadas por MANAGE_ROLES em L2/L4),
> logo só são alcançáveis por super_admin/diretor de qualquer forma. São controles finos
> de arquivar/excluir, não a fronteira de acesso ao módulo.

### 1.3 Gating de sidebar (cosmético)

| # | Superfície | Arquivo:linha | Gating |
|---|-----------|---------------|--------|
| S1 | Item pai "Checklist Comercial" | [nav-items.ts:98](../../src/components/layout/nav-items.ts#L98) | `COMMERCIAL_CHECKLIST_ACCESS_ROLES` |
| S2 | Filho "Minhas Tarefas" | [nav-items.ts:104](../../src/components/layout/nav-items.ts#L104) | `COMMERCIAL_CHECKLIST_ACCESS_ROLES` |
| S3 | Filho "Equipe Comercial" | [nav-items.ts:110](../../src/components/layout/nav-items.ts#L110) | `COMMERCIAL_CHECKLIST_MANAGE_ROLES` |
| S4 | Filho "Templates" | [nav-items.ts:116](../../src/components/layout/nav-items.ts#L116) | `COMMERCIAL_CHECKLIST_MANAGE_ROLES` |
| S5 | Filho "Automações" | [nav-items.ts:122](../../src/components/layout/nav-items.ts#L122) | `COMMERCIAL_CHECKLIST_MANAGE_ROLES` |

> A sidebar **esconde** itens; ela não é a fronteira de segurança (o guard de layout é).
> Quando o guard de rota for convertido, o `allowedRoles` da sidebar pode acompanhar como
> espelho de UX — mas isso é cosmético e segue a rota.

### 1.4 API routes

| # | Superfície | Arquivo | Guarda |
|---|-----------|---------|--------|
| A1 | Cron de alertas (lê `commercial_tasks` p/ notificar atrasos) | [api/cron/check-alerts/route.ts:181](../../src/app/api/cron/check-alerts/route.ts#L181) | `CRON_SECRET` (Bearer) — **não é guard de cargo** |

Não há rota `/api/**` dedicada a templates/tasks/automações — o CRUD passa direto pelos
hooks TanStack Query → cliente Supabase → **RLS** (camada 4). A1 é job de sistema, não
superfície de role.

### 1.5 RPCs / funções SQL que tocam `commercial_*` (estado pós-migration 117)

Localizadas em [supabase/migrations/117_checklist_comercial_rls_golden_pattern.sql](../../supabase/migrations/117_checklist_comercial_rls_golden_pattern.sql)
(origem em 064/065/066, reescritas em 117).

**R1 — `apply_commercial_template(UUID, UUID, DATE)`** — guard atual (117:467-470):
```sql
v_can_create := (
  check_permission(auth.uid(), 'checklist_comercial', 'create')
  OR auth.uid() = p_assignee_id   -- self-assign preservado
);
IF NOT v_can_create THEN RAISE EXCEPTION 'not authorized ...'; END IF;
```
→ **Já convertido para `check_permission(create)`** na Fase 2 (gerente removido; self-assign mantido).

**R2 — `trigger_stage_automation(BIGINT)`** — guard atual (117:543-549):
```sql
IF NOT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()
    AND role IN ('super_admin', 'diretor')   -- gerente removido na 117
) THEN
  RAISE EXCEPTION 'access denied';
END IF;
```
→ **Mantido role-based de propósito.** Comentário da própria 117 (linhas 522-526):
não migrar para `check_permission(create)` porque isso incluiria `pos_vendas` (que tem
`create` granted mas nunca disparou esta RPC manual).

**R3 — `trg_stage_automation_fn()`** — trigger interno em `ploomes_deals` (INSERT/UPDATE).
Sem `auth.uid()`, sem guarda de cargo (roda como trigger do sistema). 117 não a alterou.

**R4 — `can_view_commercial_template(UUID)`** (117:98-116) — guard:
```sql
... AND check_permission(auth.uid(), 'checklist_comercial', 'view')
    AND (is_global_viewer() OR t.unit_id IS NULL OR t.unit_id = ANY(get_user_unit_ids()))
```
→ Eixo **Catálogo**. Já convertido.

**R5 — `can_view_commercial_task(UUID)`** (117:128-144) — guard:
```sql
... AND (is_global_viewer() OR ct.assignee_id = auth.uid())
```
→ Eixo **Propriedade**. **SEM** `check_permission(view)` — deliberado (Aprendizado 5).

### 1.6 Policies RLS — 5 tabelas, 18 policies (todas já no molde de ouro via 117)

Cláusulas `USING`/`WITH CHECK` (transcritas de
[117_checklist_comercial_rls_golden_pattern.sql](../../supabase/migrations/117_checklist_comercial_rls_golden_pattern.sql)):

**`commercial_task_templates`** (Catálogo) — 4 policies (117:161-211)
- SELECT `USING`: `check_permission(uid,'checklist_comercial','view') AND (is_global_viewer() OR unit_id IS NULL OR unit_id = ANY(get_user_unit_ids()))`
- INSERT `WITH CHECK`: `check_permission(...,'create') AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))`
- UPDATE `USING`/`WITH CHECK`: `check_permission(...,'edit') AND (is_global_viewer() OR unit_id = ANY(...))`
- DELETE `USING`: `check_permission(...,'delete') AND (is_global_viewer() OR unit_id = ANY(...))`

**`commercial_template_items`** (Catálogo, herda do pai) — 4 policies (117:217-276)
- SELECT `USING`: `can_view_commercial_template(template_id)`
- INSERT/UPDATE/DELETE: `check_permission(...,'create'|'edit'|'delete') AND EXISTS(template do mesmo unit/global)`

**`commercial_tasks`** (Propriedade) — 4 policies (117:283-344)
- SELECT `USING`: `is_global_viewer() OR assignee_id = auth.uid()` — **SEM check_permission(view)**
- INSERT `WITH CHECK`: `(check_permission(...,'create') AND (is_global_viewer() OR unit_id = ANY(...))) OR (assignee_id = auth.uid() AND source = 'manual')`
- UPDATE `USING`/`WITH CHECK`: `(check_permission(...,'edit') AND (is_global_viewer() OR unit_id = ANY(...))) OR assignee_id = auth.uid()`
- DELETE `USING`: `check_permission(...,'delete') AND (is_global_viewer() OR unit_id = ANY(...))` — sem exceção de assignee

**`commercial_task_completions`** (Propriedade, herda da task) — 2 policies (117:351-362)
- SELECT `USING`: `can_view_commercial_task(task_id)`
- INSERT `WITH CHECK`: `can_view_commercial_task(task_id)`
- UPDATE/DELETE: bloqueadas (log imutável)

**`commercial_stage_automations`** (Estrutural) — 4 policies (117:371-415)
- SELECT `USING`: `is_global_viewer()` — **SEM check_permission(view)**
- INSERT/UPDATE/DELETE: `check_permission(...,'create'|'edit'|'delete') AND (is_global_viewer() OR unit_id = ANY(...))`

---

## 2) Classificação

| Superfície | Arquivo:linha | Categoria | Justificativa (1 linha) |
|-----------|---------------|-----------|--------------------------|
| L1 raiz `/vendas/checklist` | layout.tsx:14 | **Conversível** | RLS já usa `check_permission(view)`; converter o guard para `requirePermissionServer('checklist_comercial','view')` torna o toggle real sem expandir público (condicionado à auditoria de prod — §6). |
| L2 `/automacoes` | automacoes/layout.tsx:14 | **D2-hold** | Mapear para `'edit'` admitiria `pos_vendas` (tem edit granted — §5); manter MANAGE_ROLES até existir controle fino. |
| L3 `/equipe` | equipe/layout.tsx:14 | **D2-hold** | Idem L2 — sub-rota de gerência; conversão para `'edit'` expande público. |
| L4 `/templates` | templates/layout.tsx:15 | **D2-hold** | Idem L2 — exemplo literal do D2 na SKILL.md. |
| U1 canDelete automação | automacoes/page.tsx:36 | **D2-hold** | `'delete'` granted a pos_vendas; arquivar/excluir é capacidade de gerência — mantém `hasRole(ARCHIVE_ROLES)`. |
| U2 canArchive template (lista) | templates/page.tsx:38 | **D2-hold** | Idem U1. |
| U3 canArchive template (detalhe) | templates/[id]/page.tsx:51 | **D2-hold** | Idem U1. |
| S1–S5 sidebar | nav-items.ts:98-122 | **Cosmético / segue-rota** | Esconde item; não é fronteira de segurança (o layout guard é). Acompanha a decisão da rota. |
| A1 cron check-alerts | api/cron/check-alerts/route.ts | **Estrutural** | Job de sistema com `CRON_SECRET`; não decide acesso por cargo. |
| R1 `apply_commercial_template` | migration 117:467 | **Conversível — JÁ FEITO** | Convertido para `check_permission(create)` na Fase 2 (self-assign preservado). |
| R2 `trigger_stage_automation` | migration 117:543 | **D2-hold** | Role-based [super_admin,diretor] por design; `check_permission(create)` incluiria pos_vendas. |
| R3 `trg_stage_automation_fn` | migration 117 (não alterada) | **Estrutural** | Trigger interno sem `auth.uid()`; sem cargo a gatear. |
| R4 `can_view_commercial_template` | migration 117:98 | **Conversível — JÁ FEITO** | Eixo Catálogo, usa `check_permission(view)`. |
| R5 `can_view_commercial_task` | migration 117:128 | **D3 / Propriedade — correto por design** | Visibilidade por `assignee_id`; não vira toggle (Aprendizado 5). |
| RLS 5 tabelas (18 policies) | migration 117 | **JÁ FEITO (Fase 2)** | Molde de ouro aplicado respeitando os 3 eixos semânticos. |

---

## 3) Risco de RLS data-unlock (Aprendizado 5)

Análise **hipotética** ("e se aplicássemos `check_permission('view')` literal nesta tabela?"),
cargo a cargo para `COMMERCIAL_CHECKLIST_ACCESS_ROLES` = {super_admin, diretor, vendedora, pos_vendas}.
super_admin é bypass; diretor/pos_vendas são `is_global_viewer()`? — **diretor sim, pos_vendas não**
(pos_vendas tem visão agregada via app, mas no banco não é global viewer). O candidato crítico é a
**vendedora** (tem `view` granted, mas limitada às próprias tasks por `assignee_id`).

| Tabela | Eixo | Sob molde literal `check_permission('view')`, vendedora veria a mais? | Veredito |
|--------|------|----------------------------------------------------------------------|----------|
| `commercial_task_templates` | Catálogo | Não — vendedora já vê templates globais/da unidade (é o comportamento desejado de catálogo). | **SEGURA** |
| `commercial_template_items` | Catálogo (herda) | Não — herda de `can_view_commercial_template`. | **SEGURA** |
| `commercial_tasks` | Propriedade | **SIM** — passaria a ver **todas as tasks da unidade** (não só as próprias via assignee). | **RISCO-DE-EXPANSÃO (sob molde literal) — MITIGADO em 117** |
| `commercial_task_completions` | Propriedade (herda) | **SIM** — herdaria a expansão da task subjacente. | **RISCO-DE-EXPANSÃO (sob molde literal) — MITIGADO em 117** |
| `commercial_stage_automations` | Estrutural | Não — `is_global_viewer()` somente; vendedora/pos_vendas não veem nada (correto). | **SEGURA** |

**Raciocínio ANTES/DEPOIS para o candidato `commercial_tasks`:**
- ANTES (estado atual, pós-117): `USING (is_global_viewer() OR assignee_id = auth.uid())` →
  vendedora vê **apenas as próprias** tasks; pos_vendas idem (só as próprias); diretor vê tudo (global viewer).
- DEPOIS (se aplicássemos o molde literal `check_permission(view) AND unit OR assignee`):
  vendedora veria **todas as tasks da unidade dela** → expansão de escopo não autorizada.

A migration 117 **evitou** isso usando o eixo Propriedade (sem `check_permission(view)`) — exatamente
a lição do Aprendizado 5. As duas tabelas continuam marcadas como RISCO porque é o ponto que o dono
precisa **ratificar** em §6: o tratamento Propriedade (já em produção) é o estado final pretendido,
e nenhuma conversão futura deve reintroduzir `check_permission(view)` nessas duas tabelas.

---

## 4) Auditoria de backfill (Passo 1 / Aprendizado 1)

Guard da raiz = `COMMERCIAL_CHECKLIST_ACCESS_ROLES` = {super_admin, diretor, vendedora, pos_vendas}.
super_admin é bypass em `check_permission` → **excluído** da auditoria. Verifica-se que todo usuário
ativo cujo role ∈ {diretor, vendedora, pos_vendas} tem `(user_id, 'checklist_comercial', 'view')` granted.

### Resultado LOCAL (⚠️ apenas contas `@cachola.local`)

Query de gap retornou **0 linhas** (nenhum gap). Cobertura positiva local:

| role | ativos | com `view` grant |
|------|--------|------------------|
| super_admin | 1 | 0 *(bypass — esperado, sem backfill)* |
| diretor | 1 | 1 |
| vendedora | 1 | 1 |
| pos_vendas | 1 | 1 |

> ⚠️ **Local-clean ≠ Prod-clean.** O banco local só tem contas de teste `@cachola.local`.
> Esta auditoria **não** substitui a execução em produção.

### Query pronta para PRODUÇÃO (rodar via SSH — GATE de deploy, NÃO rodar agora)

```sql
-- PRODUÇÃO (VPS): docker exec -i supabase-db psql -U postgres -d postgres
-- Gap de backfill: usuários ativos no guard que NÃO têm checklist_comercial.view granted.
SELECT u.role, u.name, u.email
FROM public.users u
WHERE u.is_active = true
  AND u.role IN ('diretor','vendedora','pos_vendas')   -- super_admin é bypass
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = u.id
      AND up.module = 'checklist_comercial'
      AND up.action = 'view'
      AND up.granted = true
  )
ORDER BY u.role, u.name;
-- Esperado: 0 linhas. Qualquer linha = backfill aditivo (ON CONFLICT DO NOTHING) antes de converter L1.
```

---

## 5) Auditoria de overrides escondidos (Passo 2 / Aprendizado 8)

Usuários com grant individual em `user_permissions` para `checklist_comercial` (granted=true)
cujo cargo está **FORA** do guard atual {super_admin, diretor, vendedora, pos_vendas} — grants
dormindo que a conversão de L1 acordaria.

### Resultado LOCAL (⚠️ apenas contas `@cachola.local`)

Query retornou **0 linhas** — nenhum override escondido local.

**Evidência de apoio ao D2 (grants de `pos_vendas`, LOCAL):** pos_vendas tem `view`, `create`,
`edit` e `delete` todos granted. Isso confirma que mapear os sub-layouts de gerência (L2–L4) para
`'edit'` — ou os botões U1–U3 para `'delete'` — **admitiria pos_vendas** → expansão de público
(daí o D2-hold). Confirmado também pela pré-validação da própria migration 117 (exige os 4 grants
para diretor e pos_vendas).

> ⚠️ **Local-clean ≠ Prod-clean.** Aprendizado 8 documenta que overrides reais (ex.: Suporte DRK,
> Raphaela/Bruna, Bruno Casaletti gerente) só aparecem rodando contra produção.

### Query pronta para PRODUÇÃO (rodar via SSH — GATE de deploy, NÃO rodar agora)

```sql
-- PRODUÇÃO (VPS): docker exec -i supabase-db psql -U postgres -d postgres
-- Overrides escondidos: grants em checklist_comercial p/ cargos FORA do guard atual.
SELECT u.id, u.role, u.name, u.email, up.action, up.granted, up.unit_id
FROM public.users u
JOIN public.user_permissions up
  ON up.user_id = u.id
  AND up.module = 'checklist_comercial'
  AND up.granted = true
WHERE u.role NOT IN ('super_admin','diretor','vendedora','pos_vendas')
ORDER BY u.role, u.name, up.action;
-- Para cada linha: dono decide (A) aceitar, (B) revogar antes, (C) aceitar + auditar em PR separado.
```

---

## 6) Gates para o dono (decisões binárias — NÃO decididas aqui)

> A FASE B (conversão) só começa após decisão explícita em todos os gates abaixo.

**G1 — Converter SOMENTE o guard raiz L1?**
Converter [layout.tsx:14](../../src/app/(auth)/vendas/checklist/layout.tsx#L14) de
`requireRoleServer(COMMERCIAL_CHECKLIST_ACCESS_ROLES)` para
`requirePermissionServer('checklist_comercial','view')`.
**(A) Sim, converter L1** / **(B) Não converter agora**.
*Condicionado a G5 limpo (ou overrides aceitos), senão antes≠depois.*

**G2 — Confirmar D2-hold das 3 sub-rotas de gerência (L2 automações, L3 equipe, L4 templates)?**
Mantê-las em `COMMERCIAL_CHECKLIST_MANAGE_ROLES` [super_admin, diretor] e **NÃO** mapear para
`'edit'` (que admitiria pos_vendas).
**(A) Sim, manter trava de cargo (D2-hold)** / **(B) Converter para `'edit'` mesmo expandindo p/ pos_vendas**.

**G3 — Confirmar D2-hold dos botões arquivar/excluir (U1–U3)?**
Mantê-los em `hasRole(COMMERCIAL_CHECKLIST_ARCHIVE_ROLES)` [super_admin, diretor].
**(A) Sim, manter `hasRole`** / **(B) Mapear para `'delete'`/controle fino**.

**G4 — Confirmar `trigger_stage_automation` (R2) permanece role-based?**
Manter `role IN ('super_admin','diretor')` em vez de `check_permission(create)` (que incluiria pos_vendas).
**(A) Sim, manter role-based** / **(B) Migrar para check_permission**.

**G5 — Ratificar as 2 tabelas RISCO-DE-EXPANSÃO (`commercial_tasks`, `commercial_task_completions`)?**
Confirmar que o eixo Propriedade já aplicado em 117 (sem `check_permission(view)`) é o estado final
pretendido e que nenhuma conversão futura reintroduzirá `check_permission(view)` nessas tabelas.
**(A) Sim, ratificar o tratamento Propriedade** / **(B) Revisar**.

**G6 — Auditoria de produção (obrigatória pré-deploy, Aprendizado 8)?**
Autorizar a execução das queries de §4 e §5 contra o banco de **produção** via SSH antes de qualquer
deploy da FASE B. Para cada override real que aparecer: dono decide (A) aceitar / (B) revogar / (C) aceitar+auditar.
**(A) Sim, rodar auditoria em prod e reportar** / **(B) Não prosseguir**.

---

## Resumo do escopo da FASE B (se G1+G6 aprovados)

Conversão mínima: **1 linha** ([layout.tsx:14](../../src/app/(auth)/vendas/checklist/layout.tsx#L14))
+ espelho cosmético da sidebar (S1/S2) opcional. Todo o resto é D2-hold, Estrutural, ou já feito na
Fase 2 (migration 117). Sem nova migration de RLS para este módulo.
