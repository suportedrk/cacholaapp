# FASE A — Levantamento RBAC do módulo BI (read-only)

> **Escopo:** módulo BI = rota `/bi` (1 layout) + 17 RPCs `get_bi_*` + condicionais de aba na page.
> **Status:** levantamento READ-ONLY. Nada convertido, nenhuma migration, nenhum guard alterado.
> **Data:** 2026-05-29 · branch `develop` @ `dfb349b`
> **Recomendação de modelo para FASE B:** Opus (3 módulos de catálogo, backfill obrigatório, risco de lockout).

> ⚠️ **Descoberta-chave confirmada:** o BI é composto por **TRÊS módulos de catálogo distintos**, com públicos
> diferentes. A conversão **NÃO** é "tudo para `bi.view`": cada superfície vai para `bi`, `bi_atendimento`
> ou `bi_vendas` conforme a aba/dado que serve. Os três códigos existem em `permission_controls` e no
> tipo `Module` (`src/types/permissions.ts:21-23`), cada um com as 5 ações (`view/create/edit/delete/export`).

> ⚠️ **Relatórios está FORA deste escopo.** A rota `/relatorios` apenas **reutiliza a constante**
> `BI_ACCESS_ROLES`, mas seu módulo de catálogo é `'relatorios'` (separado). Sua conversão pertence ao
> item de fila "Dashboard + Relatórios". Ver §6 (overrides adormecidos em `relatorios`).

---

## 1) INVENTÁRIO (arquivo:linha)

### 1.1 Layout guard

| Arquivo:linha | Guard atual | Constante | Observação |
|---|---|---|---|
| `src/app/(auth)/bi/layout.tsx:13` | `requireRoleServer(BI_ACCESS_ROLES)` | `BI_ACCESS_ROLES = [super_admin, diretor]` | **Comentário stale** (linha 6): diz "gerente e financeiro" — resíduo de antes do aperto v1.5.1. |

A constante `BI_ACCESS_ROLES` está em `src/config/roles.ts:19-22` (= `super_admin`, `diretor`).
`BI_ATENDIMENTO_ROLES` (`roles.ts:25-28`) = `super_admin`, `diretor`.
`BI_VENDAS_ROLES` (`roles.ts:31-36`) = `super_admin`, `diretor`, `gerente`, `financeiro`.

### 1.2 Gating de abas/seções (client-side, `src/app/(auth)/bi/page.tsx`)

| Linha | Expressão | Efeito |
|---|---|---|
| `page.tsx:44` | `import { BI_ATENDIMENTO_ROLES, BI_VENDAS_ROLES, hasRole }` | — |
| `page.tsx:126` | `canSeeSellers = hasRole(profile?.role, BI_ATENDIMENTO_ROLES)` | mostra aba **Atendimento (Deals)** |
| `page.tsx:127` | `canSeeVendas = hasRole(profile?.role, BI_VENDAS_ROLES)` | mostra aba **Vendas Realizadas (Orders)** |
| `page.tsx:291,294,300` | `(canSeeSellers \|\| canSeeVendas)` / `canSeeSellers` / `canSeeVendas` | renderização condicional das `TabsTrigger` |
| `page.tsx:780,787` | `canSeeSellers` / `canSeeVendas` | renderização condicional dos `TabsContent` (`SellersTab`, `VendasRealizadasTab`) |

> **NOTA estrutural importante (§4):** como o **layout** (`/bi` = sa+diretor) está **acima** das abas,
> `gerente`/`financeiro` recebem **/403 na rota** e **nunca** renderizam a `page.tsx`. Logo `canSeeVendas`
> é **código morto** para eles no navegador — sua única via de acesso aos RPCs `bi_vendas` é **JWT direto**.

### 1.3 `can_view_festa_values()` — mascaramento de colunas de valor (D3, ortogonal)

| Local | Uso |
|---|---|
| `src/config/roles.ts:379-397` | `ROLES_CAN_VIEW_FESTA_VALUES` (7 roles) + helper `canViewFestaValues()` (espelha SQL migration 093) |
| RPC `get_bi_sales_metrics` | `CASE WHEN can_view_festa_values() THEN ... ELSE NULL` em `total_revenue`, `avg_ticket`, `prev_revenue`, `prev_avg_ticket` |
| RPC `get_bi_unit_comparison` | idem em `total_revenue`, `avg_ticket` |

