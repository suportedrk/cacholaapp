# FASE A — Levantamento Decoração (RBAC Fase 3)

**Data:** 2026-05-30
**Branch:** develop (commit base 419e84f)
**Natureza:** RETRATO de estado. O módulo Decoração está em **DESENVOLVIMENTO ATIVO**
pelo dono (Fase 2 — estoque/fornecedores/itens/transferências). Cada superfície abaixo
está marcada **[ESTÁVEL]** ou **[EM DEV]**. Re-scan de delta obrigatório antes da FASE B.

> ⚠️ Read-only. Nenhuma conversão, migration, guard ou build alterado nesta fase.

---

## DECISÃO DE PRODUTO JÁ FECHADA (registro)

A equipe de decoração definiu (e-mail 27/mai/2026) que **Balões e itens de decoração são
UMA categoria só** — "Balões" fica DENTRO de "Itens", com subcategorias tipo pastas
(balões, boleiras, mobiliário, displays, etc.).

**Implicação RBAC:** Decoração é **UM módulo de permissão** (`'decoracao'`). As subcategorias
são organização de **DADOS**, não públicos de acesso distintos. **NÃO há split estilo BI**
(broad/narrow). Um único `check_permission(uid, 'decoracao', action)` governa todo o módulo.

---

## ACHADO CENTRAL — Decoração já NASCEU no molde de ouro na camada de dados

Diferente de todos os módulos anteriores da Fase 3 (que tinham RLS/guards legados por cargo),
**Decoração foi construída desde a migration 097 com a RLS já em `check_permission`**:

| Camada | Estado | Evidência |
|--------|--------|-----------|
| **RLS das 13 tabelas** | ✅ JÁ é `check_permission('decoracao', view/create/edit/delete)` | migrations 097-106 |
| **Funções SQL (5 RPCs + triggers)** | ✅ TODAS `SECURITY INVOKER` — sem `role IN`, governadas por RLS | 100, 105, 106 |
| **Template `role_permissions`** | ✅ JÁ populado (097, linhas 168-179) | sa/diretor=4 ações; gerente/decoracao=view+create+edit |
| **Backfill `user_permissions`** | ✅ JÁ feito p/ usuários existentes (097, linhas 194-208) | mesmo shape |
| **Guards de rota (3 layouts)** | ❌ ainda `requireRoleServer(DECORACAO_MANAGE_ROLES)` | CONVERTER na FASE B |
| **Guards de API (18 routes)** | ❌ ainda `requireRoleApi(DECORACAO_MANAGE_ROLES / DECORACAO_DELETE_ROLES)` | CONVERTER na FASE B |
| **6 hasRole `canDelete` (UI)** | display, espelha `DECORACAO_DELETE_ROLES` | D3 — opcional |

**Consequência:** a FASE B de Decoração é a mais LEVE de toda a Fase 3 — um *swap mecânico* da
camada de guards de rota/API (role → permission). A parte difícil (RLS golden + backfill +
funções INVOKER) **já está pronta e já vigora**. A conversão dos guards apenas *alinha* a porta
da frente (route/API) com o que a RLS já enforce no banco.

---

## 1. INVENTÁRIO (arquivo:linha)

### 1.1 Layouts (3) — todos `DECORACAO_MANAGE_ROLES`

| Arquivo | Linha | Guard | Estado |
|---------|-------|-------|--------|
| `src/app/(auth)/decoracao/layout.tsx` | 13 | `requireRoleServer(DECORACAO_MANAGE_ROLES)` | **[ESTÁVEL]** |
| `src/app/(auth)/decoracao/estoque/layout.tsx` | 5 | `requireRoleServer(DECORACAO_MANAGE_ROLES)` | **[EM DEV]** (Fase 2 estoque) |
| `src/app/(auth)/decoracao/transferencias/layout.tsx` | 9 | `requireRoleServer(DECORACAO_MANAGE_ROLES)` | **[EM DEV]** (Fase 2 transf.) |

Os subdiretórios `baloes/`, `forminhas/`, `temas/`, `ordens/`, `itens/`, `fornecedores/`,
`locais/` **não têm layout próprio** — herdam o guard do `decoracao/layout.tsx` raiz.

