# Frente Permissões de Valor — Fase 1: Mapeamento Diagnóstico

**Data:** 2026-05-18  
**Branch:** develop  
**Status:** SOMENTE LEITURA — não modifica código, migrations ou config  
**Regra de negócio:** Roles `manutencao`, `rh`, `freelancer` e `entregador` NÃO devem ver valores monetários de festa em nenhum ponto da aplicação. UX definida: exibir `— Restrito —` onde o valor apareceria.

---

## 1. RPCs do Banco

Inventário de todas as RPCs que retornam campos monetários de festa (`total_revenue`, `avg_ticket`, `deal_amount`, `amount`, `revenue`, `soma_prod`, etc.).

### 1.1 RPCs com guard de role explícito no SQL

Estas RPCs têm `IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN (...))` antes de retornar dados. Roles bloqueadas (`manutencao`, `rh`, `freelancer`, `entregador`) já são excluídas pelo guard — **sem vazamento de backend**.

| RPC | Campos monetários | Roles permitidas pelo guard | Migration |
|-----|-------------------|----------------------------|-----------|
| `get_bi_sellers_ranking` | `total_revenue`, `avg_ticket` | super_admin, diretor | 087 |
| `get_bi_seller_history` | `revenue` | super_admin, diretor | 087 |
| `get_bi_seller_funnel` | `total_value` | super_admin, diretor | 087 |
| `get_bi_sales_kpi` | `total_revenue`, `avg_ticket` | super_admin, diretor, gerente, financeiro | 087 |
| `get_bi_sales_ranking` | `total_revenue`, `avg_ticket`, `avg_monthly_revenue` | super_admin, diretor, gerente, financeiro | 087 |
| `get_bi_seller_orders` | `amount` | super_admin, diretor, gerente, financeiro | 087 |
| `get_vendas_my_kpis` | `total_revenue`, `avg_ticket`, `prev_revenue`, `prev_avg_ticket` | super_admin, diretor, gerente, vendedora, pos_vendas | 087/059 |
| `get_vendas_daily_revenue` | `revenue`, `cumulative_revenue` | super_admin, diretor, gerente, vendedora, pos_vendas | 087/059 |
| `get_vendas_ranking` | `total_revenue`, `avg_ticket` | super_admin, diretor, gerente, vendedora, pos_vendas | 087/059 |
| `get_bi_category_kpi` | `top_category_revenue`, `total_revenue` | super_admin, diretor, gerente, financeiro | 057 |
| `get_bi_category_ranking` | `revenue`, `avg_product_ticket` | super_admin, diretor, gerente, financeiro | 057 |
| `get_bi_category_drilldown` | `item_revenue`, `item_avg` | super_admin, diretor, gerente, financeiro | 057 |
| `get_bi_category_cross_unit` | `revenue` | super_admin, diretor, gerente, financeiro | 057 |
| `get_event_sales_summary` | `deal_amount`, produtos `total` (JSONB) | super_admin, diretor, gerente, vendedora, pos_vendas | 070 |

### 1.2 RPCs sem guard de role no SQL — RISCO DE BACKEND

Estas RPCs usam `LANGUAGE sql SECURITY DEFINER` com apenas `GRANT EXECUTE ... TO authenticated`. A segurança depende **exclusivamente** da proteção de layout (`requireRoleServer`). Se o layout for contornado ou a rota for acessada via chamada direta à API, qualquer usuário autenticado recebe os dados.

| RPC | Campos monetários | Proteção atual | Migration |
|-----|-------------------|----------------|-----------|
| `get_bi_sales_metrics` | `total_revenue`, `avg_ticket`, `prev_revenue`, `prev_avg_ticket` | Layout `/bi` — `BI_ACCESS_ROLES` (super_admin, diretor) | 088 |
| `get_bi_unit_comparison` | `total_revenue`, `avg_ticket` | Layout `/bi` — `BI_ACCESS_ROLES` | 087 |

