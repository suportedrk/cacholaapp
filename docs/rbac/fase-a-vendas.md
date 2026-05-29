# FASE A — Levantamento read-only do módulo Vendas

> Documento de diagnóstico. **Nenhuma migration, RLS, RPC, guard ou build alterado.**
> Branch: `develop`. Data: 2026-05-29.
> Referência: `.claude/skills/cachola-rbac-pattern/SKILL.md` (Receita Passos 1-6, D1, Aprendizados 1/5/8)
> + `docs/rbac/proposta-arquitetura-alvo.md`.
> Escopo: `/vendas` (layout raiz) + Meu Painel/Upsell/Recompra + RPCs do módulo.
> **Fora de escopo:** subárvore `/vendas/checklist` (módulo `checklist_comercial`, já convertido).

---

## Achados principais (leia primeiro)

1. **Vendas NÃO foi convertido na Fase 2** — todos os RPCs ainda usam trava antiga `role IN (...)` inline.
2. **Todos os 10 RPCs admitem hoje os MESMOS 5 cargos:** `super_admin, diretor, gerente, vendedora, pos_vendas`. A migration 068 já adicionou `pos_vendas` a todos. → **A premissa do enunciado de que os RPCs "barram pos_vendas" está desatualizada.** O único descasamento real layout↔RPC é o **gerente**.
3. **Mismatch layout↔RPC = só gerente:** layout `/vendas` admite `{super_admin, diretor, vendedora, pos_vendas}` (sem gerente); RPCs admitem os mesmos 4 + **gerente**.
4. **GAP de backfill (Aprendizado 1):** o template `role_permissions` concede `vendas.view` a {super_admin, diretor, vendedora, pos_vendas}, mas `user_permissions` **não tem as linhas** (local: 3 contas de teste com 0 linhas vendas). Como `check_permission` não tem fallback de template (`COALESCE(v_granted, FALSE)`), **a FASE B obriga uma migration de backfill** antes/junto da conversão.
5. **RISCO cross-module:** `get_event_sales_summary` é chamado em `/eventos/[id]` (guard `EVENTOS_ACCESS_ROLES`, que **inclui gerente**) — não em `/vendas`. Converter para `check_permission('vendas','view')` **remove uma capacidade que o gerente tem hoje numa página que ele continua acessando.** É o único RPC cuja perda de gerente NÃO é mascarada pelo layout `/vendas`.

---

## 1) Inventário de superfícies de acesso

### 1.1 Guard de rota (Server Layout)

