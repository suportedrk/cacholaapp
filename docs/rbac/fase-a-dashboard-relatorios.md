# FASE A — Levantamento READ-ONLY: Dashboard + Relatórios

> RBAC Fase 3. **Dois módulos de catálogo distintos**: `dashboard` e `relatorios`.
> Documento de diagnóstico — **nenhuma** conversão, migration ou alteração de guard foi feita.
> Data: 2026-05-29 · branch `develop` · auditoria local (`cacholaos-db`) + queries de produção prontas (gate).

---

## TL;DR

- **Os dois módulos convertem-se com mudança de UMA linha cada** (o guard de layout). Não há RPC com guarda de cargo para reescrever em nenhum dos dois.
  - **Dashboard**: zero RPCs. Hooks fazem query direta em tabelas (RLS). Conversão = trocar `requireRoleServer(DASHBOARD_ACCESS_ROLES)` → `requirePermissionServer('dashboard','view')`.
  - **Relatórios**: 13 RPCs `report_*`, **todas `SECURITY INVOKER` e SEM guarda nenhuma** (sem `check_permission`, sem `role IN`, sem máscara de valor) — dependem 100% do RLS das tabelas. Conversão = trocar `requireRoleServer(BI_ACCESS_ROLES)` → `requirePermissionServer('relatorios','view')`. As RPCs ficam intactas.
- **Risco assimétrico de backfill:**
  - `dashboard` é a **landing page de 9 cargos** → backfill obrigatório e GRANDE; falha = lockout em massa da tela inicial.
  - `relatorios` hoje é só `super_admin + diretor` → backfill mínimo.
- **Decisão de intenção (relatorios):** existem overrides dormentes (financeiro view+export, gerente view). O **template NÃO inclui** ger/fin em `relatorios.view` — então honrar os overrides acorda **apenas os indivíduos** que os têm, não todos os ger/fin. Expandir para todos seria mudança de produto (adicionar ao template). Três caminhos no Gate (iii).
- **Ação `export` (relatorios) não tem superfície server-side**: exportação é 100% client-side (SheetJS/jsPDF) sobre linhas já carregadas. Não há gate para converter → `export` é **D3 (cosmético)** ou **D2-hold**, não um `check_permission` real. Gate (iv).
- **Comentário STALE confirmado** no `/relatorios` (Aprendizado 7): diz "gerente e financeiro" mas a constante é `super_admin + diretor`. O `/dashboard` **não** tem comentário stale (o comentário fala do redirect freelancer/entregador, que é correto).

---

# MÓDULO 1 — `dashboard`

## 1) Inventário — `dashboard`

### 1.1 Guard de layout

| Arquivo:linha | Guard | Constante | Cargos | Comentário |
|---|---|---|---|---|
| `src/app/(auth)/dashboard/layout.tsx:14` | `requireRoleServer(DASHBOARD_ACCESS_ROLES)` | `DASHBOARD_ACCESS_ROLES` (`roles.ts:293-303`) | super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao, rh (**9**) | `layout.tsx:4-8` — fala do redirect freelancer/entregador. **Não é stale** (acurado). |

> É a **landing page** pós-login de quase todo mundo. Apenas `freelancer` e `entregador` ficam fora (vão para `/checklists/minhas-tarefas`).

### 1.2 Condicionais de UI por cargo (`dashboard/page.tsx`)

| Arquivo:linha | Condicional | Efeito | Classificação |
|---|---|---|---|
| `dashboard/page.tsx:35,62` | `hasRole(profile?.role, ADMIN_ACCESS_ROLES)` → `canManagePreReservas` | Mostra botão "Nova pré-reserva" + gestão de pré-reservas no calendário (sa+diretor) | **D3 / fora de escopo** — é gate do recurso *pré-reservas* (ADMIN), não uma ação do módulo `dashboard`. NÃO tocar nesta fase. |

Nenhum `DASHBOARD_ACCESS_ROLES`, `BI_ACCESS_ROLES`, `canViewFestaValues` ou `role IN` usado nos componentes do dashboard para gating de conteúdo.

### 1.3 Funções SQL que alimentam a rota

**NENHUMA RPC.** Todos os hooks fazem query direta de tabela (governadas por RLS, rodando como o usuário chamador):