> ⚠️ **Gap de defense-in-depth:** Estas 2 RPCs não têm guard SQL. Um usuário `rh` que descobrisse o endpoint `/rest/v1/rpc/get_bi_sales_metrics` poderia chamá-lo com Anon Key sem passar pelo layout. Isso não é um vazamento de UI hoje, mas é uma fragilidade de backend. Recomenda-se adicionar o guard SQL em Fase 2.

### 1.3 RPCs sem campos monetários (fora de escopo)

| RPC | Retorna | Observação |
|-----|---------|------------|
| `get_bi_conversion_data` | `total_leads`, `won_leads`, `conversion_rate` | Sem valores monetários |
| `get_bi_funnel_data` | `stage_id`, `stage_name`, `total` (contagem) | Sem valores monetários |
| `get_bi_lead_origin_breakdown` | contagens por categoria | Sem valores monetários |

### 1.4 Acesso direto via PostgREST (tabelas e views)

PostgREST permite acesso direto sem passar por RPC. As RLS das tabelas controlam o acesso:

| Recurso | Campo monetário | RLS atual | Roles bloqueadas expostas? |
|---------|-----------------|-----------|---------------------------|
| `events` (tabela) | `deal_amount` | `check_permission('eventos','view')` — role-aware via `user_permissions` | rh tem `eventos.view` → acessa `deal_amount` via PostgREST direto 🚨 |
| `pre_reservas_ploomes_view` | `deal_amount` | `GRANT SELECT TO authenticated` + `unit_id = ANY(get_user_unit_ids())` — sem verificação de role | **Todas as roles** com acesso à unidade podem ler `deal_amount` desta view 🚨 |
| `ploomes_deals` (tabela) | `deal_amount` | `unit_id = ANY(get_user_unit_ids())` — sem verificação de role | Tecnicamente qualquer autenticado com acesso à unidade pode ler |

> **Nota:** O acesso via PostgREST direto requer conhecimento da API e a anon key/JWT. Não é um fluxo de UI, mas é uma exposição real de backend.

---

## 2. Componentes Frontend

### 2.1 Rota `/eventos/[id]` — VAZAMENTO CONFIRMADO 🚨

**Arquivo:** `src/app/(auth)/eventos/[id]/page.tsx`

| Localização | Campo | Guard de role? |
|-------------|-------|----------------|
| Linha 304 | `const hasFinancial = !!(event.deal_amount || event.payment_method)` — controla visibilidade da seção "Financeiro" | Nenhum |
| Linha 306 | `function formatBRL(val: number)` — formata BRL | — |
| Linhas 600–614 | Seção "Financeiro": renderiza `formatBRL(event.deal_amount)` e `event.payment_method` | **Nenhum** — visível para todas as roles em `EVENTOS_ACCESS_ROLES`, inclusive `rh` |
| Linha 617 | `<EventSalesSection eventId={id} />` | RPC `get_event_sales_summary` bloqueia `rh` no servidor, mas o componente renderiza (retorna erro silencioso) |

**Conclusão:** `rh` acessa `/eventos/[id]`, vê a seção Financeiro com `deal_amount` e `payment_method` sem qualquer restrição.

### 2.2 Rota `/eventos` (lista) — VAZAMENTO CONFIRMADO 🚨

**Arquivo:** `src/components/features/events/pre-reserva-ploomes-card.tsx`

| Localização | Campo | Guard de role? |
|-------------|-------|----------------|
| Linhas 28–29 | `function formatBRL(value: number)` | — |
| Linhas 137–139 | `{item.deal_amount != null && item.deal_amount > 0 && (<>{formatBRL(item.deal_amount)}</>)}` | **Nenhum** |

**Hook associado:** `src/hooks/use-pre-reservas-ploomes.ts`
- Linha 21: `deal_amount: number | null` no type
- Linha 74: `deal_amount: r.deal_amount` — fetcha e repassa o campo

**Componente usado em:** `src/app/(auth)/eventos/page.tsx` (linha 655) — rota acessível por `rh`.