### 1.2 API routes (18) — `requireRoleApi`, sem GET

**Não existe nenhum handler GET no módulo.** Todas as leituras (a superfície `view`) acontecem
via Supabase client direto, protegidas pela RLS `check_permission('decoracao','view')`. As 18
rotas são **mutações** apenas:

| Route | Métodos | Guard MANAGE | Guard DELETE | Estado |
|-------|---------|--------------|--------------|--------|
| `temas/route.ts` | POST | ✅ L20 | — | [ESTÁVEL] |
| `temas/[id]/route.ts` | PATCH, DELETE | ✅ L23 | ✅ L95 | [ESTÁVEL] |
| `forminhas/route.ts` | POST | ✅ L11 | — | [ESTÁVEL] |
| `forminhas/[id]/route.ts` | PATCH | ✅ L14 | — | [ESTÁVEL] |
| `baloes/route.ts` | POST | ✅ L19 | — | [ESTÁVEL] |
| `baloes/[id]/route.ts` | PATCH, DELETE | ✅ L22 | ✅ L74 | [ESTÁVEL] |
| `ordens/route.ts` | POST | ✅ L20 | — | [ESTÁVEL] |
| `ordens/[id]/route.ts` | PATCH, DELETE | ✅ L23 | ✅ L74 | [ESTÁVEL] |
| `fornecedores/route.ts` | POST | ✅ L9 | — | **[EM DEV]** |
| `fornecedores/[id]/route.ts` | PATCH, DELETE | ✅ L12 | ✅ L53 | **[EM DEV]** |
| `locais/route.ts` | POST | ✅ L9 | — | **[EM DEV]** |
| `locais/[id]/route.ts` | PATCH, DELETE | ✅ L12 | ✅ L54 | **[EM DEV]** |
| `itens/route.ts` | POST | ✅ L19 | — | **[EM DEV]** |
| `itens/[id]/route.ts` | PATCH, DELETE | ✅ L23 | ✅ L70 | **[EM DEV]** |
| `estoque/route.ts` | PUT | ✅ L14 | — | **[EM DEV]** |
| `transferencias/route.ts` | POST | ✅ L14 | — | **[EM DEV]** |
| `transferencias/[id]/cancelar/route.ts` | POST | ✅ L15 | — | **[EM DEV]** |
| `transferencias/[id]/receber/route.ts` | POST | ✅ L15 | — | **[EM DEV]** |

Padrão uniforme: POST/PUT/PATCH → `requireRoleApi(DECORACAO_MANAGE_ROLES)`;
DELETE → `requireRoleApi(DECORACAO_DELETE_ROLES)`.

### 1.3 Condicionais de UI por cargo (6 hasRole — estimativa dizia ~7)

Todas idênticas: `const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)`.
Gateiam **apenas a exibição** do botão "Excluir permanentemente". O enforcement real está
no guard DELETE da API + na RLS `delete`.

| Arquivo | Linha | O que gateia | Estado |
|---------|-------|--------------|--------|
| `_components/tema-edit-sheet.tsx` | 69 | botão excluir tema | [ESTÁVEL] |
| `_components/balao-edit-sheet.tsx` | 74 | botão excluir balão | [ESTÁVEL] |
| `_components/os-editor.tsx` | 93 | botão excluir OS | [ESTÁVEL] |
| `_components/fornecedor-edit-sheet.tsx` | 35 | botão excluir fornecedor | **[EM DEV]** |
| `_components/item-editor.tsx` | 70 | botão excluir item | **[EM DEV]** |
| `_components/local-edit-sheet.tsx` | 31 | botão excluir local | **[EM DEV]** |

Não há `isManager`, `canApprove` ou outras condicionais de cargo nos componentes de decoração.

### 1.4 nav-items / sidebar

`src/components/layout/nav-items.ts:146-156` — 1 item pai "Decoração" + 9 filhos, todos
`module: 'decoracao'`, `allowedRoles: [...DECORACAO_MANAGE_ROLES]`. Filtro de **exibição** da
sidebar (D3-display); o controle real é o guard de layout.

### 1.5 Funções SQL — TODAS SECURITY INVOKER