| Hook (`src/hooks/use-dashboard.ts`) | Tabelas |
|---|---|
| `useDashboardKpis` (`:281`) | `events`, `ploomes_deals`, `ploomes_unit_mapping`, `maintenance_tickets` |
| `useDashboardStats` (`:64`) | `events` |
| `useDashboardMaintenanceStats` (`:102`) | `maintenance_tickets` |
| `useCalendarEvents` (`:137`) | `events` |
| `useCalendarMaintenance` (`:216`) | `maintenance_tickets` |
| Outros hooks da página | `useCalendarChecklists`, `useCalendarPreReservas`, `usePreReservasPloomes` — todos query de tabela / view |

→ **Não há guarda de cargo em SQL para converter.** O único controle de acesso da rota é o guard de layout. Os dados já são escopados por RLS por unidade.

### 1.4 RLS de tabelas próprias

`dashboard` não tem tabela própria. Consome `events`, `maintenance_tickets`, `ploomes_deals`, etc. — RLS dessas tabelas é responsabilidade dos respectivos módulos, **fora do escopo** desta conversão.

---

## MÓDULO 2 — `relatorios`

## 1) Inventário — `relatorios`

### 1.1 Guard de layout

| Arquivo:linha | Guard | Constante | Cargos | Comentário |
|---|---|---|---|---|
| `src/app/(auth)/relatorios/layout.tsx:14` | `requireRoleServer(BI_ACCESS_ROLES)` | `BI_ACCESS_ROLES` (`roles.ts:19-22`) | super_admin, diretor (**2**) | `layout.tsx:5-6` — **STALE**: diz "super_admin, diretor, gerente e financeiro". Real = só sa+diretor. (Aprendizado 7.) |

> ⚠️ O módulo de catálogo é **`relatorios`** (próprio). A reutilização de `BI_ACCESS_ROLES` é só conveniência de código — **não** vincula Relatórios a `bi`.

### 1.2 Condicionais de UI por cargo

Nenhuma. `relatorios/page.tsx` e os 4 tabs (`events-tab`, `maintenance-tab`, `checklists-tab`, `staff-tab`) não têm gating por cargo — a página inteira já é protegida pelo guard de layout. O botão "Exportar" (`export-button.tsx`) aparece para qualquer um que chegue à página.

### 1.3 Funções SQL que alimentam a rota — 13 RPCs `report_*`

**Todas `SECURITY INVOKER`, ZERO guarda** (confirmado via `pg_get_functiondef` em `cacholaos-db`):

| RPC | Args | `SECURITY` | `check_permission` | `role IN` | máscara valor | Chamada em |
|---|---|---|---|---|---|---|
| `report_events_summary` | `p_unit_id, p_from, p_to` | INVOKER | ❌ | ❌ | ❌ | `use-reports.ts:51` |
| `report_events_by_month` | idem | INVOKER | ❌ | ❌ | ❌ | `:66` |
| `report_events_by_type` | idem | INVOKER | ❌ | ❌ | ❌ | `:78` |
| `report_events_by_venue` | idem | INVOKER | ❌ | ❌ | ❌ | `:90` |
| `report_maintenance_summary` | idem | INVOKER | ❌ | ❌ | ❌ | `:140` |
| `report_maintenance_by_month` | idem | INVOKER | ❌ | ❌ | ❌ | `:155` |
| `report_maintenance_by_sector` | idem | INVOKER | ❌ | ❌ | ❌ | `:167` |
| `report_checklists_summary` | idem | INVOKER | ❌ | ❌ | ❌ | `:215` |
| `report_checklists_by_month` | idem | INVOKER | ❌ | ❌ | ❌ | `:230` |
| `report_checklists_by_category` | idem | INVOKER | ❌ | ❌ | ❌ | `:242` |
| `report_staff_summary` | idem | INVOKER | ❌ | ❌ | ❌ | `:294` |
| `report_staff_by_events` | idem | INVOKER | ❌ | ❌ | ❌ | `:310` |
| `report_staff_by_checklists` | idem | INVOKER | ❌ | ❌ | ❌ | `:322` |

Queries diretas adicionais nos hooks: `.from('events')` (`use-reports.ts:103`), `.from('maintenance_tickets')` (`:179`), `.from('checklists')` (`:254`).