**Conclusão:** Cards de pré-reserva Ploomes exibem `deal_amount` na listagem de eventos sem nenhuma verificação de role. `rh` vê os valores.

### 2.3 Rota `/bi` — Seguro ✅

Todos os componentes abaixo estão dentro da rota `/bi`, protegida por `requireRoleServer(BI_ACCESS_ROLES)` = [super_admin, diretor]. Roles bloqueadas nunca chegam a renderizar.

| Componente | Campos monetários renderizados |
|------------|-------------------------------|
| `bi/page.tsx` (linhas 180–181, 741, 748) | `periodTicket`, `periodRevenue`, `row.total_revenue`, `row.avg_ticket` |
| `bi-breakdown-by-unit.tsx` (linhas 108, 118) | `periodTicket`, `periodRevenue` |
| `bi-unit-comparison.tsx` (linhas 143, 151, 217, 226) | `total_revenue`, `avg_ticket` |
| `bi-trend-charts.tsx` (linha 216) | `total_revenue` (BarChart) |
| `drilldown-deal-card.tsx` (linha 43) | `deal_amount` |
| `seller-drilldown-sheet.tsx` (linhas 219, 349, 390) | `total_revenue`, `revenue`, `total_value` |
| `seller-orders-drilldown-sheet.tsx` (linhas 106, 118, 165) | `total_revenue`, `avg_ticket`, `amount` |
| `sellers-ranking-table.tsx` (linhas 212, 225) | `avg_ticket`, `total_revenue` |
| `vendas-por-categoria-section.tsx` (linhas 224, 262, 369, 375, 437, 440) | `revenue`, `top_category_revenue` |
| `vendas-realizadas-tab.tsx` (linhas 185, 203, 250, 256, 259, 300, 308, 312) | `total_revenue`, `avg_ticket`, `amount` |
| `category-drilldown-sheet.tsx` (linhas 146, 152, 209) | `item_revenue`, `item_avg` |

### 2.4 Rota `/vendas` — Seguro ✅

Protegida por `requireRoleServer(VENDAS_MODULE_ROLES)` = [super_admin, diretor, vendedora, pos_vendas]. Roles bloqueadas não têm acesso.

| Componente | Campos monetários renderizados |
|------------|-------------------------------|
| `meu-painel/kpi-cards.tsx` (linhas 116, 137) | `total_revenue`, `avg_ticket` |
| `meu-painel/ranking-table.tsx` (linhas 174, 183) | `total_revenue`, `avg_ticket` |
| `meu-painel/revenue-chart.tsx` | `cumulative_revenue` (AreaChart) |

### 2.5 Fora de escopo (não são "valor de festa")

| Componente | Campo | Motivo da exclusão |
|------------|-------|--------------------|
| `maintenance/cost-card.tsx` | custos de manutenção | Orçamento operacional, não valor do cliente |
| `maintenance/maintenance-kpis.tsx` | custos de manutenção | Idem |
| `bi-funnel.tsx` | contagem de deals por stage | Contagem, não BRL |
| `lead-origin-panel.tsx` | contagens de leads | Contagem, não BRL |
| `bi-adoption-card.tsx` | contagens de orders e % | Não monetário |
| `report/*-chart-card.tsx` | contagens | Não monetário |

---

## 3. Mapa de Acessos por Rota

### Roles bloqueadas vs rotas com valores monetários