| Função | Migration | Segurança | Guard interno |
|--------|-----------|-----------|---------------|
| `create_decoracao_os_with_items` | 100 | INVOKER | nenhum — RLS aplica |
| `update_decoracao_os_with_items` | 100 | INVOKER | nenhum — RLS aplica |
| `criar_transferencia` | 106 | INVOKER | nenhum — RLS aplica |
| `receber_transferencia` | 106 | INVOKER | nenhum — RLS aplica |
| `cancelar_transferencia` | 106 | INVOKER | nenhum — RLS aplica |
| `trg_*_updated_at` (3 triggers) | 105, 106 | trigger | n/a |

Nenhuma função SQL tem `role IN` ou `check_permission` embutido — todas confiam na RLS.
**Zero funções a converter na FASE B** (idêntico ao caso Relatórios/INVOKER).

### 1.6 RLS das tabelas (13) — padrão GLOBAL por permissão

13 tabelas: `decoracao_temas`, `decoracao_tema_forminhas`, `decoracao_forminha_cores`,
`decoracao_balao_modelos`, `decoracao_os`, `decoracao_os_itens`, `decoracao_fornecedores`,
`decoracao_locais`, `decoracao_itens`, `decoracao_item_variacoes`, `decoracao_estoque_saldo`,
`decoracao_transferencias`, `decoracao_transferencia_itens`.

Padrão de RLS (confirmado em 097-106):
```sql
-- SELECT
USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'))
-- INSERT
WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'))
-- UPDATE
USING (check_permission(auth.uid(), 'decoracao', 'edit')) WITH CHECK (... 'edit')
-- DELETE
USING (check_permission(auth.uid(), 'decoracao', 'delete'))
```

**Módulo GLOBAL** — a maioria das tabelas (catálogos: temas, forminhas, balões, fornecedores,
locais, itens, estoque) não tem `unit_id` e a RLS é puramente `check_permission`.
**Exceção `decoracao_os` / `decoracao_os_itens`:** carregam `unit_id` e a RLS **filtra acesso por
unidade** — `is_global_viewer() OR unit_id = ANY(get_user_unit_ids())` **junto** com
`check_permission('decoracao', action)`. Ou seja: ordens de serviço SÃO unit-scoped no acesso a
linha (um gerente só vê OS da sua unidade), além de exigir a permissão de módulo. Isso é
**escopo de unidade na RLS**, não um split de público de acesso por cargo — e é ortogonal à
conversão dos guards (o filtro de unidade permanece na RLS independentemente do swap). O módulo
continua sendo **um único `'decoracao'`** para fins de permissão; balões⊂itens são dados.

---

## 2. MAPA SUPERFÍCIE → MÓDULO (tudo → `'decoracao'`)

| Superfície | arquivo:linha | Estado | Ação proposta |
|------------|---------------|--------|---------------|
| Layout raiz | `decoracao/layout.tsx:13` | [ESTÁVEL] | `view` |
| Layout estoque | `decoracao/estoque/layout.tsx:5` | [EM DEV] | `view` |
| Layout transferências | `decoracao/transferencias/layout.tsx:9` | [EM DEV] | `view` |
| POST temas/forminhas/baloes/ordens | `api/.../route.ts` | [ESTÁVEL] | `create` |
| POST fornecedores/locais/itens/transferências | `api/.../route.ts` | [EM DEV] | `create` |
| PATCH temas/forminhas/baloes/ordens | `api/.../[id]/route.ts` | [ESTÁVEL] | `edit` |
| PATCH fornecedores/locais/itens | `api/.../[id]/route.ts` | [EM DEV] | `edit` |
| PUT estoque | `api/estoque/route.ts:14` | [EM DEV] | `edit` |
| POST cancelar/receber transferência | `api/transferencias/[id]/*` | [EM DEV] | `edit` |
| DELETE temas/baloes/ordens | `api/.../[id]/route.ts` | [ESTÁVEL] | `delete` |
| DELETE fornecedores/locais/itens | `api/.../[id]/route.ts` | [EM DEV] | `delete` |
| 6 hasRole `canDelete` (UI) | `_components/*-edit-*.tsx` | misto | **converter** → `delete` (não D3) |
| RLS 13 tabelas | migrations 097-106 | ✅ JÁ CONVERTIDO | — |
| 5 RPCs INVOKER | migrations 100/106 | ✅ JÁ GOVERNADAS POR RLS | — |