Não usado em componentes BI (apenas em `eventos/[id]/page.tsx:252` e `pre-reserva-ploomes-card.tsx:43`, fora do escopo BI).

### 1.4 As 17 RPCs `get_bi_*` — guarda EXATA (extraída via `pg_get_functiondef` do banco vivo)

Todas SECURITY DEFINER. Guarda = `IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN (...)) THEN RAISE EXCEPTION 'insufficient_privilege'`.

| # | RPC | Hook / arquivo | Cargos no guard HOJE | Tipo |
|---|---|---|---|---|
| 1 | `get_bi_conversion_data` | `use-bi-conversion.ts:64` | sa, diretor, gerente, financeiro | **BROAD** |
| 2 | `get_bi_funnel_data` | `use-bi-funnel.ts:57` | sa, diretor, gerente, financeiro | **BROAD** |
| 3 | `get_bi_lead_origin_breakdown` | `use-lead-origin-breakdown.ts:42` | sa, diretor, gerente, financeiro | **BROAD** |
| 4 | `get_bi_sales_metrics` | `use-bi-sales-metrics.ts:71` | sa, diretor, gerente, financeiro | **BROAD** + `can_view_festa_values()` |
| 5 | `get_bi_unit_comparison` | `use-bi-unit-comparison.ts:39` | sa, diretor, gerente, financeiro | **BROAD** + `can_view_festa_values()` |
| 6 | `get_bi_sellers_ranking` | `use-bi-sellers-ranking.ts:34` | sa, diretor | **NARROW** |
| 7 | `get_bi_seller_history` | `use-bi-seller-history.ts:35` (+ inline `sellers-tab.tsx:73`) | sa, diretor | **NARROW** |
| 8 | `get_bi_seller_funnel` | `use-bi-seller-funnel.ts:33` | sa, diretor | **NARROW** |
| 9 | `get_bi_sales_kpi` | `use-bi-sales.ts:64` | sa, diretor, gerente, financeiro | **BROAD** |
| 10 | `get_bi_sales_ranking` | `use-bi-sales.ts:94` | sa, diretor, gerente, financeiro | **BROAD** |
| 11 | `get_bi_seller_orders` | `use-bi-sales.ts:123` | sa, diretor, gerente, financeiro | **BROAD** |
| 12 | `get_bi_category_kpi` | `use-bi-category.ts:68` | sa, diretor, gerente, financeiro | **BROAD** |
| 13 | `get_bi_category_ranking` | `use-bi-category.ts:104` | sa, diretor, gerente, financeiro | **BROAD** |
| 14 | `get_bi_category_drilldown` | `use-bi-category.ts:135` | sa, diretor, gerente, financeiro | **BROAD** |
| 15 | `get_bi_category_cross_unit` | `use-bi-category.ts:164` | sa, diretor, gerente, financeiro | **BROAD** |
| 16 | `get_bi_adoption_kpi` | `use-bi-adoption.ts:41` | sa, diretor, gerente, financeiro | **BROAD** |
| 17 | `get_bi_adoption_ranking` | `use-bi-adoption.ts:69` | sa, diretor, gerente, financeiro | **BROAD** |

### 1.5 Leituras diretas de tabela (RLS-governadas, NÃO são RPC — Estruturais)

| Hook:linha | Tabela | Aba | Tratamento |
|---|---|---|---|
| `use-bi-seller-deals.ts:52` | `.from('ploomes_deals')` | Atendimento (drill-down) | **Estrutural** — RLS de `ploomes_deals` já existe; não converte no escopo BI |
| `use-bi-seller-events.ts:36` | `.from('events')` | Atendimento (drill-down) | **Estrutural** — RLS de `events` |

### 1.6 Verificação de caller cross-surface (negativo confirmado)