| Rota | `manutencao` | `rh` | `freelancer` | `entregador` | Tem valor monetário? | Status |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| `/dashboard` | ✅ acessa | ✅ acessa | 🚫 guard | 🚫 guard | Não | ✅ Seguro |
| `/eventos` | 🚫 guard | ✅ acessa | 🚫 guard | 🚫 guard | **Sim** (PreReserva deal_amount) | 🚨 Vazamento |
| `/eventos/[id]` | 🚫 guard | ✅ acessa | 🚫 guard | 🚫 guard | **Sim** (Financeiro: deal_amount, payment_method) | 🚨 Vazamento |
| `/bi` | 🚫 guard | 🚫 guard | 🚫 guard | 🚫 guard | Sim | ✅ Seguro |
| `/vendas` | 🚫 guard | 🚫 guard | 🚫 guard | 🚫 guard | Sim | ✅ Seguro |
| `/manutencao` | ✅ acessa | 🚫 guard | 🚫 guard | 🚫 guard | Não (custos operacionais) | ✅ Seguro |
| `/equipamentos` | ✅ acessa | 🚫 guard | 🚫 guard | 🚫 guard | Não | ✅ Seguro |
| `/prestadores` | ✅ acessa | 🚫 guard | 🚫 guard | 🚫 guard | Ver Seção 5 (ambíguo) | ⚠️ Ambíguo |
| `/relatorios` | 🚫 guard | 🚫 guard | 🚫 guard | 🚫 guard | Sim | ✅ Seguro |
| `/checklists/**` | 🚫 guard | 🚫 guard | ✅ acessa | ✅ acessa | Não | ✅ Seguro |
| `/atas` | 🚫 guard | ✅ acessa | 🚫 guard | 🚫 guard | Não | ✅ Seguro |
| `/admin/**` | 🚫 guard | 🚫 guard | 🚫 guard | 🚫 guard | Não | ✅ Seguro |

**Legenda de guards:**
- `/eventos` e `/eventos/[id]`: `EVENTOS_ACCESS_ROLES` = [super_admin, diretor, gerente, financeiro, vendedora, pos_vendas, decoracao, **rh**]
- `/manutencao`, `/equipamentos`: `MAINTENANCE_MODULE_ROLES` = [super_admin, diretor, gerente, **manutencao**]
- `/prestadores`: `PRESTADORES_ACCESS_ROLES` = [super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao]

### Resumo executivo de exposição

| Role | Consegue ver valor monetário de festa? | Como? |
|------|:---:|---|
| `manutencao` | **Não** | Excluída de `/eventos` pelo guard de layout |
| `rh` | **SIM** 🚨 | Acessa `/eventos` (na lista: deal_amount nos cards Ploomes) e `/eventos/[id]` (seção Financeiro: deal_amount + payment_method) |
| `freelancer` | **Não** | Excluída de todas as rotas com valores (acessa apenas `/checklists/minhas-tarefas`) |
| `entregador` | **Não** | Idem `freelancer` |

---

## 4. Riscos e Estimativa de Correção

### 4.1 Vazamentos confirmados (ordenados por criticidade)

#### 🚨 CRÍTICO — rh vê deal_amount na seção Financeiro do evento

- **Arquivo:** `src/app/(auth)/eventos/[id]/page.tsx` — linhas 300–614
- **Campo:** `event.deal_amount`, `event.payment_method`
- **Como corrigir:** Adicionar guard de role antes de renderizar a seção Financeiro:
  ```tsx
  // Exemplo de fix (não implementar agora)
  const canSeeFestValue = hasRole(profile?.role, FESTA_VALUE_ROLES)
  // ...
  {hasFinancial && canSeeFestValue && (
    <section>...</section>
  )}
  // OU exibir placeholder:
  {hasFinancial && !canSeeFestValue && (
    <p className="text-text-secondary">— Restrito —</p>
  )}
  ```
- **Esforço:** S (< 1h) — 1 arquivo, mudança cirúrgica de ~5 linhas

#### 🚨 CRÍTICO — rh vê deal_amount nos cards de pré-reserva Ploomes na listagem

- **Arquivo:** `src/components/features/events/pre-reserva-ploomes-card.tsx` — linhas 137–139
- **Campo:** `item.deal_amount`
- **Opções de fix:**
  1. Passar prop `canSeeFestValue: boolean` do componente pai e condicionalmente exibir `— Restrito —`
  2. Consumir role via `useAuth()` dentro do próprio card e aplicar guard local
- **Esforço:** S (< 1h) — 1 componente + prop drilling de no máximo 1 nível