---

## 3. CLASSIFICAÇÃO

### Conversível (swap direto role → permission)
- **3 layouts** → `requirePermissionServer('decoracao', 'view')`
- **18 API guards** → `requirePermissionApi('decoracao', <create|edit|delete>)` conforme método:
  - POST → `create`; PATCH/PUT/cancelar/receber → `edit`; DELETE → `delete`

### Estrutural — NADA
Não há tabela estrutural própria de decoração (units/role_permissions/etc.).

### D2-hold — NADA
Nenhuma sub-rota de gerência que expandiria público ao mapear para `'edit'`. O par
MANAGE/DELETE já é granular (create/edit vs delete), e o backfill 097 já distribuiu
exatamente esses grants. Sem risco de expansão silenciosa.

### Convertíveis na UI (NÃO são D3 genuíno)
- **6 hasRole `canDelete`** — display do botão "Excluir", mas são **espelho de uma ação de
  permissão** (`decoracao.delete`), não decisão "por cargo per se" (como `isVendedora`/`isManager`).
  Por isso são **CONVERTÍVEIS**, não D3-display. Manter `hasRole(DECORACAO_DELETE_ROLES)` hardcoded
  **derrota o toggle** que a Fase 3 existe para criar:
  - Dono liga `decoracao.delete` para gerente em /admin/cargos → API (`check_permission`) e RLS
    **permitem**, mas a UI **nunca mostra** o botão ao gerente (role check hardcoded = false).
    Toggle meio-morto.
  - Dono desliga `decoracao.delete` para diretor → API/RLS **bloqueiam**, mas a UI **ainda
    mostra** o botão → clique → 403 confuso.

  "Display continua correto porque o backfill espelha a constante" só vale no *snapshot inicial*.
  No instante em que o toggle é usado — a razão da conversão — a UI diverge da permissão real.
- **nav-items `allowedRoles`** — esse SIM é D3-display da sidebar (filtro de exibição que espelha
  o guard de rota); aceitável manter, pois o guard de layout é o enforcement.

**Conclusão da classificação:** Conversível na camada de guards (3 layouts + 18 APIs) **e** na UI
(6 `canDelete`). Zero D2-hold, zero Estrutural, zero SQL a converter. O único D3-display legítimo
é o `allowedRoles` da sidebar.

---

## 4. DIVERGÊNCIA (ANTES → DEPOIS)

**ANTES** (guard de rota/API): `DECORACAO_MANAGE_ROLES` = `super_admin, diretor, gerente, decoracao`
(+ `DECORACAO_DELETE_ROLES` = `super_admin, diretor` para DELETE).

**DEPOIS** (quem terá `decoracao.view` etc.): exatamente quem o backfill 097 já gravou:

| Cargo | view | create | edit | delete | Acesso à rota DEPOIS | Δ vs ANTES |
|-------|:----:|:------:|:----:|:------:|----------------------|-----------|
| super_admin | (bypass) | (bypass) | (bypass) | (bypass) | ✅ | = |
| diretor | ✅ | ✅ | ✅ | ✅ | ✅ | = |
| gerente | ✅ | ✅ | ✅ | ❌ | ✅ | = (mantém) |
| decoracao | ✅ | ✅ | ✅ | ❌ | ✅ | = |
| demais cargos | ❌ | ❌ | ❌ | ❌ | 🚫/403 | = |

**Se o backfill 097 vigora em produção, a conversão é 100% INVISÍVEL.** O grant já espelha
o role list atual em todas as 4 ações.

### ⚠️ Pergunta a destacar (gate ii): o gerente deve manter Decoração?

O `gerente` está hoje em `DECORACAO_MANAGE_ROLES` e o backfill 097 já lhe deu
`decoracao.view/create/edit`. Manter é o caminho INVISÍVEL. **Mas é decisão de produto:**
se o dono quiser que Decoração seja exclusiva de `super_admin + diretor + decoracao` (tirar
gerente), isso é uma **mudança de comportamento** (gerente perde acesso) e exige revogar os
grants do gerente — não é mera conversão. Precisa de decisão explícita ANTES da FASE B.

---