> **Implicação central:** como as RPCs são INVOKER + RLS, o **único** controle de acesso de Relatórios hoje é o guard de layout. Converter o layout para `relatorios.view` é suficiente; as RPCs não mudam. Um usuário que ganhe `relatorios.view` rodará as RPCs sob seu próprio RLS (escopo por unidade preservado).

### 1.4 Capacidade de EXPORT

`export-button.tsx:14,46,59` → `exportToExcel`/`exportToPDF` de `@/lib/utils/export` (**SheetJS + jsPDF, 100% client-side**) operando sobre `rows` já buscadas pelas RPCs. **Não há superfície server-side de export.** A ação `export` do catálogo não tem gate para converter — ver Gate (iv).

### 1.5 RLS de tabelas próprias

`relatorios` não tem tabela própria; agrega `events`/`maintenance_tickets`/`checklists` via RPCs INVOKER. RLS dessas tabelas pertence aos módulos de origem.

---

## 2) Mapa Superfície → Módulo

| Superfície | Arquivo:linha | Módulo | Ação proposta |
|---|---|---|---|
| Guard rota `/dashboard` | `dashboard/layout.tsx:14` | `dashboard` | **view** |
| Hooks de dados do dashboard | `use-dashboard.ts` (queries diretas) | `dashboard` | (sem gate SQL — RLS) |
| Guard rota `/relatorios` | `relatorios/layout.tsx:14` | `relatorios` | **view** |
| 13 RPCs `report_*` | `use-reports.ts:40-330` | `relatorios` | (sem gate SQL — INVOKER+RLS; não converter) |
| Botão "Exportar" (Excel/PDF) | `export-button.tsx` | `relatorios` | **export** (client-side → D3/D2-hold; sem gate server) |
| Botão "Nova pré-reserva" no calendário | `dashboard/page.tsx:333` | (pré-reservas/ADMIN) | fora de escopo — D3 |

> `dashboard → 'dashboard'`; `relatorios → 'relatorios'` (**NÃO** `bi`).

---

## 3) Classificação

| Item | Classificação | Justificativa |
|---|---|---|
| Guard `/dashboard` | **Conversível** | Troca 1 linha por `requirePermissionServer('dashboard','view')`. |
| Guard `/relatorios` | **Conversível** | Troca 1 linha por `requirePermissionServer('relatorios','view')`. |
| 13 RPCs `report_*` | **Estrutural / não-converter** | INVOKER sem guarda; segurança vem do RLS. Adicionar `check_permission_or_raise` seria mudança de comportamento (novo gate), não conversão de guarda existente. |
| Hooks de tabela do dashboard | **Estrutural** | RLS já governa. |
| `export` em Relatórios | **D3 (cosmético) ou D2-hold** | Sem superfície server-side. Decisão no Gate (iv). |
| `canManagePreReservas` (dashboard) | **D3 / fora de escopo** | Gate de pré-reservas (ADMIN), não do módulo `dashboard`. |

---

## 4) Divergência por módulo (ANTES vs DEPOIS)

### 4.1 `dashboard`

| Cargo | ANTES (role-based, guard `DASHBOARD_ACCESS_ROLES`) | DEPOIS (`dashboard.view`) | Observação |
|---|---|---|---|
| super_admin | ✅ | ✅ (bypass) | grant cosmético |
| diretor | ✅ | ✅ **se tiver grant** | precisa backfill |
| gerente | ✅ | ✅ **se tiver grant** | precisa backfill |
| financeiro | ✅ | ✅ **se tiver grant** | precisa backfill |
| manutencao | ✅ | ✅ **se tiver grant** | precisa backfill |
| vendedora | ✅ | ✅ **se tiver grant** | precisa backfill |
| pos_vendas | ✅ | ✅ **se tiver grant** | precisa backfill |
| decoracao | ✅ | ✅ **se tiver grant** | precisa backfill |
| rh | ✅ | ✅ **se tiver grant** | precisa backfill |
| freelancer / entregador | 🚫 | 🚫 | inalterado |

> 🔴 **RISCO DE LOCKOUT DA LANDING PAGE.** São 9 cargos. Sem backfill completo dos usuários ativos desses cargos (exceto super_admin, que bypassa), qualquer um sem `dashboard.view` é jogado para `/403` **na tela inicial pós-login**. Backfill obrigatório e abrangente ANTES de converter o guard.

### 4.2 `relatorios`