#### ⚠️ MÉDIO — PostgREST direto em `events.deal_amount`

- **Vetor:** `GET /rest/v1/events?select=deal_amount` com JWT de rh
- **RLS atual:** `check_permission('eventos','view')` — rh tem `eventos.view` → retorna o campo
- **Fix possível:** Column-level security ou view intermediária que omite `deal_amount` para roles bloqueadas
- **Esforço:** M (2–4h) — migration de view ou RLS por coluna (PostgreSQL não tem RLS por coluna nativo → precisa de view + RLS na view)
- **Prioridade:** Baixa a curto prazo (requer conhecimento técnico da API para explorar), mas recomendada para compliance

#### ⚠️ MÉDIO — PostgREST direto em `pre_reservas_ploomes_view.deal_amount`

- **Vetor:** `GET /rest/v1/pre_reservas_ploomes_view?select=deal_amount` com qualquer JWT autenticado
- **RLS atual:** apenas `unit_id = ANY(get_user_unit_ids())` — sem verificação de role
- **Fix possível:** Adicionar verificação de role na RLS da view ou remover `deal_amount` da view e só incluir onde necessário
- **Esforço:** S (< 1h) — adicionar `AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin','diretor','gerente','financeiro','vendedora','pos_vendas','decoracao'))` na WHERE da view (criando nova migration)
- **Nota:** Correção da view não resolve o acesso direto à tabela `events`

#### 🔍 BAIXO — Gap de defense-in-depth nas RPCs SQL (sem guard de role)

- **Afeta:** `get_bi_sales_metrics`, `get_bi_unit_comparison`
- **Situação atual:** Layout `/bi` bloqueia qualquer role fora de `BI_ACCESS_ROLES` antes de chamar as RPCs. Mas as RPCs não têm guard SQL — se chamadas diretamente (`/rest/v1/rpc/get_bi_sales_metrics`), qualquer usuário autenticado recebe dados
- **Roles bloqueadas afetadas hoje:** Nenhuma (o layout já bloqueia)
- **Risco:** Futuro refator que remova o layout guard deixaria as RPCs expostas sem aviso
- **Fix:** Adicionar guard `LANGUAGE plpgsql` com `IF NOT EXISTS (... role IN (...)) THEN RETURN; END IF;` — consistente com as demais 14 RPCs
- **Esforço:** S (30min) — migration simples de DDL

### 4.2 Estimativa total da Fase 2 (correção dos vazamentos confirmados)

| Item | Esforço | Prioridade |
|------|---------|-----------|
| Fix seção Financeiro em `/eventos/[id]` | S (~1h) | Alta |
| Fix `deal_amount` em `PreReservaPloomesCard` | S (~1h) | Alta |
| Fix RLS de `pre_reservas_ploomes_view` (migration) | S (~1h) | Média |
| Fix guard SQL em `get_bi_sales_metrics` e `get_bi_unit_comparison` | S (~30min) | Baixa |
| Fix PostgREST `events.deal_amount` para rh (view/column security) | M (~3h) | Baixa |
| Definir `FESTA_VALUE_ROLES` em `src/config/roles.ts` | S (~15min) | Alta (pré-req) |
| **Total para itens Alta+Média** | **~4h** | — |

---

## 5. Casos Ambíguos para Discussão

### 5.1 `ep.agreed_price` em `/prestadores/[id]` — É "valor de festa"?

- **Arquivo:** `src/app/(auth)/prestadores/[id]/components/sections/EventHistorySection.tsx` — linha 86
- **Campo:** `ep.agreed_price` (tabela `event_providers`, campo `agreed_price`)
- **Contexto:** Exibe o valor combinado com o prestador para aquele evento específico (custo da Cachola com o fornecedor)
- **Quem acessa:** `PRESTADORES_ACCESS_ROLES` = [super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao]
- **`manutencao` vê isso?** Sim — `manutencao` está em `PRESTADORES_ACCESS_ROLES`
- **Pergunta para Bruno:** `agreed_price` é "valor de festa" (deve ser restrito) ou "custo operacional de prestador" (fora do escopo desta frente)?
  - Se fora do escopo: nenhuma ação necessária
  - Se em escopo: adicionar guard para `manutencao` em `EventHistorySection.tsx`