## 5. CATÁLOGO + BACKFILL (Aprendizado 1) — estado LOCAL

### Catálogo
- `'decoracao'` no type `Module` (`src/types/permissions.ts:11,31`) ✅
- `modules` (071, linha 158): `('decoracao', 'Decoração', ..., 60, true)` ✅
- `permission_controls` (107): as 5 ações canônicas (`view/create/edit/delete/export`) são
  geradas via CROSS JOIN sobre `modules` → `'decoracao'` tem as 5 linhas ✅
  (nota: `export` existe no catálogo mas o módulo não tem superfície de export — decorativo)

### Template `role_permissions` (fonte real) — JÁ POPULADO (097)
- `super_admin, diretor` → view/create/edit/**delete**
- `gerente, decoracao` → view/create/edit (sem delete)

### Backfill `user_permissions` — JÁ FEITO (097) para usuários existentes na época
- Mesmo shape acima, `unit_id = NULL` (módulo global)

### Gaps locais
- **Nenhum gap esperado** se a 097 rodou. Usuários criados APÓS a 097 recebem os grants via
  `apply-template` no convite. **Risco:** usuários `decoracao`/`gerente` criados entre a 097 e
  hoje por fluxo que não chama apply-template → confirmar na auditoria de produção.

### Queries de PRODUÇÃO prontas (gate — rodar na auditoria, não agora)

```sql
-- (A) Backfill: todo usuário cujo role está no guard atual tem decoracao.view?
SELECT u.id, u.email, u.role
FROM public.users u
WHERE u.is_active = true
  AND u.role IN ('diretor','gerente','decoracao')   -- super_admin bypassa
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = u.id AND up.module = 'decoracao' AND up.action = 'view'
  );
-- Esperado: 0 linhas. Qualquer linha = gap → backfill aditivo obrigatório antes da FASE B.

-- (B) As migrations 097-106 vigoram em produção? (checagem de existência da tabela-âncora)
SELECT to_regclass('public.decoracao_temas')       AS temas,
       to_regclass('public.decoracao_itens')        AS itens,
       to_regclass('public.decoracao_transferencias') AS transf;
-- Se algum NULL: o módulo ainda NÃO foi deployado em produção → FASE B bloqueada por timing.
```

---

## 6. OVERRIDES ESCONDIDOS (Aprendizado 8)

Usuários com grant individual em `user_permissions` para `decoracao` cujo **cargo está FORA**
do guard atual (`super_admin, diretor, gerente, decoracao`). Esses grants dormem sob o guard de
cargo; a conversão os acordaria.

```sql
-- (C) Overrides dormentes: grant de decoracao para cargo fora do guard
SELECT u.email, u.role, up.action, up.granted
FROM public.user_permissions up
JOIN public.users u ON u.id = up.user_id
WHERE up.module = 'decoracao'
  AND u.role NOT IN ('super_admin','diretor','gerente','decoracao')
ORDER BY u.email, up.action;
-- Local: rodar contra Docker (surfaceia só @cachola.local).
-- PRODUÇÃO: rodar via SSH na auditoria — surfaceia contas reais. Decidir honrar/limpar
-- POR QUEM detém (Aprendizado 8) antes da FASE B.
```

Local não pôde ser consultado nesta sessão (Docker indisponível — ver memória
`feedback_docker_resource_exhaustion`). A query fica pronta para a auditoria.

---

## 7. GATES PARA O DONO (decisões binárias — NÃO decidir sozinho)

| # | Gate | Recomendação técnica |
|---|------|----------------------|
| **(i)** | Ratificar **Decoração = um módulo `'decoracao'`** (sem split estilo BI; subcategorias são dados). | ✅ Ratificar — alinhado à decisão de produto de 27/mai e à RLS já existente. |
| **(ii)** | **Gerente mantém `decoracao.view`?** Está no role list atual; backfill 097 já lhe deu view/create/edit. | Manter = INVISÍVEL. Remover = mudança de comportamento (revogar grants). **Decisão de produto.** |
| **(iii)** | **6 hasRole `canDelete`**: convertê-los para permission-aware na FASE B, ou deixar hardcoded? | **Converter** (são espelho de `decoracao.delete`, não D3 genuíno). Deixar hardcoded derrota o toggle de delete (ver §3 e detalhe abaixo). Custo: ver nota de hook. |
| **(iv)** | **Autorizar auditoria de PRODUÇÃO** (queries A/B/C via SSH) + confirmar **backfill aditivo obrigatório** se a query (A) achar gaps. | Autorizar. A query (B) também confirma se o módulo já está em prod (pré-condição de timing). |
| **(v)** | **TIMING — esperar o dev estabilizar.** Ver abaixo. | **Bloquear FASE B até congelar [EM DEV] + re-scan de delta.** |

### Gate (iii) — detalhe do custo (estado real do hook client)

Não existe hook self-scoped pronto (`usePermission('decoracao','delete')` para o usuário logado).
O que existe é `useUserPermissions(userId)` em `src/hooks/use-permissions.ts:29` — **admin-context**
(recebe um `userId`, usado em `/admin/usuarios/[id]/permissoes` para inspecionar permissões de
OUTRO usuário), retornando um `PermissionMap` (module → action → granted).

**Opções de conversão dos 6 `canDelete`:**
- (b1) Reusar `useUserPermissions(profile?.id)` passando o próprio id e ler `map?.decoracao?.delete`.
  Funciona sem código novo, mas adiciona uma query por edit-sheet (mitigável com `staleTime`).
- (b2) Criar um hook self-scoped enxuto (`usePermission(module, action)`) sobre o profile/permissões
  já hidratados no `AuthProvider`, sem query extra. Fundação RBAC limpa para futuros módulos.

**Recomendação:** converter (não deixar hardcoded). Preferir (b2) se o custo for baixo; (b1) é o
fallback imediato. Decisão de granularidade fica para o dono ratificar no início da FASE B.

### Gate (v) — Recomendação explícita de TIMING

O módulo está em **dev ativo**. As superfícies marcadas **[EM DEV]** (Fase 2:
fornecedores, locais, itens, estoque, transferências — 2 layouts, 10 API routes, 3 hasRole)
**podem mudar de forma** (novas rotas, novos métodos, novos botões) antes de estabilizar.

**Recomendação:**
1. **NÃO iniciar a FASE B agora.** Converter guards de superfícies que ainda mudam gera retrabalho
   e janela de divergência (guard convertido vs guard novo legado).
2. **Pré-condições para desbloquear a FASE B:**
   - (a) Bruno declara a Fase 2 de Decoração **congelada** (sem novas rotas/APIs previstas);
   - (b) decisão de produto fechada sobre balões⊂itens já está OK, mas confirmar que não nascerá
     nova sub-rota com guard próprio;
   - (c) **re-scan de delta** desta FASE A — re-rodar o inventário e comparar: nenhuma nova
     superfície role-based introduzida durante o dev.
3. **Quando desbloquear:** a FASE B será trivial — swap dos 3 layouts + 18 guards de API
   (role → permission), nenhuma migration de RLS, nenhuma função SQL, e (se a query A não achar
   gaps) **conversão invisível**. Possivelmente o PR mais simples de toda a Fase 3.

### Backlog fora-de-RBAC (registrado, não bloqueia)
- `permission_controls` tem `decoracao.export` mas o módulo não exporta nada → toggle decorativo.
- Débito conhecido (CLAUDE.md): órfãos no storage quando a aba fecha com upload pendente —
  não é RBAC, fica no backlog de hardening de storage.

---

## Resumo executivo

Decoração é o módulo **mais barato** da Fase 3 a converter — porque já nasceu correto onde
importa: **RLS, funções SQL (INVOKER) e backfill já estão no molde de ouro `check_permission`
desde a migration 097**. Falta apenas o swap mecânico da camada de guards de rota/API
(3 layouts + 18 routes), e ele é **invisível** se o backfill 097 vigora em produção (a confirmar
na auditoria). O único bloqueio real é **timing**: o módulo está em dev ativo; a FASE B deve
esperar o congelamento da Fase 2 + um re-scan de delta. As decisões pendentes: gerente em
`DECORACAO_MANAGE_ROLES` (gate ii) e a granularidade da conversão dos 6 `canDelete` (gate iii —
**convertê-los**, não deixar hardcoded, sob pena de inutilizar o toggle de delete).