`grep -rn` de todos os `get_bi_*` em `src`: **todo** hook consumidor é importado apenas em
`bi/page.tsx` ou `components/features/bi/*`. **Nenhum** `get_bi_*` é alcançado de `/dashboard`, `/vendas`,
`/eventos` etc. → **não há análogo do G-RISK** (`get_event_sales_summary` do Vendas). `get_pre_reserva_conflicts`
não é RPC de BI (usado em `/eventos` e `/inicio`) — fora do escopo.

### 1.7 RLS de tabelas próprias do módulo

O BI não possui tabelas próprias. Todos os RPCs leem `ploomes_deals`, `ploomes_orders`,
`ploomes_order_products`, `sellers`, `units`, `events`. A segurança de agregados depende **inteiramente** do
guard no corpo dos RPCs (SECURITY DEFINER bypassa RLS).

---

## 2) MAPA RPC → MÓDULO (seção principal)

Mapeamento proposto pelo dado/aba que cada RPC serve, com o público intencional de cada aba ao lado.

Públicos intencionais (constantes + template `role_permissions`):
- **`bi`** (aba Visão Geral, rota `/bi`, sidebar): `super_admin`, `diretor`
- **`bi_atendimento`** (aba Atendimento/Deals): `super_admin`, `diretor`
- **`bi_vendas`** (aba Vendas Realizadas/Orders + categorias + adoção): `super_admin`, `diretor`, `gerente`, `financeiro`

| RPC | Aba / Dado | Guard atual (cargos) | Módulo proposto | Desalinhamento? |
|---|---|---|---|---|
| get_bi_conversion_data | Visão Geral | sa,dir,**ger,fin** | `bi` | ⚠️ **SIM** — guard BROAD; público da aba é sa+dir. ger/fin chamam via JWT o que a rota esconde. |
| get_bi_funnel_data | Visão Geral | sa,dir,**ger,fin** | `bi` | ⚠️ **SIM** (idem) |
| get_bi_lead_origin_breakdown | Visão Geral | sa,dir,**ger,fin** | `bi` | ⚠️ **SIM** (idem) |
| get_bi_sales_metrics | Visão Geral | sa,dir,**ger,fin** | `bi` | ⚠️ **SIM** (idem) — valor já mascarado por `can_view_festa_values()` |
| get_bi_unit_comparison | Visão Geral | sa,dir,**ger,fin** | `bi` | ⚠️ **SIM** (idem) — valor já mascarado |
| get_bi_sellers_ranking | Atendimento (Deals) | sa,dir | `bi_atendimento` | ✅ Não (NARROW = público da aba) |
| get_bi_seller_history | Atendimento (drill) | sa,dir | `bi_atendimento` | ✅ Não |
| get_bi_seller_funnel | Atendimento (drill) | sa,dir | `bi_atendimento` | ✅ Não |
| get_bi_sales_kpi | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** (ver abaixo) |
| get_bi_sales_ranking | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_seller_orders | Vendas Realizadas (drill) | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_category_kpi | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_category_ranking | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_category_drilldown | Vendas Realizadas (drill) | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_category_cross_unit | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_adoption_kpi | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |
| get_bi_adoption_ranking | Vendas Realizadas | sa,dir,ger,fin | `bi_vendas` | 🔶 **VESTIGIAL** |

### 🔶 O desalinhamento VESTIGIAL do `bi_vendas` (headline — exige decisão do dono)

`BI_VENDAS_ROLES` inclui `gerente` e `financeiro`, e os 9 RPCs `bi_vendas` têm guard BROAD que os admite.
**MAS** o layout `/bi` foi apertado para `sa+diretor` na v1.5.1 e ficou **acima** das abas. Resultado hoje:

- `gerente`/`financeiro` batem em **/403 na rota** `/bi` → **nunca** renderizam a aba "Vendas Realizadas".
- `canSeeVendas` é **código morto** para eles no navegador.
- A **única** via deles para os dados `bi_vendas` é **chamada JWT direta** ao RPC.
- O comentário stale "gerente e financeiro" no layout é a impressão digital dessa transição incompleta.

Converter `bi_vendas` RPCs → `check_permission('bi_vendas','view')` (template inclui ger/fin) **preserva**
exatamente esse acesso JWT a dados que eles não conseguem ver em nenhuma aba do navegador. Isso **não fecha**
o desalinhamento — apenas o transporta para o catálogo. Por isso é um **gate** (G2), não uma decisão técnica.