| Cargo | ANTES (guard `BI_ACCESS_ROLES`) | DEPOIS (`relatorios.view`) | Observação |
|---|---|---|---|
| super_admin | ✅ | ✅ (bypass) | cosmético |
| diretor | ✅ | ✅ **se tiver grant** | template já concede; backfill confirma |
| gerente | 🚫 (guard bloqueia hoje) | ⚠️ **ACORDA se honrar override** | template NÃO concede; só o indivíduo com override |
| financeiro | 🚫 (guard bloqueia hoje) | ⚠️ **ACORDA se honrar override** | template NÃO concede; só o indivíduo com override |
| demais | 🚫 | 🚫 | inalterado |

> ⚠️ **DECISÃO DE INTENÇÃO, não bug óbvio.** Hoje o guard por cargo bloqueia ger/fin, mas existem overrides individuais dormentes (`relatorios.view` para gerente; `relatorios.view`+`export` para financeiro). Ao converter:
> - **Honrar** os overrides → **apenas os usuários específicos** que os têm passam a ver Relatórios (não toda a classe ger/fin, porque o template não os concede).
> - **Limpar** os overrides → mantém sa+diretor.
> - **Expandir** (adicionar ger/fin ao template) → **todos** os ger/fin ganham Relatórios — mudança de produto.
>
> Hipótese: comentário stale ("gerente e financeiro") + overrides concordam → a intenção original pode ter sido dar Relatórios a ger/fin. Mas isso é **chamada do dono** (Gate iii).

---

## 5) Catálogo + Backfill (Passo 1 / Aprendizado 1)

### 5.1 Catálogo — confirmado (LOCAL)

- `modules`: `dashboard` ✅ e `relatorios` ✅ existem.
- `permission_controls`: ambos têm as **5 ações** (`view, create, edit, delete, export`).

### 5.2 Template (`role_permissions`) — granted (LOCAL)

**`dashboard.view`** concedido a **9 cargos** — bate **exatamente** com `DASHBOARD_ACCESS_ROLES`:
`super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao, rh`.
(Extras cosméticos: `super_admin` tem as 5 ações; `vendedora` tem `create` — sem superfície de create no dashboard, inócuo.)

**`relatorios.view`** concedido a **2 cargos**: `super_admin, diretor` — bate com `BI_ACCESS_ROLES`.
(Extra: `super_admin` tem as 5 ações. **Não** concede `view`/`export` a gerente/financeiro.)

→ Template **já está alinhado** com os guards atuais em ambos os módulos. O backfill é só popular `user_permissions` dos usuários existentes; nenhuma alteração de template é necessária para uma conversão "fiel ao atual".

### 5.3 Auditoria local de gaps

- **`dashboard.view`**: **9/9** usuários ativos dos 9 cargos SEM grant (1 por cargo no seed local). Descontando super_admin (bypass) → **8 gaps reais** localmente. Em produção será proporcional ao nº de usuários ativos → backfill grande.
- **`relatorios.view`**: só `super_admin` sem grant (cosmético). `diretor` coberto (seed tem override). → **0 gaps reais** localmente.

### 5.4 Overrides locais (seed de usuários de teste)

| Módulo | Override | Cargo | Nota |
|---|---|---|---|
| relatorios | view + export | diretor (`teste.diretor`) | `export` além do template (só super_admin tem) |
| relatorios | view + export | financeiro (`teste.financeiro`) | os dois dormentes conhecidos |
| relatorios | view | gerente (`teste.gerente`) | dormente conhecido |
| dashboard | — | — | **zero overrides** |

### 5.5 Queries de PRODUÇÃO prontas (GATE — não executadas)