### 5.2 `event.payment_method` em `/eventos/[id]` — É informação restrita?

- **Arquivo:** `src/app/(auth)/eventos/[id]/page.tsx` — linha 304 e seção Financeiro
- **Campo:** `event.payment_method` (forma de pagamento, não o valor)
- **Situação atual:** Exibido junto com `deal_amount` na seção Financeiro, sem guard
- **Pergunta para Bruno:** A forma de pagamento (pix, cartão, etc.) também deve ser restrita para `rh`, ou apenas o valor `deal_amount`?
  - Se apenas o valor: o fix pode exibir `payment_method` normalmente e só ocultar `deal_amount`
  - Se ambos: a seção Financeiro inteira deve ser ocultada/substituída por `— Restrito —`

### 5.3 `deal_amount` na pré-reserva vs deal_amount no evento — Mesma fonte de verdade?

- Em `/eventos` (lista): `deal_amount` vem de `pre_reservas_ploomes_view` → `ploomes_deals.deal_amount` (valor negociado no CRM)
- Em `/eventos/[id]`: `deal_amount` vem da tabela `events` diretamente — pode ser diferente se a sincronização não for perfeita
- A Fase C (v1.8.0) substituiu `deal_amount` por `SUM(produtos)` no BI, mas os campos de `events.deal_amount` e `ploomes_deals.deal_amount` ainda existem e são exibidos em `/eventos`
- **Pergunta para Bruno:** O fix deve ocultar ambos (`events.deal_amount` E `pre_reservas_ploomes_view.deal_amount`) para `rh`? Ou apenas um deles?
  - Recomendação: ocultar os dois para consistência

### 5.4 Profundidade do fix do PostgREST direto

- Corrigir a UI (Fase 2) remove o vazamento visual para usuários normais
- Um usuário `rh` técnico ainda poderia acessar `deal_amount` via `GET /rest/v1/events` com o JWT no header
- **Pergunta para Bruno:** A Fase 2 precisa cobrir também o acesso via API (column-level security), ou apenas o vazamento na UI?
  - Se UI apenas: ~4h total
  - Se UI + API: adicionar ~3h para a migration de view/segurança de coluna

---

## Apêndice — Referências de arquivos

| Arquivo | Relevância |
|---------|-----------|
| `src/config/roles.ts` | Fonte única de truth para roles — onde `FESTA_VALUE_ROLES` deve ser definida |
| `src/app/(auth)/eventos/layout.tsx` | Guard `requireRoleServer(EVENTOS_ACCESS_ROLES)` — inclui `rh` |
| `src/app/(auth)/eventos/[id]/page.tsx` | Linhas 300–617 — seção Financeiro sem guard |
| `src/components/features/events/pre-reserva-ploomes-card.tsx` | Linhas 137–139 — `deal_amount` sem guard |
| `src/hooks/use-pre-reservas-ploomes.ts` | Linhas 21, 74 — fetcha `deal_amount` |
| `supabase/migrations/090_pre_reserva_chosen_unit.sql` | Linha 68 — `GRANT SELECT TO authenticated` sem role check |
| `supabase/migrations/087_fase_c_valor_festa_soma_produtos.sql` | 9 RPCs com guard SQL correto |
| `supabase/migrations/088_bi_delta_kpi_period_comparison.sql` | 2 RPCs sem guard SQL (`get_bi_sales_metrics`, `get_bi_unit_comparison`) |
| `supabase/migrations/070_event_sales_summary.sql` | `get_event_sales_summary` — bloqueia `rh` corretamente no SQL |
| `supabase/migrations/071_rbac_catalogs.sql` | Linha 267 — `('rh', 'eventos', 'view', true)` confirma que rh tem `eventos.view` |