---

## 3) CLASSIFICAÇÃO

| Categoria | Itens |
|---|---|
| **Conversível** → `check_permission(<modulo>,'view')` | RPCs #1–5 → `bi`; RPCs #6–8 → `bi_atendimento`; RPCs #9–17 → `bi_vendas`. Layout `/bi` → `requirePermissionServer('bi','view')`. |
| **D3 (cargo-per-se / ortogonal)** | `can_view_festa_values()` (#4, #5): mascara **colunas de valor**, não gateia rota/aba. Permanece como `hasRole`/função SQL própria, ortogonal ao guard de módulo. **Não vira toggle de `bi`.** |
| **Estrutural** | `use-bi-seller-deals` (`.from('ploomes_deals')`) e `use-bi-seller-events` (`.from('events')`): governados por RLS das tabelas, não por RPC. Fora da conversão BI. |
| **D2-hold** | Nenhum. Todos os 17 RPCs são leitura → mapeiam para `view`. Não há superfície onde o mapeamento expandiria público de escrita. |

### 3.(a) RPCs NARROW de drill-down de vendedora individual (#6, #7, #8)

`get_bi_sellers_ranking`, `get_bi_seller_history`, `get_bi_seller_funnel` servem a aba Atendimento (público
`sa+diretor`). Guard atual NARROW (`sa,diretor`) **já coincide** com o público. **Conversíveis** para
`check_permission('bi_atendimento','view')` sem mudança de público — conversão limpa, sem ganho nem perda.

### 3.(b) `can_view_festa_values()` como D3

Permanece. Mascara `total_revenue`/`avg_ticket` para roles fora de `ROLES_CAN_VIEW_FESTA_VALUES`. É ortogonal
ao guard de rota: um `diretor` com `bi.view` continua sujeito ao mascaramento de valor conforme a função SQL.
**Não** deve ser transformado em ação de catálogo nesta fase.

---

## 4) DIVERGÊNCIA POR RPC (ANTES vs DEPOIS)

DEPOIS = quem terá `<modulo>.view` conforme `role_permissions` (template já populado):
`bi.view` = sa, diretor · `bi_atendimento.view` = sa, diretor · `bi_vendas.view` = sa, diretor, gerente, financeiro.

| Módulo | RPCs | ANTES (guard) | DEPOIS (template .view) | Δ por cargo | Efeito |
|---|---|---|---|---|---|
| `bi` | #1–5 | sa,dir,ger,fin | sa,dir | ➖ **gerente perde**, ➖ **financeiro perde** (acesso JWT) | ✅ **Desejado** — fecha o gap JWT que o migration 118 explicitamente adiou ("aperto na fase de UI quando as 17 RPCs forem convertidas"). |
| `bi_atendimento` | #6–8 | sa,dir | sa,dir | (sem mudança) | ✅ Neutro / consistente |
| `bi_vendas` | #9–17 | sa,dir,ger,fin | sa,dir,ger,fin | (sem mudança) | 🔶 **Preserva** acesso JWT de ger/fin a dados sem aba acessível (ver §2). **Risco a ratificar (G2).** |

> O ponto-chave de §4: a conversão do `bi` é um **aperto desejado**; a do `bi_vendas` é uma **manutenção
> de um estado vestigial**. Só o dono decide se quer fechar o `bi_vendas` também (estreitar template e/ou
> abrir a rota — ver G2).

---

## 5) CATÁLOGO + BACKFILL (Passo 1 / Aprendizado 1) — LOCAL

### 5.1 Catálogo (`permission_controls`) — confirmado

`bi`, `bi_atendimento`, `bi_vendas` (e `relatorios`) existem com as **5 ações** (`view, create, edit, delete, export`). 0 controles finos (`kind='control'`) — apenas ações.

### 5.2 Template (`role_permissions`, `granted=true`) — `.view` por módulo

| Módulo | Cargos com `.view` no template | Coincide com a constante? |
|---|---|---|
| `bi` | diretor, super_admin | ✅ = `BI_ACCESS_ROLES` |
| `bi_atendimento` | diretor, super_admin | ✅ = `BI_ATENDIMENTO_ROLES` |
| `bi_vendas` | diretor, financeiro, gerente, super_admin | ✅ = `BI_VENDAS_ROLES` |

> O template **já está alinhado** com os públicos intencionais. A fonte de verdade da herança é
> `role_permissions` (lida por `src/lib/rbac/apply-template.ts`) — **não** `role_default_perms` (legado).

### 5.3 Auditoria de backfill — LOCAL (só `@cachola.local`)

`check_permission` é **unit-agnóstico** (corpo: `WHERE user_id AND module AND action`, sem filtro de `unit_id`).
Logo **uma única linha global** (`unit_id IS NULL`, `granted=true`) satisfaz o check — backfill espelha o
padrão do Vendas (migration 122).

**GAP de lockout detectado (LOCAL):** usuários que hoje passam pelo público intencional mas **não têm**
`<modulo>.view` em `user_permissions`:

| Módulo | Cargo | Usuário | Tem `.view`? |
|---|---|---|---|
| `bi` | diretor | teste.diretor@cachola.local | ❌ **falta** |
| `bi_atendimento` | diretor | teste.diretor@cachola.local | ❌ **falta** |
| `bi_vendas` | diretor | teste.diretor@cachola.local | ❌ **falta** |
| `bi_vendas` | financeiro | teste.financeiro@cachola.local | ❌ **falta** |
| `bi_vendas` | gerente | teste.gerente@cachola.local | ❌ **falta** |

> **CONCLUSÃO:** **backfill é OBRIGATÓRIO** na FASE B (risco de **LOCKOUT** idêntico ao Vendas).
> Converter o layout `/bi` → `requirePermissionServer('bi','view')` **sem backfill** trancaria o `diretor`
> fora do BI. Converter os RPCs `bi_vendas` quebraria a aba "Vendas Realizadas" para ger/fin.
> `super_admin` é bypass (`check_permission` early-return) — **não** entra no backfill.

### 5.4 Queries de PRODUÇÃO (gate de deploy — rodar na FASE B após aprovação G5)

```sql
-- GAP de backfill em produção (usuários ativos que passariam no público mas faltam .view)
WITH targets AS (
  SELECT 'bi'::text AS m, unnest(ARRAY['super_admin','diretor']) AS r
  UNION ALL SELECT 'bi_atendimento', unnest(ARRAY['super_admin','diretor'])
  UNION ALL SELECT 'bi_vendas', unnest(ARRAY['super_admin','diretor','gerente','financeiro'])
)
SELECT t.m AS module, u.role, u.email,
  EXISTS(SELECT 1 FROM user_permissions up
         WHERE up.user_id=u.id AND up.module=t.m AND up.action='view' AND up.granted=true) AS has_view
FROM targets t JOIN users u ON u.role=t.r AND u.is_active=true
WHERE u.role <> 'super_admin'
ORDER BY t.m, u.role;
```

---

## 6) OVERRIDES ESCONDIDOS (Passo 2 / Aprendizado 8) — LOCAL + query de produção

### 6.1 LOCAL — grants nos 3 módulos BI para roles FORA do público intencional

**Resultado: 0 linhas.** Nenhum override adormecido em `bi`, `bi_atendimento` ou `bi_vendas`.
A conversão dos três módulos BI **não** acorda nenhum acesso inesperado por override individual.

### 6.2 ⚠️ Heads-up: overrides adormecidos em `relatorios` (FORA do escopo BI)

A auditoria revelou 3 grants em `relatorios` para roles fora do público de `/relatorios` (sa+diretor):

| Cargo | Override |
|---|---|
| financeiro | `relatorios.view` + `relatorios.export` |
| gerente | `relatorios.view` |

> **Não agir agora.** `/relatorios` pertence ao item de fila "Dashboard + Relatórios". Estes overrides
> **acordariam** se `/relatorios` for convertido para `requirePermissionServer('relatorios','view')` —
> financeiro/gerente ganhariam acesso à rota. Registrar para tratamento naquela conversão (Aprendizado 8).
> A RPC `report_checklists_by_category` (de `/relatorios`) **não tem guard de role** — também fora do escopo BI.

### 6.3 Query de PRODUÇÃO (gate — rodar na FASE B)

```sql
-- Overrides adormecidos: grants nos módulos BI para roles fora do público intencional
SELECT u.role, up.module, up.action, up.unit_id, up.granted, u.email
FROM user_permissions up JOIN users u ON u.id=up.user_id
WHERE up.module IN ('bi','bi_atendimento','bi_vendas')
  AND up.granted=true
  AND NOT (
    (up.module IN ('bi','bi_atendimento') AND u.role IN ('super_admin','diretor'))
    OR (up.module='bi_vendas' AND u.role IN ('super_admin','diretor','gerente','financeiro'))
  )
ORDER BY u.role, up.module, up.action;
```

---

## 7) GATES PARA O DONO (decisões binárias — NÃO decididas aqui)

- **G1 — Ratificar o MAPA RPC→módulo (split em 3 módulos).** Confirmar: #1–5 → `bi`; #6–8 → `bi_atendimento`;
  #9–17 → `bi_vendas`; layout `/bi` → `bi.view`. **[Sim / Ajustar]**

- **G2 — Desalinhamento VESTIGIAL do `bi_vendas` (decisão central).** Hoje ger/fin batem em /403 em `/bi`
  mas têm acesso JWT aos RPCs `bi_vendas`. Escolha **uma**:
  - **(A)** Manter como está: converter `bi_vendas` → `bi_vendas.view` (template já inclui ger/fin),
    **preservando** o acesso JWT a dados sem aba navegável. (status quo no catálogo)
  - **(B)** Abrir a rota: alargar o layout `/bi` para admitir quem tem `bi_atendimento.view` **ou**
    `bi_vendas.view`, de modo que ger/fin **realmente** acessem a aba "Vendas Realizadas". (gating por aba
    passa a valer no navegador)
  - **(C)** Estreitar de vez: ratificar que a aba é efetivamente sa+diretor e **remover** ger/fin de
    `bi_vendas.view` no template (+ user_permissions), igualando ao `bi`.
  **[A / B / C]**

- **G3 — Desalinhamento desejado do `bi` (Visão Geral).** Confirmar que converter #1–5 para `bi.view`
  **deve** remover o acesso JWT de gerente/financeiro (fecha o gap que o migration 118 adiou). **[Sim / Não]**

- **G4 — RPCs NARROW de drill-down (#6–8).** Confirmar conversão para `bi_atendimento.view` sem mudança de
  público (sa+diretor → sa+diretor). **[Sim / Ajustar]**

- **G5 — `can_view_festa_values()` permanece como está (D3).** Confirmar que o mascaramento de colunas de
  valor continua independente do guard de módulo, sem virar ação de catálogo. **[Sim / Não]**

- **G6 — Autorizar auditoria de PRODUÇÃO (§5.4 + §6.3) + confirmar backfill obrigatório antes da FASE B.**
  O backfill local mostrou 5 gaps (diretor em todos os 3; ger/fin em bi_vendas). Autoriza rodar as queries
  de produção e gerar a migration de backfill (espelho da 122) como pré-condição da conversão? **[Sim / Não]**

---

## Resumo executivo

- **3 módulos de catálogo**, públicos já corretos no template `role_permissions`.
- **Mapa:** 5 RPCs → `bi`; 3 → `bi_atendimento`; 9 → `bi_vendas`. Layout `/bi` → `bi.view`.
- **Sem cross-surface risk** (negativo confirmado por grep): nenhum análogo do G-RISK do Vendas.
- **`bi` (Visão Geral):** conversão **aperta** (remove ger/fin JWT) — desejado.
- **`bi_vendas`:** desalinhamento **vestigial** (rota bloqueia ger/fin, RPC os admite via JWT) — **decisão G2**.
- **`bi_atendimento`:** totalmente consistente.
- **Backfill OBRIGATÓRIO** (lockout de diretor + ger/fin), `check_permission` unit-agnóstico → grants globais.
- **0 overrides** adormecidos nos módulos BI; **3 overrides em `relatorios`** (fora de escopo, heads-up).
- **Relatórios excluído** (módulo `relatorios` separado, item de fila próprio).