```sql
-- (A) Gap dashboard.view: usuários ativos dos 9 cargos SEM grant (exclui super_admin — bypassa)
SELECT u.role, count(*) AS sem_grant
FROM users u
WHERE u.is_active
  AND u.role IN ('diretor','gerente','financeiro','manutencao','vendedora','pos_vendas','decoracao','rh')
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id=u.id AND up.module='dashboard' AND up.action='view'
      AND up.granted AND up.unit_id IS NULL)
GROUP BY u.role ORDER BY u.role;

-- (B) Gap relatorios.view: sa+diretor ativos SEM grant
SELECT u.role, count(*) AS sem_grant
FROM users u
WHERE u.is_active AND u.role IN ('diretor')
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id=u.id AND up.module='relatorios' AND up.action='view'
      AND up.granted AND up.unit_id IS NULL)
GROUP BY u.role;

-- (C) Overrides dormentes em relatorios (todos os usuários reais com grant em relatorios)
SELECT u.email, u.role, up.action, up.granted, up.unit_id
FROM user_permissions up JOIN users u ON u.id=up.user_id
WHERE up.module='relatorios' AND u.role NOT IN ('super_admin','diretor')
ORDER BY u.role, u.email, up.action;

-- (D) Overrides em dashboard (esperado vazio)
SELECT u.email, u.role, up.action, up.granted, up.unit_id
FROM user_permissions up JOIN users u ON u.id=up.user_id
WHERE up.module='dashboard'
ORDER BY u.role, u.email, up.action;

-- (E) Template em produção (sanity — deve bater com §5.2)
SELECT module_code, action, string_agg(role_code, ',' ORDER BY role_code) AS roles
FROM role_permissions
WHERE module_code IN ('dashboard','relatorios') AND granted
GROUP BY module_code, action ORDER BY module_code, action;
```

> **Backfill obrigatório antecipado** (a confirmar na FASE B com os números de prod):
> - `dashboard.view` para todos os usuários ativos dos 8 cargos não-super_admin que não o tenham (ON CONFLICT DO NOTHING). **Alto volume.**
> - `relatorios.view` para diretores ativos sem grant (provável no-op, como foi no BI).

---

## 6) Overrides escondidos (Passo 2 / Aprendizado 8)

- **`dashboard`**: nenhum override local; query (D) de produção deve confirmar vazio. Caso apareça `granted=false` para algum usuário de cargo elegível, isso seria um *negative override* que provocaria lockout pós-conversão — tratar caso a caso.
- **`relatorios`**: os 3 dormentes conhecidos (financeiro `view`+`export`, gerente `view`) — confirmados no seed local; query (C) lista os reais de produção. Possíveis adicionais (ex.: `export` para diretor, ou qualquer cargo extra) sairão na query (C). **Nenhum** tem efeito hoje porque o guard por cargo bloqueia a rota antes.

---

## 7) GATES PARA O DONO (decisões binárias — não decididas aqui)

**(i) Ratificar `dashboard` → `dashboard.view`?**
Converter o guard de `/dashboard` para `requirePermissionServer('dashboard','view')`, **precedido de backfill dos 8 cargos não-super_admin** (landing page — lockout em massa se faltar). Template já alinhado.
→ **Sim / Não.**

**(ii) Ratificar `relatorios` → `relatorios.view` (módulo PRÓPRIO, não `bi`)?**
Converter o guard de `/relatorios` para `requirePermissionServer('relatorios','view')`. As 13 RPCs INVOKER ficam intactas (RLS).
→ **Sim / Não.**

**(iii) DECISÃO CENTRAL — overrides dormentes de `relatorios` (financeiro view+export, gerente view):**
- **(a) Honrar** → só os indivíduos com override passam a ver Relatórios (template não muda).
- **(b) Limpar** → remover overrides, manter sa+diretor.
- **(c) Expandir** → adicionar gerente+financeiro ao template `relatorios.view` (todos da classe ganham). Mudança de produto.
→ **a / b / c.**

**(iv) Ação `export` em Relatórios:**
Export é 100% client-side (sem gate server). Opções:
- **(a) D3/cosmético** — manter export sempre visível para quem acessa a página (status quo); ação `export` do catálogo fica decorativa.
- **(b) D2-hold** — futuramente esconder o botão por `export` no client (display-only), sem gate server.
→ **a / b.**

**(v) Autorizar auditoria de PRODUÇÃO + confirmar backfill obrigatório antes da FASE B?**
Rodar as queries (A)–(E) da §5.5 em produção (read-only) e confirmar o backfill de `dashboard.view` (volume grande) + `relatorios.view` (diretores).
→ **Sim / Não.**

---

## Anexo — comandos read-only usados (LOCAL, `cacholaos-db`)

```sql
-- guardas das 13 report_*
SELECT p.proname, CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
  position('check_permission' in pg_get_functiondef(p.oid))>0,
  position('role IN' in pg_get_functiondef(p.oid))>0,
  position('can_view_festa' in pg_get_functiondef(p.oid))>0
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'report\_%' ORDER BY 1;

-- catálogo + template + overrides + gaps: ver §5
```