| # | Superfície | Arquivo:linha | Guard atual |
|---|-----------|---------------|-------------|
| L1 | Raiz `/vendas` | [layout.tsx:13](../../src/app/(auth)/vendas/layout.tsx#L13) | `requireRoleServer(VENDAS_MODULE_ROLES)` → super_admin, diretor, vendedora, pos_vendas (comentário diz "gerente" mas está **desatualizado** — a constante não inclui gerente) |

### 1.2 Condicionais de UI por cargo (componentes)

Concentradas em `meu-painel-client.tsx`. Upsell e Recompra **não têm** condicionais de cargo (dependem dos RPCs).

| # | Superfície | Arquivo:linha | Condicional |
|---|-----------|---------------|-------------|
| U1 | `isManager` | [meu-painel-client.tsx:24](../../src/app/(auth)/vendas/_components/meu-painel/meu-painel-client.tsx#L24) | `hasRole(profile?.role, VENDAS_MANAGE_ROLES)` → super_admin, diretor, gerente |
| U2 | `isVendedora` | [meu-painel-client.tsx:25](../../src/app/(auth)/vendas/_components/meu-painel/meu-painel-client.tsx#L25) | `hasRole(profile?.role, VENDEDORA_ROLES)` → vendedora |
| U3 | `effectiveSellerId` (vendedora vê só o próprio; gestor vê todas) | [meu-painel-client.tsx:34](../../src/app/(auth)/vendas/_components/meu-painel/meu-painel-client.tsx#L34) | deriva de U2 |
| U4 | `SellerSelector` (escolher vendedora) só p/ gestor | [meu-painel-client.tsx:103](../../src/app/(auth)/vendas/_components/meu-painel/meu-painel-client.tsx#L103) | `{isManager && ...}` |
| U5 | `canDrilldown` no ranking só p/ gestor | [meu-painel-client.tsx:127](../../src/app/(auth)/vendas/_components/meu-painel/meu-painel-client.tsx#L127) | `canDrilldown={isManager}` |

> `VENDAS_MANAGE_ROLES` (super_admin, diretor, **gerente**) é usado **apenas em UI** (agregação "ver todas as vendedoras" + drill-down). Não há guard de rota com ele.

### 1.3 API routes

Nenhuma rota `/api/**` dedicada ao módulo Vendas. O único hit (`api/cron/check-alerts`) referencia `/vendas/checklist` apenas como string de link (notificação de task comercial) e é guardado por `CRON_SECRET` — **não é superfície de cargo do módulo Vendas**. Os e-mails diários de Vendas rodam por `scripts/email-vendas-daily.ts` (cron + service_role), fora do app.

### 1.4 Funções SQL do módulo — guard EXATO + cargos admitidos

> Para cada função, a definição vencedora é a da **migration de maior número** que a recria.
> 087 = `087_fase_c_valor_festa_soma_produtos.sql` (o `087_fase_c_rollback.sql` é o companion de rollback, não aplicado).

| # | RPC | Def. vencedora | Guard (transcrição) | Cargos admitidos hoje | Call site (rota) |
|---|-----|----------------|---------------------|------------------------|------------------|
| R1 | `get_vendas_my_kpis` | 087:717 | `IF v_caller_role NOT IN ('super_admin','diretor','gerente','vendedora','pos_vendas') THEN RAISE EXCEPTION 'insufficient_privilege';` | sa, dir, **ger**, vend, pos | `/vendas` (meu-painel) |
| R2 | `get_vendas_daily_revenue` | 087:821 | idem R1 | sa, dir, **ger**, vend, pos | `/vendas` (meu-painel) |
| R3 | `get_vendas_ranking` | 087:891 | `WHERE id=auth.uid() AND role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` … `RAISE EXCEPTION 'insufficient_privilege'` | sa, dir, **ger**, vend, pos | `/vendas` (meu-painel) |
| R4 | `get_upsell_opportunities` | 068:421 | `role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` | sa, dir, **ger**, vend, pos | `/vendas` (upsell) |
| R5 | `get_upsell_count_for_user` | 068:584 | `IF v_role NOT IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` | sa, dir, **ger**, vend, pos | **sidebar** (todo auth) |
| R6 | `get_upsell_popular_addons` | 068:679 | `role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` | sa, dir, **ger**, vend, pos | `/vendas` (upsell hint) |
| R7 | `get_recompra_aniversario_proximo` | 081:55 | `role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` | sa, dir, **ger**, vend, pos | `/vendas` (recompra) |
| R8 | `get_recompra_festa_passada` | 068:955 | `role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` | sa, dir, **ger**, vend, pos | `/vendas` (recompra) |
| R9 | `get_recompra_count_for_user` | 082:40 | `IF v_role NOT IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` | sa, dir, **ger**, vend, pos | **sidebar** (todo auth) |
| R10 | `get_event_sales_summary` | 070:23 | `role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')` … `RAISE EXCEPTION 'Acesso negado' USING ERRCODE='insufficient_privilege'` | sa, dir, **ger**, vend, pos | **`/eventos/[id]`** (EVENTOS_ACCESS_ROLES — inclui gerente) |

> **Não existem RPCs de escrita/log nem de reabertura.** O registro de contato (upsell/recompra) e a reabertura são `INSERT`/`UPDATE` diretos via hooks (`use-upsell.ts`, `use-recompra.ts`), governados por **RLS** (§1.5), não por RPC.

### 1.5 RLS das tabelas próprias do módulo

**`ploomes_contacts`** (061) — espelho Ploomes, sync por service_role:
- SELECT: `EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role IN ('super_admin','diretor','gerente','vendedora'))` — **sem pos_vendas**

**`upsell_contact_log`** (061):
- SELECT: `role IN ('super_admin','diretor','gerente','vendedora')` — **sem pos_vendas**
- INSERT: `contacted_by = auth.uid() AND ( role IN ('super_admin','diretor','gerente') OR EXISTS(user JOIN sellers ON s.id=u.seller_id AND s.id = upsell_contact_log.seller_id) )` — **pos_vendas excluído** (não está nos roles nem tem seller_id)
- UPDATE: `contacted_by = auth.uid() OR role IN ('super_admin','diretor','gerente')`

**`email_sent_log`** (062) — dedup de e-mail (owner-pattern, Aprendizado 6):
- SELECT: `recipient_user_id = auth.uid()`
- INSERT/escrita: somente service_role (sem policy via JWT)

**`recompra_contact_log`** (063 + 119):
- SELECT (final, 119): `contacted_by = auth.uid() OR role IN ('super_admin','diretor')` — **gerente removido em 119; pos_vendas excluído por decisão explícita do dono**
- INSERT (063): `contacted_by = auth.uid() AND role IN ('super_admin','diretor','gerente','vendedora')` — **sem pos_vendas**
- UPDATE (063): `contacted_by = auth.uid()`

> **Latente (não bloqueia):** `ploomes_contacts` e `upsell_contact_log` SELECT excluem pos_vendas, mas os RPCs R4-R8 são `SECURITY DEFINER` e **bypassam RLS** — logo pos_vendas vê os dados via RPC mesmo sem SELECT direto. Funcionalmente OK hoje porque toda leitura passa pelos RPCs. Inconsistência a registrar, sem impacto na conversão.

---

## 2) Classificação

| Superfície | Arquivo:linha | Categoria | Justificativa |
|-----------|---------------|-----------|---------------|
| L1 layout `/vendas` | layout.tsx:13 | **Conversível** | → `requirePermissionServer('vendas','view')`. Template `view` = exatamente os 4 de VENDAS_MODULE_ROLES; sem expansão (condicionado ao backfill §4 e auditoria de prod §5). |
| U1 `isManager` (VENDAS_MANAGE_ROLES) | meu-painel:24 | **D3** | Agregação de gestor "ver todas as vendedoras" + drill-down — lógica por cargo per se, não vira toggle. |
| U2 `isVendedora` | meu-painel:25 | **D3** | Identidade de cargo (força próprio seller_id). Não vira toggle. |
| U3 `effectiveSellerId` | meu-painel:34 | **D3** | Deriva de U2 (regra de negócio). |
| U4 `SellerSelector` (gestor) | meu-painel:103 | **D3** | UI condicional a U1. |
| U5 `canDrilldown` (gestor) | meu-painel:127 | **D3** | UI condicional a U1. |
| R1 `get_vendas_my_kpis` | 087:717 | **Conversível (D1)** | → `check_permission_or_raise('vendas','view')`. gerente perde (mascarado pelo layout /vendas). |
| R2 `get_vendas_daily_revenue` | 087:821 | **Conversível (D1)** | idem R1. |
| R3 `get_vendas_ranking` | 087:891 | **Conversível (D1)** | idem R1. |
| R4 `get_upsell_opportunities` | 068:421 | **Conversível (D1)** | idem R1. |
| R5 `get_upsell_count_for_user` | 068:584 | **Conversível (D1)** | Call site sidebar; gerente perde mas é **cosmético** (badge → /vendas que ele não acessa). |
| R6 `get_upsell_popular_addons` | 068:679 | **Conversível (D1)** | idem R1. |
| R7 `get_recompra_aniversario_proximo` | 081:55 | **Conversível (D1)** | idem R1. |
| R8 `get_recompra_festa_passada` | 068:955 | **Conversível (D1)** | idem R1. |
| R9 `get_recompra_count_for_user` | 082:40 | **Conversível (D1)** | Call site sidebar; gerente perde **cosmético** (badge). |
| R10 `get_event_sales_summary` | 070:23 | **Conversível (D1) — com RISCO** | Call site `/eventos/[id]` (gerente ACESSA). Converter remove capacidade **viva** do gerente → escalar como gate próprio (G-RISK). |
| upsell_contact_log INSERT/UPDATE | 061:107/126 | **D2-hold** | Escrita/log; mapear p/ `'create'`/`'edit'` **habilitaria pos_vendas a registrar contato** (hoje bloqueado). Manter trava de cargo. |
| recompra_contact_log INSERT/UPDATE | 063:89/100 | **D2-hold** | idem upsell; SELECT já endurecido em 119 (sa+dir). |
| ploomes_contacts SELECT | 061:48 | **Estrutural** | Espelho Ploomes (service_role sync); leitura real via RPCs SECURITY DEFINER. |
| email_sent_log | 062:42 | **Estrutural** | Owner-pattern (Aprendizado 6); escrita service_role. Toggle decorativo. |
| recompra_contact_log SELECT | 119:43 | **D3 / Estrutural** | Fiscalização restrita a sa+dir por decisão explícita do dono (119); pos_vendas excluído de propósito. |

---

## 3) Divergência por RPC (ANTES/DEPOIS por cargo)

Convenção: **ANTES** = pode chamar hoje (lista `role IN` extraída). **DEPOIS** = teria `vendas.view` (template `role_permissions` + backfill). super_admin = bypass.

`vendas.view` granted no template a: **super_admin, diretor, vendedora, pos_vendas** (NÃO gerente).

Para os **10 RPCs**, o quadro ANTES/DEPOIS é idêntico por cargo (todos admitem hoje os mesmos 5):

| Cargo | ANTES (role IN) | DEPOIS (vendas.view) | Δ | Efeito |
|-------|-----------------|----------------------|---|--------|
| super_admin | ✅ | ✅ (bypass) | = | nenhum |
| diretor | ✅ | ✅ (view granted) | = | nenhum |
| vendedora | ✅ | ✅ (view granted) | = | nenhum |
| pos_vendas | ✅ (desde 068) | ✅ (view granted) | = | **nenhum** — reconcilia a premissa do enunciado: pos_vendas **já tem** acesso aos RPCs; não "ganha" nada |
| gerente | ✅ | 🚫 (sem view) | **PERDE** | **efeito desejado da D1** — porém o impacto varia por call site (abaixo) |

**O Δ do gerente é o único; seu impacto depende do call site:**

| RPC | Call site | gerente alcança o call site hoje? | Impacto da perda |
|-----|-----------|-----------------------------------|-------------------|
| R1, R2, R3, R4, R6, R7, R8 | `/vendas` | ❌ (layout VENDAS_MODULE_ROLES barra gerente) | **net-zero via UI** — desejado |
| R5, R9 (counts) | sidebar (todo auth) | ⚠️ sim (sidebar renderiza p/ todos) | **cosmético** — badge de Vendas que aponta p/ rota inacessível ao gerente |
| **R10 `get_event_sales_summary`** | **`/eventos/[id]`** (EVENTOS_ACCESS_ROLES **inclui gerente**) | ✅ **sim** | **🔴 RISCO — perda de capacidade VIVA**: hoje o gerente abre o detalhe do evento e vê a seção de Vendas (`EventSalesSection`); após a conversão deixaria de ver. Escalar ao dono (gate G-RISK). |

**Reconciliação do descasamento layout↔RPC:** o layout `/vendas` exclui gerente desde v1.5.1; os RPCs nunca foram alinhados e ainda admitem gerente. A conversão D1 **alinha** os RPCs ao layout — exceto pelo R10, que é consumido fora de `/vendas`, onde o alinhamento ao módulo Vendas vira regressão para o gerente no módulo Eventos.

---

## 4) Catálogo + Backfill (Passo 1 / Aprendizado 1)

- **Catálogo:** `permission_controls` tem `vendas` com as **5 ações** (view/create/edit/delete/export) ✅ (migration 107).
- **Template `role_permissions` (granted=true):**
  - `view`: super_admin, diretor, vendedora, pos_vendas
  - `create`/`edit`: super_admin, diretor, **gerente**
  - `delete`/`export`: super_admin
  - ⚠️ Nota: gerente tem `create`/`edit` no template mas **não** `view` — relevante para gate (ii) das escritas.

### Resultado LOCAL (⚠️ só contas `@cachola.local`)

**GAP detectado** — as 3 contas de teste no guard (diretor, pos_vendas, vendedora) têm **0 linhas** de `vendas` em `user_permissions` (nem `view`):

| role | tem `vendas.view` granted? |
|------|----------------------------|
| diretor (teste) | ❌ (sem linha) |
| pos_vendas (teste) | ❌ (sem linha) |
| vendedora (teste) | ❌ (sem linha) |

Causa: o seed local popula de `role_default_perms` (tabela legada), que **não tem entradas de `vendas`**. Como `check_permission` faz `COALESCE(v_granted, FALSE)` (sem fallback de template), converter hoje **bloquearia** esses cargos. → **A FASE B obriga uma migration de backfill** (`INSERT ... SELECT FROM role_permissions ... ON CONFLICT DO NOTHING`) para diretor/vendedora/pos_vendas — **NÃO** gerente (D1: gerente intencionalmente sem `vendas.view`).

> ⚠️ **Local-clean ≠ Prod-clean.** O gap local pode ser só limitação de seed; a query de produção é o gate real.

### Query pronta para PRODUÇÃO (gate — NÃO rodar agora)

```sql
-- PRODUÇÃO (VPS): docker exec -i supabase-db psql -U postgres -d postgres
-- Gap de backfill: cargos no guard de Vendas sem vendas.view granted.
SELECT u.role, u.name, u.email
FROM public.users u
WHERE u.is_active = true
  AND u.role IN ('diretor','vendedora','pos_vendas')   -- super_admin é bypass
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = u.id
      AND up.module = 'vendas'
      AND up.action = 'view'
      AND up.granted = true
  )
ORDER BY u.role, u.name;
-- Qualquer linha → backfill aditivo (ON CONFLICT DO NOTHING) na migration da FASE B.
```

---

## 5) Overrides escondidos (Passo 2 / Aprendizado 8)

Usuários com grant individual em `vendas` cujo cargo está FORA do guard `VENDAS_MODULE_ROLES` (grants dormindo que a conversão acordaria).

### Resultado LOCAL (⚠️ só contas `@cachola.local`)

**0 linhas** — nenhum override escondido local.

> ⚠️ **Local-clean ≠ Prod-clean.** Reais (ex.: gerente com grants, Suporte DRK) só aparecem contra produção. Atenção especial ao **gerente**: se um gerente tiver `vendas.view` granted individual em prod, ele acordaria — mas só importa para R10 (`/eventos/[id]`), pois nos demais o layout `/vendas` o barra.

### Query pronta para PRODUÇÃO (gate — NÃO rodar agora)

```sql
-- PRODUÇÃO (VPS): docker exec -i supabase-db psql -U postgres -d postgres
-- Overrides: grants em vendas para cargos FORA do guard atual.
SELECT u.id, u.role, u.name, u.email, up.action, up.granted, up.unit_id
FROM public.users u
JOIN public.user_permissions up
  ON up.user_id = u.id
  AND up.module = 'vendas'
  AND up.granted = true
WHERE u.role NOT IN ('super_admin','diretor','vendedora','pos_vendas')
ORDER BY u.role, u.name, up.action;
-- Para cada linha: dono decide (A) aceitar, (B) revogar antes, (C) aceitar + auditar.
```

---

## 6) Gates para o dono (decisões binárias — NÃO decididas aqui)

**G-i — Mapear os RPCs de LEITURA para `check_permission('vendas','view')` (D1)?**
Confirma explicitamente: **gerente PERDE** acesso aos RPCs de Vendas (R1-R9) e **pos_vendas MANTÉM** (já tinha desde 068 — não "ganha"). Para R1-R4/R6-R8 a perda do gerente é net-zero (layout já barra); para R5/R9 é cosmética (badge).
**(A) Sim, mapear R1-R9 para view** / **(B) Não converter**.

**G-RISK — `get_event_sales_summary` (R10): converter, manter, ou mapear para outro módulo?**
É consumido em `/eventos/[id]` (gerente acessa). Mapear para `vendas.view` **tira do gerente** uma seção que ele vê hoje no detalhe do evento.
**(A) Converter para `vendas.view`** (aceita perda do gerente) / **(B) Manter role-based atual** (5 cargos) / **(C) Mapear para `eventos.view`** (alinha ao módulo onde é consumido, preserva gerente).

**G-ii — RPCs/RLS de ESCRITA-log (upsell_contact_log, recompra_contact_log INSERT/UPDATE): D2-hold ou mapear para create/edit?**
Mapear as escritas para `vendas.create`/`edit` **habilitaria pos_vendas a registrar contato de upsell/recompra** (hoje bloqueado pela RLS — pos_vendas não está nos roles nem tem seller_id). Trade-off concreto, não abstrato.
**(A) Manter D2-hold (trava de cargo)** / **(B) Mapear para create/edit (habilita pos_vendas a logar)**.

**G-iii — Itens D3 permanecem `hasRole`?**
`isVendedora`, `isManager`/`VENDAS_MANAGE_ROLES` (agregação "ver todas as vendedoras" + drill-down), `effectiveSellerId`, e a fiscalização sa+dir de `recompra_contact_log` (decisão 119) — todos lógica por cargo per se.
**(A) Sim, permanecem hasRole** / **(B) Revisar**.

**G-iv — Autorizar auditoria de §4 (backfill) e §5 (overrides) contra PRODUÇÃO antes da FASE B?**
A FASE B deve incluir migration de **backfill** (`vendas.view` para diretor/vendedora/pos_vendas, ON CONFLICT DO NOTHING) — confirmado necessário (gap §4). Auditoria de prod é gate de deploy.
**(A) Sim, rodar e reportar** / **(B) Não prosseguir**.

---

## Resumo do escopo previsto para a FASE B

- **Migration:** backfill aditivo de `vendas.view` (diretor/vendedora/pos_vendas) — **obrigatório** (Aprendizado 1) + conversão dos guards dos RPCs R1-R9 para `check_permission_or_raise('vendas','view')`.
- **Layout:** `/vendas` → `requirePermissionServer('vendas','view')`.
- **Decisão pendente:** R10 (`get_event_sales_summary`) conforme G-RISK.
- **Mantém-se:** D2-hold das escritas-log, D3 da UI de gestor, RLS de espelho/owner.
- **Validação:** ANTES==DEPOIS por cargo (exceto gerente, perda aprovada) + prova de toggle local.
