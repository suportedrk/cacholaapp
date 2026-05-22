# Diagnóstico do Módulo de Manutenção

> **Tipo:** auditoria técnica somente leitura — nenhum código foi alterado, nenhuma migration criada, nenhum commit gerado.
> **Branch:** `develop`
> **Data:** 2026-05-21
> **Autor:** Claude Code (sob direção do Bruno)
> **Skills consultadas:** `cachola-rbac-pattern` (SKILL + `roles-ts-annotated` + `patterns-by-layer`), `cachola-stack` (referência), `cachola-supabase-ops` (referência). `cachola-dev-sync` pulada — modo investigação (somente leitura), conforme a própria skill autoriza.

---

## 0. Reprodução empírica — confirmada em 2026-05-21 (psql + browser)

Reproduzido no Docker local após Bruno subir os containers nesta sessão. Banco populado com super_admin `admin@cachola.local` em 2 unidades (Pinheiros + Moema).

### Validação browser (Fase 1.1) — 2026-05-21

Ambiente: `http://localhost:3002` (Next.js dev, Turbopack), usuário `admin@cachola.local` (super_admin), seletor global **"Todas as unidades"** (`activeUnitId = null`), rota `/manutencao/chamados`.

**Sequência executada:**
1. Seletor global → "Todas as unidades"
2. Clique em "Novo Chamado"
3. Título preenchido: `"Teste validação browser - Todas as unidades"`
4. Clique em "Abrir Chamado"

**Resultado capturado:**

| Item | Valor |
|---|---|
| HTTP status | **403** |
| Request body | `{"title":"Teste validação browser - Todas as unidades","nature":"pontual","urgency":"medium",...}` — **campo `unit_id` ausente** |
| Response body | `{"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"maintenance_tickets\""}` |
| Console | `[error] Failed to load resource: the server responded with a status of 403 (Forbidden)` |
| UI | Toast "Erro ao abrir chamado" aparece e some; modal **permanece aberto** (não fecha). `err.code` nunca exibido. |

**Confirmação:** o código `42501` (RLS violation) e HTTP 403 chegam diretamente do PostgREST/Kong para o cliente, sem conversão de código no caminho. A análise estática (Seção 2) está correta em todas as partes.

### Teste 1 — INSERT como `authenticated` (mesmo papel da PostgREST)

```sql
SET ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '<uuid super_admin>';
INSERT INTO public.maintenance_tickets (title, nature, urgency, opened_by)
VALUES ('Repro test', 'pontual', 'medium', '<uuid>');
```

Saída:
```
ERROR:  new row violates row-level security policy for table "maintenance_tickets"
```

**Código: `42501` (RLS violation), não `23502` (NOT NULL).** O motivo é a ordem de avaliação: a policy `unit_insert_tickets WITH CHECK (unit_id = ANY(get_user_unit_ids()))` é avaliada antes do NOT NULL e, com `unit_id IS NULL`, `NULL = ANY(array)` retorna NULL → tratado como falso pela RLS → erro 42501 dispara primeiro.

### Teste 2 — mesmo INSERT como `postgres` (BYPASSRLS)

```
ERROR:  null value in column "unit_id" of relation "maintenance_tickets" violates not-null constraint
DETAIL:  Failing row contains (..., null, Repro NOT NULL test, ...)
```

Código `23502`. Confirma que a constraint NOT NULL EXISTE e dispararia se a RLS não interceptasse antes.

### Implicações para o relatório

- A análise estática original previa `23502`. O código real recebido pelo cliente PostgREST é **`42501`**. A causa-raiz (frontend manda `undefined` em `unit_id` quando `activeUnitId = null`) é a mesma — só o caminho de falha no banco é outro.
- A função `mapPgError` proposta na Fase 1.2 precisa lidar com **`42501`** como o código primário neste fluxo. Discriminador prático: se `activeUnitId === null` na hora do INSERT, traduzir 42501 como "Selecione uma unidade antes de abrir o chamado". Se `activeUnitId` está setado e o 42501 ainda dispara, traduzir como "Você não tem permissão para abrir chamados nesta unidade".

---

## 1. Inventário do módulo (Tarefa 1)

### 1.1 Rotas e páginas

| Caminho | Arquivo | Tipo | Guard |
|---|---|---|---|
| `/manutencao` | [src/app/(auth)/manutencao/page.tsx](../src/app/(auth)/manutencao/page.tsx) | redirect → `/manutencao/chamados` | `MAINTENANCE_MODULE_ROLES` (layout) |
| `/manutencao/dashboard` | [dashboard/page.tsx](../src/app/(auth)/manutencao/dashboard/page.tsx) | painel gerencial (KPIs, gráficos Recharts) | `MAINTENANCE_ADMIN_ROLES` (layout próprio) |
| `/manutencao/chamados` | [chamados/page.tsx](../src/app/(auth)/manutencao/chamados/page.tsx) | listagem + KPIs + modal "Novo Chamado" | `MAINTENANCE_MODULE_ROLES` |
| `/manutencao/chamados/[id]` | [chamados/[id]/page.tsx](../src/app/(auth)/manutencao/chamados/[id]/page.tsx) | detalhe do chamado | `MAINTENANCE_MODULE_ROLES` (herdado) |
| `/manutencao/configuracoes` | [configuracoes/page.tsx](../src/app/(auth)/manutencao/configuracoes/page.tsx) | setores, categorias, itens, SLA | `MAINTENANCE_ADMIN_ROLES` (layout próprio) |
| `/manutencao/nova` | redirect legacy | redireciona `/manutencao/chamados` | — |
| `/manutencao/[id]` | redirect legacy | redireciona `/manutencao/chamados` | — |
| `/manutencao/[id]/editar` | redirect legacy | redireciona `/manutencao/chamados` | — |
| `/manutencao/fornecedores/[id]` | redirect legacy | redireciona `/prestadores` | — |
| `/manutencao/fornecedores/novo` | redirect legacy | redireciona `/prestadores/novo` | — |

Existem 5 rotas legacy que apenas redirecionam — sobrevivência da migração que renomeou o módulo. Servem como "pegadinhas" de URLs antigos compartilhados.

### 1.2 Telas relacionadas (não estão dentro de `/manutencao` mas servem ao mesmo fluxo)

| Rota | Função |
|---|---|
| `/equipamentos`, `/equipamentos/[id]`, `/equipamentos/novo` | CRUD de equipamentos. Usados como entidade no modal de Novo Chamado e na vinculação chamado↔equipamento. |
| `/prestadores`, `/prestadores/[id]`, `/prestadores/novo` | CRUD de prestadores. Usados no detalhe do chamado para registrar execução externa. **Também usados pelo módulo Eventos** via `event_providers` (decoração, buffet, música). |
| `/atas` | Atas de reunião — não tem relação funcional com manutenção; agrupada no grupo "Operações" da sidebar. |
| `/relatorios` | Relatórios gerais — agrupada em Operações. |

### 1.3 Componentes do fluxo "Novo Chamado"

| Arquivo | Papel |
|---|---|
| [ticket-form-modal.tsx](../src/components/features/maintenance/ticket-form-modal.tsx) | Modal de criação; chama `useCreateTicket(payload)` |
| [ticket-card.tsx](../src/components/features/maintenance/ticket-card.tsx) | Card de chamado na listagem + helpers `URGENCY_CONFIG / STATUS_CONFIG / NATURE_CONFIG` |
| [ticket-kanban-board.tsx](../src/components/features/maintenance/ticket-kanban-board.tsx) | View Kanban da listagem |
| [photo-section.tsx](../src/components/features/maintenance/photo-section.tsx) | Upload de fotos no detalhe |
| [history-tab.tsx / history-timeline.tsx](../src/components/features/maintenance/history-tab.tsx) | Timeline de status |
| [costs-tab.tsx / cost-card.tsx / cost-form-modal.tsx / reject-cost-modal.tsx / quick-cost-sheet.tsx](../src/components/features/maintenance/costs-tab.tsx) | Custos por execução (fluxo de aprovação) |

> ⚠️ Há também `maintenance-form.tsx`, `maintenance-card.tsx`, `maintenance-timeline.tsx`, `maintenance-status-badge.tsx`, `maintenance-type-badge.tsx`, `maintenance-filters.tsx`, `maintenance-kpis.tsx`, `maintenance-charts.tsx`, `maintenance-tabs.tsx`, `overdue-banner.tsx`, `kanban-board.tsx`, `kanban-card.tsx`, `sla-card.tsx`, `quick-actions-bar.tsx`, `status-bottom-sheet.tsx`, `preventive-schedule.tsx`. Vários deles são do módulo **legado** de manutenção (`maintenance_orders`) que foi substituído pelo de chamados em 2026 e ainda não foi removido. Ver §6.7 (dead code).

### 1.4 Tabelas do banco

#### Tabelas principais (migration [031](../supabase/migrations/031_maintenance_module_tables.sql))

| Tabela | Descrição | `unit_id` | RLS |
|---|---|---|---|
| `maintenance_tickets` | chamados (raiz) | `NOT NULL` FK `units` | unit-based **sem** `is_global_viewer()`, sem `check_permission` |
| `maintenance_sectors` | setores por unidade | `NOT NULL` | idem |
| `maintenance_categories` | categorias (cor/ícone) | `NOT NULL` | idem |
| `maintenance_items` | itens/locais (FK sector_id) | `NOT NULL` | idem |
| `maintenance_sla` | SLA por urgência | `NOT NULL` UNIQUE `(unit_id, urgency_level)` | idem |
| `maintenance_executions` | execuções (internas + externas) | herda via `ticket_id` | idem |
| `maintenance_ticket_photos` | anexos | herda via `ticket_id` | idem |
| `maintenance_status_history` | timeline de status | herda via `ticket_id` | idem |

#### Tabelas de fornecedor/custo (migration [017](../supabase/migrations/017_maintenance_expansion.sql))

| Tabela | RLS |
|---|---|
| `maintenance_suppliers` | unit-based **com** `is_global_viewer()` E `check_permission(auth.uid(), 'maintenance', …)` |
| `supplier_contacts` | via parent supplier (mesma combinação) |
| `supplier_documents` | via parent supplier |
| `maintenance_costs` | unit-based + check_permission |

Esta migration introduziu uma camada de RLS **diferente** da migration 031 — com `is_global_viewer()` e role-gate via `check_permission()`. As tabelas criadas em 031 ficaram defasadas.

> ⚠️ **ATUALIZAÇÃO 2026-05-21 (Fase 3.2):** as 4 tabelas da migration 017
> (`maintenance_suppliers`, `supplier_contacts`, `supplier_documents`,
> `maintenance_costs`) **não existem mais** — a migration 032
> (`032_maintenance_migrate_legacy.sql`, linhas 195–206) fez
> `DROP TABLE … CASCADE` nelas + `maintenance_orders` ao substituir o
> módulo legado. Verificado via `pg_class` em produção. A "dívida F7"
> (código EN `'maintenance'` nessas policies) foi quitada por essa
> remoção, não está pendente. As linhas dessas 4 tabelas na tabela
> acima e a §4.2.3 descrevem estado pré-032 e estão desatualizadas.

#### Tabelas auxiliares (módulo Equipamentos e Prestadores)

| Tabela | Origem | RLS |
|---|---|---|
| `equipment` | migration [012](../supabase/migrations/012_fase3_equipment.sql) | SELECT/UPDATE/DELETE: `is_global_viewer() OR unit_id = ANY(get_user_unit_ids())`. **INSERT só `unit_id = ANY(...)` sem fallback global.** |
| `equipment_categories` | migration 012 | idem |
| `service_providers` | migration [021](../supabase/migrations/021_service_providers.sql) + atualizada por [077](../supabase/migrations/077_rls_policies_module_codes_pt_br.sql) | SELECT/UPDATE/DELETE: `check_permission(..., 'prestadores', ...) AND (is_global_viewer() OR unit_id = ANY(...))`. INSERT sem fallback global. |
| `service_categories`, `provider_contacts`, `provider_services`, `provider_documents` | migration 021 | idem |
| `event_providers` | módulo Eventos | (não auditada aqui — fora do escopo) |

### 1.5 RPCs e funções

| Função | Onde | Usada em |
|---|---|---|
| `get_user_unit_ids()` | migration 010 | RLS de todas as tabelas do módulo |
| `is_global_viewer()` | migration 010 (atualizada por 068) | RLS de equipment, service_providers, maintenance_suppliers — **não** está em maintenance_tickets/sectors/categories/items/sla/executions |
| `check_permission(uid, module, action)` | RBAC (migration 011 + 076 + 077) | maintenance_suppliers, maintenance_costs, service_providers (após 077) |

Não há RPC dedicada para chamados (CRUD vai direto na tabela). O dashboard usa uma API HTTP (`/api/maintenance/stats` e `/api/maintenance/history-summary`) em vez de RPC.

### 1.6 Hooks TanStack Query

| Hook | Função |
|---|---|
| [`use-tickets.ts`](../src/hooks/use-tickets.ts) | `useTickets`, `useTicket`, `useCreateTicket`, `useUpdateTicketStatus`, `useUpdateTicketEquipment`, `useAddExecution`, `useUpdateExecution`, `useUploadTicketPhoto`, `useApproveCost` |
| [`use-sectors.ts`](../src/hooks/use-sectors.ts) | `useSectors`, `useCreateSector`, `useUpdateSector`, `useDeleteSector` |
| [`use-maintenance-categories.ts`](../src/hooks/use-maintenance-categories.ts) | CRUD de categorias |
| [`use-maintenance-items.ts`](../src/hooks/use-maintenance-items.ts) | CRUD de itens |
| [`use-maintenance-sla.ts`](../src/hooks/use-maintenance-sla.ts) | `useMaintenanceSla`, `useUpsertMaintenanceSla` |
| [`use-maintenance-dashboard.ts`](../src/hooks/use-maintenance-dashboard.ts) | `useMaintenanceDashboardStats`, `useMaintenanceTicketsTrend`, `useMaintenanceTicketsPeriod` |
| [`use-equipment.ts`](../src/hooks/use-equipment.ts) | CRUD de equipamentos |
| [`use-providers.ts`](../src/hooks/use-providers.ts) | CRUD de prestadores |
| [`use-maintenance.ts`](../src/hooks/use-maintenance.ts) | **LEGADO** — operações sobre `maintenance_orders` (substituída pelos chamados) |
| [`use-maintenance-costs.ts`](../src/hooks/use-maintenance-costs.ts) | custos por execução (com workflow de aprovação) |
| [`use-suppliers.ts`](../src/hooks/use-suppliers.ts) | **LEGADO** — `maintenance_suppliers` (substituído por service_providers) |

---

## 2. Diagnóstico do erro "Erro ao abrir chamado" com seletor em "Todas as unidades" (Tarefa 2)

### Reprodução

Cenário: usuário logado como `super_admin` (ou outra role com acesso ao módulo), seletor global de unidade em "Todas as unidades" (`activeUnitId = null` no `unit-store`), abre `/manutencao/chamados`, clica em **Novo Chamado**, preenche título e clica em **Abrir Chamado**.

**Resultado real (confirmado em 2026-05-21 via psql E browser, ver Seção 0):**
- Toast genérico: "Erro ao abrir chamado" (sem detalhe).
- Console do navegador: `[error] Failed to load resource: the server responded with a status of 403 (Forbidden)`.
- Resposta de rede: HTTP 403 com `{"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"maintenance_tickets\""}`.
- Payload enviado: campo `unit_id` **ausente** — confirma que `activeUnitId ?? undefined` é omitido na serialização JSON do PostgREST client.

### Caminho de código (do clique ao erro)

1. **Componente**: [src/components/features/maintenance/ticket-form-modal.tsx:118–138](../src/components/features/maintenance/ticket-form-modal.tsx#L118-L138)
   `handleSubmit` monta `payload: TicketInsert` (sem campo `unit_id`) e chama `createTicket.mutate(payload)`.
2. **Hook (mutation)**: [src/hooks/use-tickets.ts:155–186](../src/hooks/use-tickets.ts#L155-L186) — `useCreateTicket`
   Linha **169**: `unit_id: activeUnitId ?? undefined`. Quando `activeUnitId === null` ("Todas"), `undefined` é serializado pelo PostgREST como ausência de campo → coluna recebe NULL.
3. **DB (RLS WITH CHECK dispara primeiro)**: [031:227–228](../supabase/migrations/031_maintenance_module_tables.sql#L227-L228) — a policy `unit_insert_tickets WITH CHECK (unit_id = ANY(get_user_unit_ids()))` é avaliada antes da NOT NULL. Com `unit_id IS NULL`, a expressão `NULL = ANY(array)` retorna NULL, tratada como falso → erro `42501`. **Confirmado empiricamente via psql na Seção 0.** Detalhe adicional: a policy **não tem fallback `is_global_viewer()`** — mesmo após Fase 2 (UI mandando `unit_id`), um global viewer cujo `user_units` não cobre a unidade alvo continuaria recebendo 42501.
4. **DB (NOT NULL nunca alcançada)**: [supabase/migrations/031_maintenance_module_tables.sql:58](../supabase/migrations/031_maintenance_module_tables.sql#L58) — `unit_id uuid NOT NULL REFERENCES public.units(id)`. A constraint existe e dispararia `23502` se a RLS não interceptasse antes (verificado rodando o INSERT como `postgres`, ver Seção 0 Teste 2).
5. **UI (silencia o erro)**: [use-tickets.ts:184](../src/hooks/use-tickets.ts#L184) — `onError: () => toast.error('Erro ao abrir chamado')`. O `err.message`/`err.code` é descartado. Por isso o sintoma sempre apareceu como "toast genérico".

### Causa-raiz — duas camadas

**Camada 1 — Frontend (causa imediata):** o fluxo do modal não pede uma unidade ao usuário e usa cegamente o `activeUnitId` do store global. Quando o seletor está em "Todas", o INSERT vai sem `unit_id`. **Confirmado por arquivo:linha (use-tickets.ts:169).**

**Camada 2 — Backend (causa estrutural):** mesmo após resolver a camada 1, a RLS de `maintenance_tickets` é mais restritiva que o resto do módulo. Não tem `is_global_viewer()` em SELECT (linha 226), INSERT (linha 228) nem UPDATE (linha 230). Compare com `equipment` (012:43–45 tem `is_global_viewer()` no SELECT), `service_providers` (077:217 idem) e `maintenance_suppliers` (017:172–176 idem). É uma assimetria do módulo, herdada da migration 031.

### Hipótese do prompt — confirmada

> "O fluxo foi construído antes da multiunidade e espera um unit_id único; quando a unidade ativa é 'todas' (null ou array), o insert ou a RLS falha."

Confirmada parcialmente. A análise temporal das migrations confirma: 031 (2026, módulo de chamados) foi criado **depois** da migration 010 (`get_user_unit_ids` + `is_global_viewer`, em 2025), mas **não** adotou `is_global_viewer()` nas suas policies — provavelmente copiada de uma migration anterior à fase 2.5 sem refresh. O componente sempre passou `unit_id = activeUnitId` como único valor e nunca tratou o caso "Todas".

---

## 3. Auditoria de multiunidade (Tarefa 3)

### 3.1 Coluna `unit_id` — presente em todas as tabelas do módulo

| Tabela | `unit_id NOT NULL` | Fonte da política |
|---|---|---|
| `maintenance_tickets` | ✅ | 031 |
| `maintenance_sectors` | ✅ | 031 |
| `maintenance_categories` | ✅ | 031 |
| `maintenance_items` | ✅ | 031 |
| `maintenance_sla` | ✅ | 031 |
| `maintenance_executions` | herda via `ticket_id` | 031 |
| `maintenance_ticket_photos` | herda via `ticket_id` | 031 |
| `maintenance_status_history` | herda via `ticket_id` | 031 |
| `maintenance_suppliers`, `supplier_contacts/documents`, `maintenance_costs` | ✅ | 017 |
| `equipment`, `equipment_categories` | ✅ | 012 |
| `service_providers` e auxiliares | ✅ | 021 |

### 3.2 RLS por escopo de unidade — comparação

| Tabela | SELECT tem `is_global_viewer()` | INSERT tem `is_global_viewer()` | role-gate `check_permission` |
|---|---|---|---|
| `maintenance_tickets`, `_sectors`, `_categories`, `_items`, `_sla`, `_executions`, `_photos`, `_status_history` | ❌ | ❌ | ❌ |
| `maintenance_suppliers`, `_costs`, `supplier_contacts/documents` | ✅ | ❌ (só read paths) | ✅ (`'maintenance'`, via CASE EN→PT-BR) |
| `equipment`, `equipment_categories` | ✅ | ❌ | ❌ |
| `service_providers` (e auxiliares) | ✅ | ❌ | ✅ (`'prestadores'`) |

Padrão geral do projeto (visto em event/checklists/atas): SELECT tem fallback global, INSERT requer membership na unit. O módulo de chamados **inteiro** (linhas da migration 031) está fora deste padrão.

### 3.3 Fluxo "Todas as unidades" — comportamento atual × esperado

| Ponto | Atual | Esperado |
|---|---|---|
| Listagem de chamados | `useTickets` faz `if (activeUnitId) q = q.eq('unit_id', ...)` — quando null, não filtra, e a RLS restringe ao escopo do usuário. **Mas** como a RLS de tickets não tem `is_global_viewer()`, super_admin/diretor que não estão explicitamente em `user_units` de uma unidade não veem os chamados dela. | Quando "Todas" + global viewer, deveria retornar todos os chamados de todas as unidades. |
| KPIs (`/manutencao/chamados`) | Calculados client-side em cima da listagem → mesma limitação. | Idem. |
| Dashboard (`/manutencao/dashboard`) | API `/api/maintenance/stats` retorna **400** se `unit_id` não vier na querystring ([route.ts:43–45](../src/app/api/maintenance/stats/route.ts#L43-L45)). | Aceitar `unit_id` ausente como "agregar todas as unidades do usuário" para roles globais; para roles não-globais, deveria forçar a unidade do `user_units` ou retornar 400 com mensagem clara. |
| Modal Novo Chamado | Tenta INSERT com `unit_id = undefined` → erro 23502. | Quando seletor global está em "Todas", o modal deveria forçar a escolha de uma unidade explícita (campo `Unidade` obrigatório no formulário) antes de habilitar o botão "Abrir Chamado". |
| Setores/Categorias/Itens/SLA (Configurações) | `useCreateSector`/`useCreate*` usa `unit_id: activeUnitId!` (não-null assertion) ou `unit_id: activeUnitId ?? undefined`. Tela `/manutencao/configuracoes` é restrita a `MAINTENANCE_ADMIN_ROLES`, mas mesmo um diretor com "Todas" selecionado quebra ao tentar criar setor. | Mesma regra do modal — exigir unidade explícita ou desabilitar criação enquanto "Todas" estiver ativo. |

### 3.4 Outras mutations afetadas pelo mesmo padrão (no módulo)

Padrão `unit_id: activeUnitId!` / `?? undefined` encontrado em (`grep` em `src/hooks`):

- `use-tickets.ts:169` — INSERT em `maintenance_tickets`
- `use-sectors.ts:45` — INSERT em `maintenance_sectors`
- `use-maintenance-categories.ts:77` — INSERT em `maintenance_categories`
- `use-maintenance-items.ts:78` — INSERT em `maintenance_items`
- `use-maintenance-sla.ts:70` — UPSERT em `maintenance_sla`
- `use-maintenance.ts:163` — INSERT em `maintenance_orders` (legado)
- `use-suppliers.ts:118` — INSERT em `maintenance_suppliers` (legado)
- `use-equipment.ts:114` — INSERT em `equipment`
- `use-providers.ts:170` — INSERT em `service_providers`
- `use-service-categories.ts:65` — INSERT em `service_categories`

Mesmo padrão sistêmico fora do módulo: `use-checklists.ts` (4 ocorrências), `use-events.ts`, `use-checklist-recurrences.ts`, `use-checklist-comments.ts`. Este diagnóstico foca em Manutenção, mas a correção arquitetural deve considerar normalizar o padrão para todo o projeto.

---

## 4. Auditoria de RBAC (Tarefa 4)

### 4.1 Pontos em conformidade com o padrão

| Item | Conformidade |
|---|---|
| Guard de layout `/manutencao` usa `requireRoleServer(MAINTENANCE_MODULE_ROLES)` | ✅ |
| Guard de `/manutencao/dashboard` e `/manutencao/configuracoes` usa `MAINTENANCE_ADMIN_ROLES` | ✅ |
| Detalhe do chamado usa `hasRole(profile?.role, MAINTENANCE_ADMIN_ROLES)` para `canApprove` | ✅ |
| APIs `/api/maintenance/stats` e `/api/maintenance/history-summary` usam `requireRoleApi(MAINTENANCE_MODULE_ROLES)` | ✅ |
| Constantes em `@/config/roles.ts`, sem literais inline em `.tsx`/`.ts` | ✅ |
| Layout pai protege todas as sub-rotas (`chamados`, `chamados/[id]`, `nova` etc.) | ✅ |

### 4.2 Fora do padrão (achados)

#### 4.2.1 RLS sem role-gate em 8 tabelas

`maintenance_tickets` e as 7 tabelas auxiliares da migration 031 **não chamam `check_permission()`**. Isso significa que **qualquer role com membership em `user_units` daquela unidade**, independentemente de estar em `MAINTENANCE_MODULE_ROLES`, pode CRUD chamados via PostgREST direto. Como a maioria do staff tem `user_units` para uma unidade (é o normal), um `freelancer`/`decoracao`/`vendedora` poderia executar `POST /rest/v1/maintenance_tickets` direto na API e o INSERT passaria — o guard de layout protege a UI, mas não a API. Comparação:

- `maintenance_suppliers` (017): tem `check_permission(auth.uid(), 'maintenance', 'view')`
- `service_providers` (077): tem `check_permission(auth.uid(), 'prestadores', …)`
- `maintenance_tickets` (031): **não tem** check_permission

**Severidade:** alta (vulnerabilidade defense-in-depth — UI bloqueada, API aberta para roles com membership de unidade).

#### 4.2.2 RLS sem `is_global_viewer()` em 8 tabelas

Mesmas tabelas — diretor/super_admin sem `user_units` explícito da unidade alvo não conseguem ler nem inserir. Ver §3.2.

#### 4.2.3 Inconsistência do módulo

A política `maintenance_suppliers` chama `check_permission(..., 'maintenance', ...)` (código EN). Funciona pelo CASE EN→PT-BR de `check_permission()` (migration 076 / nota do CLAUDE.md), mas é dívida técnica — deveria estar em PT-BR (`'manutencao'`) consistente com 077. Esta tabela não foi tocada por 077.

#### 4.2.4 Verificação de papel client-side

[`/manutencao/chamados/[id]/page.tsx`](../src/app/(auth)/manutencao/chamados/[id]/page.tsx#L590) — `canApprove = hasRole(profile?.role, MAINTENANCE_ADMIN_ROLES)` controla o botão "Aprovar custo". Sem RLS de role correspondente no DB, é UI-only — um técnico com acesso ao módulo conseguiria executar `UPDATE maintenance_executions SET cost_approved = true` direto via PostgREST.

---

## 5. Arquitetura da navegação (Tarefa 5)

### 5.1 Acoplamento real

**Equipamentos** — referenciado em:
- `use-equipment.ts` (CRUD próprio)
- `use-tickets.ts` (`equipment_id` no chamado)
- `use-maintenance.ts` (LEGADO — não usado no UI ativo)
- Onboarding (`use-onboarding.ts` apenas conta), Audit log (filtro), Command palette (busca global)

Conclusão: Equipamentos só atende o fluxo de Manutenção. Não tem outro módulo de negócio dependente.

**Prestadores** — referenciado em:
- `use-providers.ts`, `use-service-providers-list.ts`, `use-provider-kpis.ts`, `use-provider-ratings.ts` (módulo próprio)
- `use-event-providers.ts` (**vínculo prestador↔evento** — buffet, música, decoração)
- `use-events.ts` (eventos relacionados)
- `use-tickets.ts` (execução externa em chamado)
- Cron `check-provider-alerts`, `lib/notifications.ts`

Conclusão: Prestadores é **transversal** — atende tanto Manutenção quanto Eventos.

### 5.2 Roles que veem cada item

| Item | Roles | Caso |
|---|---|---|
| Manutenção | super_admin, diretor, gerente, manutencao | 4 roles (MAINTENANCE_MODULE_ROLES) |
| Equipamentos | super_admin, diretor, gerente, manutencao | 4 roles (idêntico) |
| Prestadores | super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao | 8 roles (PRESTADORES_ACCESS_ROLES) |

### 5.3 Recomendação

**Manter Prestadores no topo da seção Operações.** Aninhá-lo dentro de Manutenção restringe perceptualmente o item a 4 roles, mas o item é exposto a 8 (vendedora, pos_vendas, decoracao, financeiro não pertencem ao módulo de Manutenção). Aninhar seria enganoso, pois quando um `vendedora` clica em "Manutenção" expandir o submenu não faz sentido — ele não tem acesso à manutenção.

**Equipamentos:** opção neutra. Roles idênticas a Manutenção, então o público não sofreria. Vantagem: limpa a sidebar (3 itens diretos em Operações em vez de 5). Custo: um clique a mais para chegar à listagem; passa a 2 níveis. Trade-off válido nos dois sentidos. **Sem recomendação forte** — depende da preferência do Bruno. Manter ao lado de Manutenção (status quo) é defensável. Caso queira aninhar, sugiro a ordem: Dashboard / Chamados / Equipamentos / Configurações.

**Observação adicional:** `Atas` e `Relatórios` estão na seção "Operações" sem relação funcional clara com o resto da seção. Atas é multimódulo; Relatórios é para `BI_ACCESS_ROLES` (super_admin/diretor). Fora do escopo desta auditoria, mas o agrupamento pode ser repensado em uma rodada futura.

---

## 6. Outras descobertas (Tarefa 6)

### 6.1 Toast genérico esconde a causa do erro

[use-tickets.ts:184](../src/hooks/use-tickets.ts#L184) — `onError: () => toast.error('Erro ao abrir chamado')`. O objeto `err` (com `code`, `details`, `message`) é descartado. Mesmo padrão em quase todas as mutations do módulo (`use-sectors`, `use-equipment`, `use-providers` etc.).

**Severidade:** baixa, mas foi **fator contribuinte** do bug ficar invisível. Diagnóstico anterior teria sido trivial se o toast mostrasse "código 23502: null value in column unit_id".

**Fix:** padronizar uma rotina central tipo `mapPgError(err) → string amigável` que (a) faz log em `console.error` com `err` cru, (b) traduz `23502`/`42501`/`23505` em mensagens distintas.

### 6.2 Dashboard quebra com "Todas as unidades" (HTTP 400)

[`/api/maintenance/stats`](../src/app/api/maintenance/stats/route.ts#L43-L45) — exige `unit_id` na querystring; 400 quando ausente. O hook `useMaintenanceDashboardStats` ([use-maintenance-dashboard.ts:23–28](../src/hooks/use-maintenance-dashboard.ts#L23-L28)) só anexa o param se `activeUnitId` está setado. "Todas" → 400 → erro genérico no painel.

**Severidade:** média (afeta diretor/super_admin no uso natural).

### 6.3 Rotas legadas redirect — manutenção/limpeza

5 rotas legacy fazem apenas `redirect(...)`:
- `/manutencao/nova`, `/manutencao/[id]`, `/manutencao/[id]/editar`
- `/manutencao/fornecedores/[id]`, `/manutencao/fornecedores/novo`

**Severidade:** baixa. Remover quando não houver mais links externos apontando — provavelmente já seguro. Ou agendar remoção em PR de cleanup.

### 6.4 Hook `use-maintenance.ts` e `use-suppliers.ts` legados

`use-maintenance.ts` (CRUD em `maintenance_orders`) e `use-suppliers.ts` (CRUD em `maintenance_suppliers` antiga) — substituídos por `use-tickets` e `use-providers` mas continuam no repositório. Mesmo problema dos componentes legados em §1.3 (`maintenance-form.tsx`, `maintenance-card.tsx`, `maintenance-timeline.tsx` etc.).

**Severidade:** baixa. Cleanup recomendado, mas precisa de auditoria de uso para não quebrar referências residuais. Fora do escopo deste fix.

### 6.5 Reset de form com `setForm(INITIAL)` em `useEffect`

[ticket-form-modal.tsx:95–102](../src/components/features/maintenance/ticket-form-modal.tsx#L95-L102) — o reset acontece em `useEffect`. Compare com o padrão `key={new-${formInstance}}` adotado no Checklist Comercial (CLAUDE.md, débito 1.5b) que era considerado mais robusto. Atualmente parece funcionar, mas o eslint-disable na linha 97 já indica fricção com a regra `react-hooks/set-state-in-effect`.

**Severidade:** baixa, qualidade.

### 6.6 KPIs do dashboard de listagem de chamados rodam client-side

[chamados/page.tsx:149–178](../src/app/(auth)/manutencao/chamados/page.tsx#L149-L178) — carrega `useTickets({})` com `pageSize: 500` para calcular 4 KPIs em memória. Se ultrapassar 500, KPIs ficam imprecisos. Não há sinalização desse limite.

**Severidade:** baixa (Cachola opera ~3 unidades, dezenas de chamados/mês; raramente atinge 500). Mas é dívida estrutural — uma RPC `get_maintenance_kpis_for_unit(p_unit_id UUID)` resolveria.

### 6.7 Dead code de componentes do módulo legado

Aproximadamente 16 componentes em `src/components/features/maintenance/` referenciam o fluxo antigo de `maintenance_orders` (não chamados). Auditoria detalhada em PR separado de cleanup.

### 6.8 Inconsistência entre filtros visíveis e filtros enviados

Listagem de chamados tem filtros de Setor / Urgência / Natureza no header e pills de Status. Todos são aplicados client-side em [chamados/page.tsx:191–221](../src/app/(auth)/manutencao/chamados/page.tsx#L191-L221), ignorando o suporte que `useTickets` já tem para filtrar server-side ([use-tickets.ts:87–93](../src/hooks/use-tickets.ts#L87-L93)). Inconsistente. Se KPIs precisam de "tudo" → server filtra apenas por unit; se listagem precisa filtrar → client-side aplica.

**Severidade:** baixa, performance.

### 6.9 RLS de `maintenance_status_history` só permite SELECT — sem INSERT policy

[031:254–258](../supabase/migrations/031_maintenance_module_tables.sql#L254-L258) tem apenas `unit_read_history`. O INSERT é feito pelo trigger `track_ticket_status` ([031:189–191](../supabase/migrations/031_maintenance_module_tables.sql#L189-L191)) que é SECURITY DEFINER, então funciona — mas a tabela é "read-only" via cliente autenticado normal. Não é bug; apenas é confuso ler a migration sem a nota.

**Severidade:** nenhuma (intencional, mas merece comentário SQL na migration).

### 6.10 Hipótese sobre o módulo de manutenção legacy

Existem 2 fluxos: (a) o atual, baseado em `maintenance_tickets` (chamados) — UI atual ativa, (b) o antigo, baseado em `maintenance_orders` — rotas legacy + hooks/componentes ainda presentes. Possíveis dados órfãos em `maintenance_orders` em produção que nunca foram migrados para `maintenance_tickets`. **Verificação SQL recomendada antes do cleanup**: `SELECT COUNT(*) FROM maintenance_orders;` na VPS.

**Severidade:** depende. Se houver dados, é alta (perda); se vazia, é baixa (cleanup trivial).

---

## 7. Resumo dos achados com severidade

| # | Achado | Severidade | Causa-raiz | Esforço | Risco |
|---|---|---|---|---|---|
| F1 | Modal Novo Chamado falha em "Todas" (42501 / RLS violation — confirmado browser) | **ALTA** | use-tickets.ts:169 + ticket-form-modal.tsx | P | Baixo (escopo isolado) |
| F2 | RLS de `maintenance_tickets` sem `is_global_viewer()` | **ALTA** | 031 — 8 tabelas | M | Médio (precisa nova migration + regressão de policies) |
| F3 | RLS sem `check_permission` em 8 tabelas → bypass via API direta | **ALTA** | 031 sem role-gate | M | Médio (mesma migration que F2) |
| F4 | Toast genérico esconde código do erro | Baixa | onError: () => toast.error('...') | P | Nenhum |
| F5 | Dashboard `/manutencao/dashboard` quebra com "Todas" | Média | API exige unit_id | P | Baixo |
| F6 | Configurações idem (sectors/categories/items/sla) | Média | mesmas mutations não-null assertion | P | Baixo |
| F7 | maintenance_suppliers usa `'maintenance'` (EN) — dívida | Baixa | 017 não foi atualizado por 077 | P | Baixo |
| F8 | KPIs client-side limitados a 500 chamados | Baixa | useTickets({}) com pageSize=500 | M | Baixo |
| F9 | Filtros client-side ignorando suporte server-side | Baixa | inconsistência em chamados/page.tsx | P | Baixo |
| F10 | Rotas legacy ainda no repositório | Baixa | sobra de migração | P | Baixo |
| F11 | use-maintenance.ts / use-suppliers.ts / componentes legados | Baixa | dead code | M (auditoria antes) | Médio (referências residuais) |
| F12 | maintenance_orders pode ter dados órfãos | Depende | migração não completada | — | Depende |

Legenda esforço: P (≤1 dia), M (1–3 dias), G (>3 dias).

---

## 8. Ordem de execução proposta (em fases)

### Fase 1 — Reproduzir + correção de UX (rápido)
**Checkpoint:** Bruno aprova após screenshot da reprodução local + diff do fix.

- 1.1 ~~Reproduzir o erro **em browser** (não só psql) logado como super_admin com "Todas" selecionado.~~ **✅ CONFIRMADO em 2026-05-21** — ver Seção 0 (Validação browser). Network tab: HTTP 403, body `{"code":"42501",...}`, `unit_id` ausente no payload. Console: `[error] Failed to load resource: 403`. Modal permanece aberto. Hipótese e análise estática 100% confirmadas.
- ~~1.2 Substituir o toast genérico em `useCreateTicket` (e idealmente em todas as mutations do módulo) por uma função `mapPgError(err, context)` que diferencia:~~
  - ~~`42501` com `context.activeUnitId === null` → "Selecione uma unidade antes de abrir o chamado" (caso do bug atual)~~
  - ~~`42501` com `context.activeUnitId !== null` → "Você não tem permissão para abrir chamados nesta unidade"~~
  - ~~`23502` → "Campo obrigatório faltando (contate o suporte)" — guard de defensive coding caso a RLS um dia mude~~
  - ~~`23505` → "Já existe um registro com esses dados"~~
  - ~~outros → mensagem genérica + `console.error` do `err` cru~~
  **✅ IMPLEMENTADO em 2026-05-21** — `src/lib/errors/map-pg-error.ts` criado com `mapPgError(err, context, label)`. Browser confirmou toast "Selecione uma unidade antes de realizar esta ação." + console `[TICKET_CREATE] {code:"42501",...}`. **Aguardando aprovação do Bruno para commit.**
- ~~1.3 Adicionar `console.error('TICKET_INSERT_ERROR', err)` antes do `toast.error` em todas as mutations do módulo.~~
  **✅ IMPLEMENTADO em 2026-05-21** — `mapPgError` sempre faz `console.error(\`[${label}]\`, err)` antes de retornar a mensagem. Aplicado nas 9 mutations ativas: `use-tickets`, `use-sectors`, `use-maintenance-categories`, `use-maintenance-items`, `use-maintenance-sla`, `use-equipment`, `use-providers`, `use-service-categories`, `use-maintenance-costs`. `use-maintenance.ts` e `use-suppliers.ts` (legado) NÃO tocados. **Aguardando aprovação do Bruno para commit.**

> Esta fase **não corrige** o bug funcional. Apenas torna o erro visível para validar a hipótese e ajudar diagnóstico futuro. Pode ser entregue isoladamente.

> **✅ DEPLOYED em 2026-05-21** — merge commit `1de05f7`, PR #38, tag `v1.11.2`. Deploy to Production: success (4m52s). VPS: pm2 online, `package.json v1.11.2` confirmado. **Aguardando validação visual do Bruno em produção.**

### Fase 2 — Fix do modal "Novo Chamado" (resolve o bug funcional)
**Checkpoint:** Bruno aprova após Bruno testar como super_admin em "Todas" e como gerente em uma unidade só.

- 2.1 Adicionar campo `Unidade` ao `TicketFormModal`. Visível e obrigatório quando `activeUnitId === null` (ex.: super_admin/diretor em "Todas"). Quando `activeUnitId` está definido, esconder o campo e usar o valor do store (comportamento atual).
- 2.2 Validar `unit_id` no `validate()` do form. Bloquear submit sem unidade.
- 2.3 No `useCreateTicket`, aceitar `unit_id` no payload e passá-lo explicitamente ao INSERT — remover a assertion `activeUnitId ?? undefined`.
- 2.4 **Refiltrar dropdowns dependentes pelo unit_id do form (não pelo store).** Quando o usuário escolhe a unidade no campo do form, `Setor`, `Categoria`, `Item/Local` e `Equipamento` devem recarregar filtrados por aquele `unit_id`. Hoje os hooks (`useSectors`, `useMaintenanceCategories`, `useMaintenanceItems`, `useEquipment`) usam o `activeUnitId` do store: com "Todas", listam entradas de todas as unidades misturadas e o super_admin poderia selecionar um setor de Pinheiros para um chamado em Moema — FK válida → DB aceita → corrupção silenciosa. Solução: aceitar `unitIdOverride` opcional nesses hooks (mesmo padrão de `useBIConversionData`) e passar `form.unit_id` do modal.
- 2.5 Replicar o padrão (campo obrigatório quando "Todas") nas telas de Configurações: criar Setor, Categoria, Item, SLA. Listagens de configuração quando em "Todas" continuam mostrando entradas de todas as unidades agregadas. **Importante:** após F2, a listagem só vai funcionar de fato quando a RLS de cada tabela for atualizada — ver Fase 3.

**Critérios de aceite (happy path) — validar visualmente após Fase 2 + Fase 3:**

- (a) super_admin com "Todas" + escolhe unidade no campo do modal → INSERT bem-sucedido, chamado criado na unidade escolhida.
- (b) super_admin com "Todas" + escolhe unidade → dropdowns Setor/Categoria/Item/Equipamento listam **apenas** entradas daquela unidade.
- (c) gerente em unidade única → campo Unidade NÃO aparece no modal, INSERT usa unidade do store.
- (d) super_admin com unidade única no seletor global → campo Unidade NÃO aparece, INSERT usa unidade do store.

> **✅ DEPLOYED em 2026-05-21** — merge commit `0610b8d`, PR #39, tag `v1.11.3`. Deploy to Production: success (5m15s). VPS: pm2 online, `package.json v1.11.3` confirmado. **Aguardando validação visual do Bruno em produção.**
>
> **Arquitetura:**
> - Hook compartilhado `src/hooks/use-form-unit-selection.ts` (`useFormUnitSelection(formUnitId)` → `{ requiresUnitSelection, effectiveUnitId, availableUnits }`)
> - Componente UI auxiliar local ao módulo: `src/components/features/maintenance/unit-picker-banner.tsx` (usado nas 4 abas de Configurações)
> - 4 hooks com `unitIdOverride` opcional: `useSectors`, `useMaintenanceCategories`, `useMaintenanceItems`, `useEquipment`, `useMaintenanceSla` (mesmo padrão de `useBIConversionData`)
> - 4 mutations aceitando `unit_id` no payload: `useCreateSector`, `useCreateMaintenanceCategory`, `useCreateMaintenanceItem`, `useUpsertMaintenanceSla`
> - `useCreateTicket` deixou de ler o store — `unit_id` obrigatório no `TicketInsert`
> - `TicketFormModal` com reset cascade em `set('unit_id', ...)` que limpa `sector_id`/`category_id`/`item_id`/`equipment_id`
> - `SlaTab` mostra apenas o `UnitPickerBanner` quando `requiresUnitSelection && !effectiveUnitId` — não renderiza cards de SLA misturando unidades
>
> **Validação browser (super_admin, banco local):**
> - **Caso (a):** "Todas" → modal abre com campo "Unidade *" obrigatório + helper text; botão "Abrir Chamado" disabled até escolha; após escolher Moema + preencher título + setor "Recepção" → toast "Chamado aberto com sucesso", card aparece com badge "Recepção". SQL confirmou: `unit = 'Buffet Cachola Moema'`, `sector = 'Recepção'`.
> - **Caso (b):** com Pinheiros escolhida → dropdown Setor lista 8 entradas (Salão Principal, Salão 2, Área Externa, Cozinha, Banheiros, Área de Brinquedos, Estacionamento, Depósito) — todas Pinheiros. Trocar para Moema → dropdown rerrenderiza com 8 entradas distintas (Recepção, Escritório, Playground etc.). Comparação SQL: cada unidade tem 8 setores próprios, zero overlap.
> - **Reset cascade:** com Setor = "Cozinha" (Pinheiros), trocar Unidade → Moema fez o campo Setor voltar para "Nenhum" automaticamente — confirmado em snapshot do a11y tree.
> - **Caso (c):** Pinheiros como unidade única no seletor global → modal abre **sem** o campo Unidade (primeiro campo é "Título"), botão "Abrir Chamado" enabled sem necessidade de escolha. Comportamento atual preservado.
> - **Validação local:** `npx tsc --noEmit` limpo. `npm run lint`: 0 erros (348 warnings — baseline). `npm run build`: sucesso.
>
> **Observação técnica para Fase 3:**
> O banco local foi seedado com `user_units` que cobre ambas as unidades para o super_admin de teste, então o INSERT em Moema passou pela RLS atual. Em produção, super_admin/diretor que não tenha `user_units` da unidade escolhida ainda receberá `42501` — esse é exatamente o cenário que a Fase 3 resolve adicionando `is_global_viewer()` à policy de `maintenance_tickets`.
>
> **Arquivos tocados (10):**
> - Novos: `src/hooks/use-form-unit-selection.ts`, `src/components/features/maintenance/unit-picker-banner.tsx`
> - Modificados: `src/hooks/use-tickets.ts`, `src/hooks/use-sectors.ts`, `src/hooks/use-maintenance-categories.ts`, `src/hooks/use-maintenance-items.ts`, `src/hooks/use-maintenance-sla.ts`, `src/hooks/use-equipment.ts`, `src/components/features/maintenance/ticket-form-modal.tsx`, `src/app/(auth)/manutencao/configuracoes/page.tsx`, `src/components/features/settings/config-table.tsx`

### Fase 2 — Verificações Pré-Deploy — 2026-05-21

> Executadas após implementação e antes de commit/push. Resultado: **todas passaram sem ajustes necessários.**

#### Task 1 — Reset cascade completo (Categoria + Equipamento)

**Objetivo:** confirmar que trocar a unidade no modal reseta todos os 4 campos dependentes, incluindo `category_id` e `equipment_id`.

**Código auditado** — `ticket-form-modal.tsx:119–128`:
```typescript
if (key === 'unit_id') {
  return {
    ...prev,
    unit_id:      value as string,
    sector_id:    '',
    category_id:  '',
    item_id:      '',
    equipment_id: '',
  }
}
```
Todos os 4 campos são zerados atomicamente no mesmo `setForm` updater. Não há caminho de troca de unidade que preserve qualquer campo dependente.

**Validação browser** (super_admin local, banco dev, "Todas as unidades"):
1. Modal aberto → unidade "Pinheiros" selecionada
2. Categoria: **"Elétrica"** selecionada (entre 7 opções de Pinheiros)
3. Equipamento: **"Piscina de bolinhas"** selecionado (único equipamento disponível em Pinheiros)
4. Unidade trocada para **"Moema"**

**Snapshot pós-troca:**
```
combobox value="Buffet Cachola Moema"   ← unidade nova
combobox value="Nenhum"                 ← setor resetado
combobox value="Nenhuma"                ← CATEGORIA resetada ✓
combobox value="Nenhum"                 ← item resetado
combobox value="Nenhum equipamento"     ← EQUIPAMENTO resetado ✓
```

**Resultado: ✅ CONFIRMADO** — todos os 4 campos resetados.

---

#### Task 2 — `mapPgError` usa `effectiveUnitId` do form, não o `null` do store

**Objetivo:** confirmar que em modo "Todas as unidades", se ocorrer erro `42501`, a mensagem será "Você não tem permissão para realizar esta ação nesta unidade." (e não "Selecione uma unidade...").

**Código auditado** — `use-tickets.ts:184–185`:
```typescript
onError: (err, payload) =>
  toast.error(mapPgError(err, { activeUnitId: payload?.unit_id ?? null }, 'TICKET_CREATE')),
```

**Código auditado** — `ticket-form-modal.tsx:151–155` (`handleSubmit`):
```typescript
const payload: TicketInsert = {
  ...
  unit_id: effectiveUnitId,   // ← sempre o UUID real do form, não o null do store
  ...
}
```

**Código auditado** — `ticket-form-modal.tsx:170–172` (`submitDisabled`):
```typescript
const submitDisabled =
  createTicket.isPending ||
  (requiresUnitSelection && !form.unit_id)   // ← submit bloqueado sem unidade
```

**Raciocínio:** `payload.unit_id` = `effectiveUnitId` = UUID real da unidade escolhida no form. Submit só é habilitado após escolha, então quando a mutation dispara, `payload.unit_id` é **sempre não-nulo**. Portanto `mapPgError(err, { activeUnitId: <UUID real> }, ...)` vai para o branch `42501 + activeUnitId !== null` → mensagem "Você não tem permissão para realizar esta ação nesta unidade." — o cenário correto para um erro de permissão pós-Fase 3.

**Resultado: ✅ CORRETO** — sem ajuste necessário.

---

#### Task 3 — Membros super_admin/diretor em produção (somente leitura)

**Query executada:**
```sql
SELECT u.email, u.role, array_agg(un.slug ORDER BY un.slug) AS unit_slugs
FROM users u
LEFT JOIN user_units uu ON uu.user_id = u.id
LEFT JOIN units un ON un.id = uu.unit_id
WHERE u.role IN ('super_admin','diretor')
GROUP BY u.email, u.role;
```

**Resultado em produção:**
| email | role | unidades |
|---|---|---|
| `admin@cacholaos.com.br` | super_admin | {moema, pinheiros} |
| `bruno.casaletti@grupodrk.com.br` | super_admin | {moema, pinheiros} |
| `carol@festanacachola.com.br` | diretor | {moema, pinheiros} |
| `vinicius@festanacachola.com.br` | diretor | {moema, pinheiros} |

**Conclusão:** todos os 4 usuários `super_admin`/`diretor` já têm membership explícito em ambas as unidades. Após o deploy da Fase 2 (antes da Fase 3 adicionar `is_global_viewer()` à RLS de `maintenance_tickets`), **nenhum global viewer receberá `42501`** ao criar chamados — porque a RLS `unit_id = ANY(get_user_unit_ids())` já os cobre via `user_units`. O risco "global viewer com membership parcial" só existiria se algum super_admin/diretor fosse criado sem unidades; isso não acontece na produção atual.

**Resultado: ✅ SEM RISCO** — nenhum ajuste necessário.

---

### Fase 3 — Migration de RLS + backfill de permissões (alinha módulo ao padrão)
**Checkpoint:** Bruno aprova plano de migration + smoke test local antes de aplicar em produção.

> ✅ **Risco de regressão REVISADO após Fase 3.1 (2026-05-21):** diagnóstico em produção confirmou que **todos os 7 usuários com acesso ao módulo já têm linhas em `user_permissions` para `module='manutencao'`**. Backfill precautório ainda recomendado na migration (via `INSERT ... ON CONFLICT DO NOTHING`) para cobrir novos usuários criados entre agora e o deploy, mas o risco de regressão imediata é **zero** no estado atual da produção. Ver Subseção "Fase 3.1" abaixo para detalhes completos.

#### Fase 3.1 — Resultado do diagnóstico de permissões (prod) — 2026-05-21

> **Modo somente leitura — nenhuma escrita, nenhuma migration, nenhum commit de código.**
> Executado via `docker exec psql` no banco de produção da VPS.

##### Consulta 1 — Contagem por cargo

| role | total |
|---|---|
| super_admin | 2 |
| diretor | 2 |
| gerente | 2 |
| manutencao | 1 |
| **Total** | **7** |

##### Consulta 2 — Quem perderia acesso após nova RLS

**0 usuários.** Todos os 7 já têm pelo menos uma linha em `user_permissions` para `module='manutencao'`. Nenhum perderia acesso imediato quando a nova policy entrar em vigor.

##### Permissões reais por usuário (Consulta 2 detalhada)

| email | role | create | edit | delete | view | export | observação |
|---|---|---|---|---|---|---|---|
| `carol@festanacachola.com.br` | diretor | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `vinicius@festanacachola.com.br` | diretor | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `brunocasaletti@gmail.com` | gerente | ✅ | ✅ | ✅ | ✅ | ✅ | delete e export além do template |
| `brunocasaletti@hotmail.com` | gerente | ✅ | ✅ | ❌ | ✅ | — | delete=false — alinhado ao template |
| `suporte@grupodrk.com.br` | manutencao | ✅ | ✅ | — | ✅ | — | sem delete/export — alinhado ao template |
| `admin@cacholaos.com.br` | super_admin | ✅ | ✅ | ✅ | ✅ | ✅ | bypass via check_permission |
| `bruno.casaletti@grupodrk.com.br` | super_admin | ✅ | ✅ | ✅ | ✅ | ✅ | bypass via check_permission |

> **Nota:** `diretor` template em `role_default_perms` tem apenas `view + export`. Ambos os diretores reais têm permissões individuais mais amplas (create/edit/delete) — foram customizadas manualmente além do template. A migration NÃO deve sobrescrever permissões existentes (`INSERT ... ON CONFLICT DO NOTHING` garante isso).

##### Consulta 3 — Template role_default_perms para `manutencao`

Existe e está populado com 14 linhas:

| role | actions com granted=true | actions com granted=false |
|---|---|---|
| super_admin | view, create, edit, delete, export | — |
| diretor | view, export | — |
| gerente | view, create, edit | delete |
| manutencao | view, create, edit | — |

> **Divergência template × produção:** diretores no template têm apenas `view+export`, mas na produção têm create/edit/delete também (permissão individual customizada). A migration de backfill usa `ON CONFLICT DO NOTHING` — não sobrescreve o que já existe, então a divergência é preservada corretamente.

##### Consulta 4 — check_permission: bypass super_admin confirmado por código

```sql
-- Trecho crítico de check_permission(p_user_id uuid, p_module text, p_action text):
SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
IF v_role = 'super_admin' THEN
  RETURN TRUE;  -- ← bypass total, antes de qualquer consulta a user_permissions
END IF;
```

- **Confirmado:** `check_permission` lê `users.role` e faz `RETURN TRUE` imediatamente para `super_admin`, sem consultar `user_permissions`.
- `is_super_admin()` (usada nas policies de `role_permissions` / `role_template_audit`) usa `auth.uid()` diretamente — mecanismo diferente, mesmo resultado.
- Quando a nova RLS de `maintenance_tickets` incluir `check_permission(auth.uid(), 'manutencao', 'create')`, super_admin passa automaticamente sem precisar de linha em `user_permissions`.

##### Implicações para o rascunho da migration (Fase 3.2)

| Achado | Consequência para a migration |
|---|---|
| 0 usuários sem permissão | Backfill ainda recomendado (cobertura futura), mas risco de regressão imediata = **zero** |
| `brunocasaletti@hotmail.com` tem `delete=false` | Após nova RLS, DELETE em chamados retornará 42501 para esse gerente — **comportamento intencional** (alinhado ao template) |
| `suporte@grupodrk.com.br` sem `delete` | Idem — técnico de manutenção não deve deletar chamados — **intencional** |
| `diretor` template só tem view+export | Template não precisa ser corrigido para o fix funcionar — permissões individuais já estão corretas |
| `check_permission` bypassa super_admin | Migration pode usar `check_permission(auth.uid(), 'manutencao', 'action')` diretamente nas policies — super_admin passa automaticamente |

- 3.1 Diagnóstico SQL (rodar antes de redigir a migration): contar usuários por role e contar quantos têm `user_permissions` para `module='manutencao'`. Listar os que faltam, projetar o impacto.

  ```sql
  -- Usuários por role com acesso à manutenção
  SELECT u.role, COUNT(*) AS total
  FROM users u
  WHERE u.role IN ('super_admin','diretor','gerente','manutencao')
  GROUP BY u.role;

  -- Quem está sem nenhuma permissão para 'manutencao'
  SELECT u.id, u.email, u.role
  FROM users u
  WHERE u.role IN ('super_admin','diretor','gerente','manutencao')
    AND NOT EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_id = u.id AND up.module = 'manutencao'
    );
  ```

- 3.2 Criar migration `091_maintenance_rls_alignment.sql` numa única transação BEGIN/COMMIT:
  1. **Backfill `user_permissions`** para todos os usuários em `MAINTENANCE_MODULE_ROLES` a partir do template em `role_default_perms WHERE module='manutencao'`. Padrão visto em `role-permissions/apply-to-all` (PR 4b). super_admin **ignora** check_permission no código (CLAUDE.md), mas o backfill deve cobrir gerente/diretor/manutencao explicitamente. `INSERT ... ON CONFLICT DO NOTHING`.
  2. DROP + CREATE policies das 8 tabelas da 031: `(check_permission(auth.uid(), 'manutencao', '<action>') AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids())))`. Mapeamento ação: SELECT → view, INSERT → create, UPDATE → edit, DELETE → delete. Para tabelas filhas (`maintenance_executions`, `_photos`, `_status_history`) usar `ticket_id IN (SELECT id FROM maintenance_tickets WHERE … nova policy …)`.
  3. Atualizar policies de `maintenance_suppliers`, `supplier_contacts`, `supplier_documents`, `maintenance_costs` para usar `'manutencao'` (PT-BR) em vez de `'maintenance'` (EN) — quita dívida de F7.
- 3.3 **REGRA DDL+DML do CLAUDE.md (Hotfix v1.5.7):** testar a migration localmente com `docker exec -i cacholaos-db psql … < arquivo.sql` antes do merge. DROP POLICY antes de CREATE para idempotência. Validar que o backfill rodou ANTES das novas policies (mesma transação garante isso).
- 3.4 Smoke test local em ambas direções:
  - **Falha esperada:** técnico de manutenção SEM linha `user_permissions(module='manutencao', action='create', granted=true)` → INSERT em `maintenance_tickets` retorna 42501.
  - **Sucesso esperado:** mesmo técnico COM a linha (backfill OK) → INSERT bem-sucedido.
  - **Sucesso esperado:** super_admin → INSERT bem-sucedido independentemente de `user_permissions` (bypass do super_admin no DB via `is_super_admin()` — confirmar que `check_permission()` honra isso; checar o código atual de `check_permission` antes de assumir).
- 3.5 Validar no Studio/`/admin/usuarios/[id]/permissoes` que diretor/gerente/manutencao agora têm linhas para `manutencao | view/create/edit/delete` (visualização do template aplicado).

#### Fase 3.2 — Migration `094` escrita e testada localmente (2026-05-21)

> **Status:** migration redigida + testada no banco local. **Não aplicada em produção, não commitada.** Aguarda revisão do Bruno.

##### Reconfirmação do diagnóstico (PASSO A — read-only em produção)

As 3 consultas da Fase 3.1 foram reexecutadas em produção e os números **não mudaram**:

- Consulta 1: 7 usuários com acesso (2 super_admin, 2 diretor, 2 gerente, 1 manutencao).
- Consulta 2: **0 usuários** sem linha em `user_permissions` para `module='manutencao'` → ninguém perde acesso quando a nova RLS entrar.
- Consulta 3: template `role_default_perms` para `manutencao` intacto (14 linhas).

##### Desvio descoberto — passo 3 do plano original cancelado

O rascunho da Fase 3.2 previa um passo 3 para traduzir as policies de `maintenance_suppliers` / `supplier_contacts` / `supplier_documents` / `maintenance_costs` de `'maintenance'` (EN) para `'manutencao'` (PT-BR). **Esse passo foi removido:** verificação via `pg_class` em produção confirmou que essas 4 tabelas **não existem** — a migration 032 fez `DROP TABLE … CASCADE` nelas (+ `maintenance_orders`) ao aposentar o módulo legado. A migration `094` tem portanto **2 passos**, não 3.

##### PASSO B — Aprovação de custo (§4.2.4): gating amplo NÃO fecha o furo

A aprovação de custo mora em `maintenance_executions` (colunas `cost_approved`, `cost_approved_by`, `cost_approved_at`, migration 031). O app aprova via **UPDATE direto do cliente** (`useApproveCost` em `src/hooks/use-tickets.ts:376-401`) — sem API route, sem `requireRoleApi`. A única trava hoje é a UI (`canApprove = hasRole(MAINTENANCE_ADMIN_ROLES)`).

**Conclusão:** a nova policy `UPDATE → check_permission('manutencao','edit')` da migration 094 **não fecha** esse furo. O técnico de manutenção tem `edit=true`, então passa na policy de UPDATE — e a RLS não distingue *qual coluna* está sendo alterada. Um técnico ainda conseguiria `UPDATE maintenance_executions SET cost_approved=true` via PostgREST direto. Quem deveria aprovar = `MAINTENANCE_ADMIN_ROLES` (super_admin/diretor/gerente); quem tem `edit` mas **não** deveria aprovar = `manutencao`.

**Proposta (NÃO implementada nesta migration — requer aprovação):** trigger `BEFORE UPDATE` em `maintenance_executions` que, quando qualquer das 3 colunas de aprovação muda, exige que `auth.uid()` seja de um cargo admin:

```sql
IF (NEW.cost_approved, NEW.cost_approved_by, NEW.cost_approved_at)
   IS DISTINCT FROM (OLD.cost_approved, OLD.cost_approved_by, OLD.cost_approved_at)
THEN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('super_admin','diretor','gerente')
  ) THEN RAISE EXCEPTION 'permissao_negada: aprovar custo';
  END IF;
END IF;
```

O guard `auth.uid() IS NOT NULL` deixa o `service_role` (server-side, confiável) passar. Trigger preferido sobre RPC `SECURITY DEFINER` por não exigir mudança no app — o fluxo `.update()` atual continua funcionando para cargos autorizados. Sugestão: tratar como **Fase 3.3** (PR separado), após a 094.

##### A migration — `supabase/migrations/094_maintenance_rls_alignment.sql`

Transação única `BEGIN/COMMIT`, 2 passos:

1. **Backfill** de `user_permissions` a partir de `role_default_perms WHERE module='manutencao'`, para `diretor/gerente/manutencao` (super_admin **excluído** — `check_permission` faz bypass; regra do CLAUDE.md). `INSERT … ON CONFLICT (user_id,unit_id,module,action) DO NOTHING` — preserva permissões individuais customizadas. `unit_id = NULL` (padrão: 100% de `user_permissions` usa global).
2. **DROP + CREATE** das policies das 8 tabelas da migration 031. Padrão: `check_permission(auth.uid(),'manutencao','<ação>') AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))`. Mapeamento SELECT→view, INSERT→create, UPDATE→edit, DELETE→delete. Tabelas-filhas (`maintenance_executions`, `maintenance_ticket_photos`, `maintenance_status_history`) escopadas via `ticket_id IN (SELECT id FROM maintenance_tickets WHERE …)` — dependência acíclica, **sem** necessidade de `SECURITY DEFINER`. **Total: 28 policies** — `maintenance_tickets` fica com 3 (view/create/edit, **sem DELETE** — ver Passo 1b abaixo), `maintenance_status_history` com 1 (view), as outras 6 tabelas com 4 cada.

**Pontos de atenção (intencionais, sinalizados):**

- **`maintenance_tickets` permanece sem policy de DELETE (ajuste do Passo 1b).** A 031 não tinha policy de DELETE e a 094 **mantém** assim → DELETE de chamado continua negado a **todos**, inclusive super_admin (sem policy de DELETE não há como invocar o bypass de `check_permission`). Motivo: não existe feature de excluir chamado na UI (§8.5.3) e hard-delete destruiria histórico/auditoria; o objetivo da migration é **apertar** a segurança, não criar capacidade nova. As outras 6 tabelas (setores, categorias, itens, SLA, fotos, execuções) ganham policy de DELETE com `check_permission` — em todas, a migration **restringe** (a 031 dava `FOR ALL`/`unit_manage` sem `check_permission`).
- **`maintenance_status_history` permanece SELECT-only.** INSERT vem exclusivamente do trigger `record_ticket_status_change()` (SECURITY DEFINER, bypassa RLS). A migration não cria policies de INSERT/UPDATE/DELETE — a timeline continua append-only via trigger.
- **Template `diretor` = só view+export.** Um diretor *novo* (criado pós-deploy) receberia apenas view+export no backfill e não conseguiria criar chamados via RLS. Os 2 diretores atuais têm `create/edit/delete` individuais customizados — não afetados. Decisão de template fora do escopo da 094.

##### Smoke test local (PASSO D — `docker exec psql`, banco local)

Migration aplicada no banco local com `ON_ERROR_STOP=1` — sem erro, idempotente (re-execução: `INSERT 0 0`, `DROP POLICY IF EXISTS` no-op). **28 policies** confirmadas (`maintenance_tickets` com 3 — `INSERT/SELECT/UPDATE`, sem DELETE). super_admin com **0 linhas** `manutencao` (backfill o exclui corretamente).

Teste bidirecional via `SET LOCAL ROLE authenticated` + `request.jwt.claims`:

| Teste | Cenário | Esperado | Resultado |
|---|---|---|---|
| T1 | super_admin INSERT chamado (0 `user_permissions`) | sucesso via bypass | ✅ `INSERT 0 1` |
| T2 | técnico manutencao **com** `create=true` INSERT | sucesso | ✅ `INSERT 0 1` |
| T3 | técnico manutencao **sem** `create` (linha removida na txn) INSERT | erro 42501 | ✅ `violates row-level security policy` |
| T4 | vendedora (membro de unidade, **sem** perm manutencao) INSERT | erro 42501 | ✅ `violates row-level security policy` |
| T5 | técnico manutencao SELECT chamados | ≥1 linha | ✅ 1 linha |
| T6 | técnico manutencao **com** `edit=true` UPDATE chamado | sucesso | ✅ `UPDATE 1` |
| T7 | técnico manutencao **sem** `edit` (linha removida na txn) UPDATE | RLS bloqueia | ✅ `UPDATE 0` |
| T8a | **super_admin** DELETE chamado | negado (sem policy de DELETE) | ✅ `DELETE 0` |
| T8b | **diretor** com `delete=true` (concedido na txn) DELETE chamado | negado (sem policy de DELETE) | ✅ `DELETE 0` |
| T9a | super_admin DELETE setor (`maintenance_sectors`) | sucesso (demais tabelas têm DELETE) | ✅ `DELETE 1` |
| T9b | técnico com `delete=true` (concedido na txn) DELETE setor | sucesso | ✅ `DELETE 1` |
| T9c | técnico **sem** `delete` DELETE setor | bloqueado pela policy | ✅ `DELETE 0` |

**T8 é a prova do ajuste do Passo 1b:** mesmo super_admin e um diretor com `delete=true` recebem `DELETE 0` em `maintenance_tickets` — sem policy de DELETE, a RLS exclui silenciosamente todas as linhas do comando. **T9 confirma que as demais tabelas seguem deletáveis:** DELETE de setor funciona para quem tem `delete=true` (T9a/T9b) e é bloqueado para quem não tem (T9c).

**T4 é a prova de que a §4.2.1 foi fechada:** antes da 094, a vendedora — que tem membership de unidade — conseguiria INSERT em `maintenance_tickets` via API direta. Depois, é bloqueada.

**T7 retorna `UPDATE 0` (não 42501):** numa policy de UPDATE, a cláusula `USING` filtra *quais linhas* podem ser atualizadas — uma linha que reprova no `USING` é silenciosamente excluída (0 linhas afetadas), sem erro. O 42501 só dispara em violação de `WITH CHECK` (linha NOVA). `UPDATE 0` confirma o bloqueio: o técnico sem `edit` enxerga o chamado (tem `view`) mas não consegue alterá-lo.

##### Validação no app local (dev v1.11.7)

Logado como `teste.manutencao@cachola.local` (cargo manutencao): `/manutencao/chamados` carrega; criou chamado pela UI ("Novo Chamado" → toast "Chamado aberto com sucesso", aparece na lista); detalhe do chamado abre com seções Fotos e Execuções (SELECTs das tabelas-filhas OK, vazias sem erro). Console sem erros de RLS — apenas o `SyntaxError` de extensão de browser já conhecido. Chamado de teste removido após validação. Screenshot: `docs/screenshots/fase3-detalhe-tech.png`. O caminho de UPDATE (alterar status) não foi reexecutado pela UI — está coberto de forma determinística pelos testes T6/T7 no banco, que exercem exatamente o `UPDATE maintenance_tickets` sob a sessão do usuário autenticado.

#### Fase 3.3 — Migration publicada no repo + rollback testado (Passo 2)

> **Status:** os arquivos da migration estão em `main` (e na VPS via deploy). **A migration NÃO foi aplicada no banco de produção** — isso é o Passo 3, separado, liberado pelo Bruno.

##### Rollback — `094_maintenance_rls_alignment_rollback.sql`

Criado o script de reversão: faz `DROP` das 28 policies da 094 e `re-CREATE` das 16 policies originais da migration 031 (definições copiadas verbatim de `031_maintenance_module_tables.sql`). O backfill de `user_permissions` **não** é revertido — a 094 usou `ON CONFLICT DO NOTHING` (não removeu nem alterou linhas), e apagar permissões num rollback seria mais arriscado do que mantê-las. Idempotente (`DROP … IF EXISTS`).

**Teste do rollback (banco local):** aplicar 094 (28 policies) → aplicar rollback → **16 policies**, idênticas ao estado da 031 (nomes `unit_read_*`/`unit_manage_*`/`unit_insert_tickets`/`unit_update_tickets`, `cmd` e `USING`/`WITH CHECK` conferidos contra o `pg_policies` de produção capturado no Passo A) → re-aplicar 094 → volta a 28. ✅

##### Deploy do Passo 2 não muda comportamento

O `deploy.yml` faz apenas `git pull` + `npm ci` + `npm run build` + `pm2 restart` — **não aplica migrations**. Merge da v1.11.8 leva os arquivos `094_*.sql` e `094_*_rollback.sql` para a VPS, mas o banco de produção continua com as policies da 031 até o Passo 3 rodar `094` via `docker exec psql`.

#### Fase 3.4 — Migration aplicada em produção (Passo 3) — 2026-05-22

> **A 094 foi aplicada no banco de produção.** A RLS das 8 tabelas da migration 031 agora é role-gated via `check_permission`. Aguarda apenas a validação visual final do Bruno no app.

##### Aplicação

`docker exec -i supabase-db psql … -v ON_ERROR_STOP=1 < …/094_maintenance_rls_alignment.sql` — `BEGIN → INSERT 0 0 → COMMIT`, sem erro. Backfill inseriu **0 linhas** (os 7 usuários já tinham as permissões de `manutencao`, confirmado no diagnóstico da Fase 3.1). Policies: **16 → 28**; `maintenance_tickets` com 3 (`INSERT/SELECT/UPDATE`, sem DELETE). Sem `NOTIFY pgrst` — RLS é avaliada pelo Postgres em tempo de query, o PostgREST não faz cache de policy; o backfill em `user_permissions` também não toca o schema.

##### Smoke test em produção (usuários reais, `BEGIN/ROLLBACK` — nenhum dado de teste persistido)

| | Cenário (usuário real) | Resultado |
|---|---|---|
| P1 | super_admin INSERT chamado | ✅ `INSERT 0 1` (bypass) |
| P2 | gerente (`brunocasaletti@gmail.com`, role manutencao, `create`+unidade pinheiros) INSERT | ✅ `INSERT 0 1` |
| P3 | gerente SELECT chamados | ✅ 3 chamados, sem erro |
| P4 | vendedora real (`bruna.jana`, membro de unidade) INSERT | ✅ `42501` — **§4.2.1 fechada (escrita)** |
| P5 | vendedora real SELECT chamados | ✅ `0` — §4.2.1 fechada (leitura) |
| P6 | os 7 usuários têm `user_permissions` de `manutencao` | ✅ diretor 5/5, gerente 5/4, manutencao 3, super_admin 5/5 |

**P4/P5 provam em produção** que a "porta dos fundos" foi fechada: a vendedora, que tem membership de unidade, conseguiria CRUD de chamados via API direta sob a 031 — agora é bloqueada na escrita e na leitura.

##### FYI para o Bruno — lacuna de `user_units` (não é regressão, não bloqueia)

Dois usuários em `MAINTENANCE_MODULE_ROLES` têm **0 linhas em `user_units`**: `brunocasaletti@hotmail.com` (gerente) e `suporte@grupodrk.com.br` (manutencao). Como não são global viewers, ficam **sem acesso ao módulo de chamados** — mas isso já valia sob a 031 (a policy antiga também exigia `unit_id = ANY(get_user_unit_ids())`). A 094 **não regrediu** ninguém. Higiene de dados a avaliar à parte: esses contatos provavelmente precisam de unidade atribuída, ou são contas de suporte propositalmente órfãs. O backfill da 094 deu a eles as linhas de `user_permissions`, mas não cria `user_units` — confirma que a lacuna é de `user_units`, não de permissão.

##### Pendente

- **Validação visual final do Bruno:** abrir `/manutencao/chamados` em produção como super_admin e confirmar que carrega e funciona sem erro de RLS.
- Trigger de aprovação de custo (§4.2.4) — implementado na Fase 3.5 (ver abaixo).
- Rollback disponível e testado caso necessário: `094_maintenance_rls_alignment_rollback.sql`.

### Fase 3.5 — Trigger de guarda da aprovação de custo (§4.2.4)

> **Status:** ✅ **Aplicada em produção** em 2026-05-22 — migration `095`, tag `v1.11.9`, PR #45, merge commit `23d8518`. Smoke test em produção 3/3 PASS (ver Passo E). Aguarda validação visual do Bruno no app.

Fecha a segunda porta dos fundos: a aprovação de custo (`maintenance_executions.cost_approved` + `_by` + `_at`) é feita por `UPDATE` direto do cliente (`useApproveCost`, `use-tickets.ts`). A RLS de UPDATE da 094 (`maintenance_executions: edit`) só checa `check_permission(...,'edit')` e **não distingue colunas** — um técnico (role `manutencao`, que tem `edit`) passaria na RLS e viraria a flag via PostgREST direto.

#### Passo A — Investigação

| Pergunta | Resultado |
|---|---|
| Colunas de aprovação | `cost_approved` (bool NOT NULL default false), `cost_approved_by` (uuid), `cost_approved_at` (timestamptz) — **só em `maintenance_executions`** |
| Há outra tabela/coluna de aprovação? | Não. A `maintenance_costs` legada (workflow `status`/`reviewed_by`) foi DROPada pela migration 032 |
| Quem escreve essas colunas? | **Apenas `useApproveCost`** (sessão do usuário). Nenhum `service_role`/cron/sync/outro trigger escreve. Os 2 triggers existentes (`maintenance_executions_updated_at`, `sync_ticket_total_cost`) não tocam as colunas de aprovação |
| Como identificar admin em SQL | Padrão canônico (`cachola-rbac-pattern`, patterns-by-layer §6): subquery em `public.users` com `role IN (...)`, dentro de função `SECURITY DEFINER`. Sem helper dedicado — `super_admin/diretor/gerente` não coincide com `is_super_admin()`/`is_global_viewer()`; uso único → checagem inline |

**Decisão sobre `service_role`:** como **nenhum** processo não-usuário escreve as colunas de aprovação, o trigger exige cargo admin e **não tem "passe" de `service_role`** (nada legítimo precisa dele). Não se usou `auth.uid() IS NOT NULL` (impreciso — não identifica `service_role`); a checagem é positiva (`EXISTS … role IN (admin)`). Se uma migration futura precisar editar essas colunas em massa, desativar o trigger na janela (`ALTER TABLE … DISABLE/ENABLE TRIGGER`, padrão já usado no projeto).

#### Passo B — Migration `095_maintenance_cost_approval_trigger.sql`

Trigger `BEFORE UPDATE` em `maintenance_executions` → função `guard_cost_approval()` (`SECURITY DEFINER`, `search_path=public`). Dispara quando a tupla `(cost_approved, cost_approved_by, cost_approved_at)` muda (`IS DISTINCT FROM` — NULL-safe; cobre aprovar, desaprovar e spoof isolado de `_by`/`_at`); se o ator não for `super_admin/diretor/gerente`, `RAISE EXCEPTION` com `ERRCODE 42501`. Idempotente (`DROP TRIGGER/FUNCTION IF EXISTS`).

#### Passo C — Smoke test local (`docker exec psql`)

| | Cenário | Resultado |
|---|---|---|
| C1 | gerente UPDATE `cost_approved=true` | ✅ `UPDATE 1` (permitido) |
| C2 | super_admin UPDATE `cost_approved=true` | ✅ `UPDATE 1` (permitido) |
| C3 | diretor (com `edit` concedido na txn) UPDATE `cost_approved=true` | ✅ `UPDATE 1` (permitido) |
| C4 | técnico (`manutencao`, com `edit`) UPDATE `cost_approved=true` | ✅ `ERRO 42501` — `permissao_negada` |
| C5 | técnico UPDATE `description`+`cost` (colunas não-aprovação) | ✅ `UPDATE 1` — trigger é cirúrgico, não barra |
| C6 | técnico UPDATE `cost_approved_by` isolado | ✅ `ERRO 42501` — anti-spoof |

**C4 prova o ponto:** o técnico passa na RLS de `edit` da 094 mas o trigger barra a alteração da flag. **C5 prova que o trigger é cirúrgico:** só intercepta as 3 colunas de aprovação. **C6 prova o anti-spoof:** mexer só em `cost_approved_by` também é bloqueado.

> **Validação pela UI não reexecutada** (logar como gerente + aprovar custo): exigiria `docker + npm run dev + Chrome` simultâneos, combinação que esgotou a RAM da máquina e travou o Docker Desktop nesta sessão. O `useApproveCost` emite exatamente `UPDATE maintenance_executions SET cost_approved=true, cost_approved_by=<uid>, cost_approved_at=now()` como o usuário autenticado — idêntico ao que C1 (gerente) exercita no banco. Recomendado: Bruno fazer o clique de aprovar custo como gerente na validação visual.

#### Passo D — Rollback `095_..._rollback.sql`

`DROP TRIGGER` + `DROP FUNCTION`. Testado: aplicar 095 → rollback (trigger e função removidos, voltam só os 2 triggers da 031) → re-aplicar 095 (trigger ativo). ✅

#### Passo E — Publicação no repo + aplicação em produção (2026-05-22)

**Publicação (Passo 2):** comentário de sincronização com `MAINTENANCE_ADMIN_ROLES` (`src/config/roles.ts`) adicionado à função. `tsc`/`lint`/`build` limpos. Versão `v1.11.8 → v1.11.9`. Commit `9257710` → PR #45 → CI verde → merge `--no-ff` em `main` (`23d8518`) → deploy automático verde (3m10s). Arquivos `095_…sql` + `095_…_rollback.sql` confirmados em `/opt/cacholaapp/supabase/migrations/` na VPS. Tag `v1.11.9`.

**Aplicação em produção (Passo 3):**

| | Estado |
|---|---|
| Triggers de `maintenance_executions` **antes** | `maintenance_executions_updated_at`, `sync_ticket_total_cost` (2) |
| Aplicação | `docker exec -i supabase-db psql -v ON_ERROR_STOP=1 < …/095_…sql` → `BEGIN…COMMIT` sem erro |
| Triggers **depois** | + `trg_guard_cost_approval` (3); função `guard_cost_approval` presente, `prosecdef=t` (SECURITY DEFINER) |

**Smoke test em produção** — usuários reais, tudo em `BEGIN … ROLLBACK` (nenhum dado persistido). Trigger testado em isolamento (psql superuser → RLS bypassed; a RLS da 094 já foi validada no Passo 3 da Fase 3, P1–P6). `auth.uid()` simulado via `SET LOCAL request.jwt.claims`; cada teste imprime uma probe `CTX: auth.uid()=…, role=…` para garantir que o JWT propagou (evita falso positivo por `auth.uid()` NULL).

| | Cenário (usuário real) | Probe `CTX` | Resultado |
|---|---|---|---|
| 1 | `brunocasaletti@gmail.com` (**gerente**) → `UPDATE cost_approved=true` | `role=gerente` ✅ | ✅ **PASS** — UPDATE permitido |
| 2 | `suporte@grupodrk.com.br` (**manutencao**) → `UPDATE cost_approved=true` | `role=manutencao` ✅ | ✅ **PASS** — bloqueado `42501` `permissao_negada: aprovacao de custo restrita a super_admin, diretor ou gerente` |
| 3 | `suporte@grupodrk.com.br` (**manutencao**) → `UPDATE description` | `role=manutencao` ✅ | ✅ **PASS** — UPDATE permitido (trigger é cirúrgico) |

**Teste 2 prova a §4.2.4 fechada em produção:** um técnico não consegue virar a flag de aprovação de custo via UPDATE direto. As probes confirmam que o bloqueio veio de `role=manutencao`, não de `auth.uid()` NULL.

#### Pendente

- Validação visual do Bruno: logar como **gerente** no app, aprovar um custo de verdade em um chamado, confirmar que funciona (o `useApproveCost` emite exatamente o UPDATE do Teste 1).

### Fase 4 — Fix do dashboard "Todas"
**Checkpoint:** Bruno aprova após Bruno testar dashboard em "Todas" como super_admin.

- 4.1 Alterar `/api/maintenance/stats` para aceitar `unit_id` ausente quando o requisitante é `is_global_viewer()` (consultar via Supabase server) e agregar todas as unidades do escopo do usuário.
- 4.2 Para roles não-globais com `user_units` em múltiplas unidades, agregar todas elas.
- 4.3 Idem para `/api/maintenance/history-summary`.
- 4.4 Validar visualmente o painel com super_admin "Todas", diretor "Todas" e gerente em unidade única.

> **✅ DEPLOYED em 2026-05-21** — commit `e6d36a2` (develop), merge commit `ecbe55b` (main), PR #40, tag `v1.11.4`. Deploy to Production: success (5m24s). VPS: buildId `ecbe55b` confirmado.
>
> **Diagnóstico (somente leitura):**
> - Ambas as rotas (`stats/route.ts:34–252`, `history-summary/route.ts:22–206`) usam `createClient()` SSR (sessão do usuário, RLS aplicada). Não usam `service_role`.
> - Cálculo: queries diretas no Supabase via `Promise.all` (sem RPC), agregação no servidor com `count: 'exact', head: true`. Todas as queries faziam `.eq('unit_id', unitId)`.
> - O 400 disparava em `stats:43–45` e `history-summary:36` quando `unit_id` ausente. Os hooks (`useMaintenanceDashboardStats`, `useHistorySummary`) já chamavam a rota mesmo sem o param — só a rota rejeitava.
>
> **Implementação:**
> - Novo helper `src/lib/auth/effective-unit-ids.ts` → `getEffectiveUnitIds(supabase, requestedUnitId)`:
>   1. `requestedUnitId` veio → array `[requestedUnitId]` (caminho atual).
>   2. Null/ausente + `super_admin`/`diretor` (via `GLOBAL_VIEWER_ROLES`) → todas as `units.id`.
>   3. Caso contrário → `user_units` do usuário autenticado.
> - `/api/maintenance/stats/route.ts`: removeu o 400; `getEffectiveUnitIds()` resolve `unitIds[]`; substituiu todos os `.eq('unit_id', unitId)` por `.in('unit_id', unitIds)`. Resposta vazia coerente quando `unitIds.length === 0` (usuário sem escopo nenhum).
> - `/api/maintenance/history-summary/route.ts`: mesma estratégia; afeta os 3 query builders (`buildTicketQuery`, `buildTicketIdsQuery`, `buildMonthlyTicketsQuery`).
> - Hooks **não precisaram mudar** — já chamavam a rota sem `unit_id` quando `activeUnitId === null`.
>
> **Validação browser (super_admin local, dev v1.11.3 em :3004, 4 tickets de teste inseridos no banco — 2/unidade):**
> - **Caso (a) "Todas as unidades":** Total=4, Taxa=50% (2 concluídos), Tempo médio=6d, 4 chamados listados misturando Pinheiros + Moema, "Por natureza" mostra Pontual/Emergencial/Preventivo/Agendado a 25% cada. Sem 400 no console.
> - **Caso (b) Pinheiros isolada:** Total=2, Taxa=50%, só chamados de Pinheiros listados, Por natureza = Pontual+Preventivo a 50% cada.
> - **Caso (c) Moema isolada:** Total=2, Taxa=50%, só chamados de Moema listados, Por natureza = Emergencial+Agendado a 50% cada.
> - Screenshots em `docs/screenshots/fase4-{todas,pinheiros,moema}.png`.
> - **Sem vazamento cross-unit:** quando o seletor está em uma unidade, só essas linhas aparecem. Quando está em "Todas", apenas as unidades do escopo do usuário entram na agregação (super_admin com 2 unidades → 4 tickets; usuário com 1 unidade veria 2).
> - **Sem duplicação:** Total muda de 2→4→2 conforme o escopo. A pre-fetch de `ticketIds` também respeita o `in` — execuções/custos vinculados pelo `ticket_id` permanecem no escopo correto.
>
> **Validação local:** `npx tsc --noEmit` limpo; `npm run lint` 0 erros (348 warnings — baseline inalterado); `npm run build` verde.
>
> **Arquivos tocados (3):**
> - Novo: `src/lib/auth/effective-unit-ids.ts`
> - Modificados: `src/app/api/maintenance/stats/route.ts`, `src/app/api/maintenance/history-summary/route.ts`

---

## 8.5 SWEEP "Todas as unidades" — diagnóstico completo do módulo (2026-05-21)

> Modo somente leitura. Após Fase 4 corrigir o dashboard, Bruno reportou novo sintoma: "Tempo esgotado ao carregar o chamado" no detalhe (`/manutencao/chamados/[id]`). Para evitar descobrir esses bugs um a um, este sweep mapeia TODOS os pontos do módulo que ainda assumem unidade única ou se comportam mal quando `activeUnitId = null`.

### 8.5.1 Reprodução do timeout no detalhe — INCONCLUSIVA

Cenário testado em produção (https://cachola.cloud, super_admin Bruno em "Todas"):

1. Navegar para `/manutencao/chamados` em "Todas" → lista carrega OK (3 chamados misturando Pinheiros + Moema).
2. Clicar no card "piscina de bolinhas quebrou" → detalhe abriu **sem erro** em ~700ms.
3. Trocar seletor para "Todas" diretamente na tela de detalhe → ticket continua exibido (vem do cache do React Query, staleTime 30s).
4. Hard reload na URL do detalhe → ticket carregou em ~800ms.

**Network confirma:** `req=583 GET /rest/v1/maintenance_tickets?...&id=eq.33f...` → **HTTP 200**, ~700ms. Sem 4xx/5xx.

**Conclusão:** o timeout reportado por Bruno foi **intermitente**, NÃO determinístico. Hipóteses originais refutadas via leitura de código:

| Hipótese | Status | Evidência |
|---|---|---|
| (a) `useTicket` com `enabled: !!activeUnitId` | ❌ Refutada | `use-tickets.ts:119` → `enabled: !!id && isSessionReady`. Não depende de unidade. |
| (b) `useLoadingTimeout` usado errado (sem desestruturar) | ❌ Refutada | `[id]/page.tsx:575` → `const { isTimedOut } = useLoadingTimeout(isLoading)`. Correto. |
| (c) Query de tabela-filha pendurando | ❌ Refutada | Detalhe é uma query única com nested select (executions, photos, history em um único GET). |

**Causa provável residual** (não determinística): latência de produção naquele instante batendo nos 12s default do `useLoadingTimeout`. Quando o detalhe é grande (ticket com muitas execuções/fotos/historico), o nested SELECT pode demorar. Não há bug estrutural no detalhe — apenas o threshold de 12s pode ser agressivo.

**Recomendação:** investigar logs do Supabase no horário do incidente. Se confirmar latência >12s, considerar aumentar o threshold para 20s OU exibir mensagem mais informativa do que "Tempo esgotado" (por exemplo, "Carregando dados — isso está mais lento que o normal. Aguarde ou tente novamente.").

### 8.5.2 Sweep completo — todos os pontos do módulo

`grep` por `activeUnitId|useUnitStore` em `src/app/(auth)/manutencao/**`, `src/app/(auth)/equipamentos/**`, `src/app/(auth)/prestadores/**`, `src/components/features/maintenance/**`, `src/components/features/equipment/**`, `src/hooks/use-{tickets,sectors,maintenance*,equipment*,providers,suppliers,service-categories}.ts`.

#### Classificação por severidade

| Pt | Local | Tipo | Severidade | Resolução |
|---|---|---|---|---|
| **P1** | `[id]/page.tsx:597` — upload de foto | (ii) **Quebra em Todas** | ALTA | Substituir `activeUnitId` por `ticket.unit_id` (já disponível) |
| **P2** | `[id]/page.tsx:803-806` — modal "Adicionar execução" | (ii) **Quebra em Todas** | ALTA | Idem P1 |
| **P3** | `use-equipment.ts:119` — `useCreateEquipment` | (ii) `unit_id: activeUnitId!` → 42501 em Todas | ALTA | Aceitar `unit_id` no payload + `EquipmentForm` com `useFormUnitSelection` |
| **P4** | `use-providers.ts:171` + `ProviderForm.tsx:234/253/273/330` — `useCreateProvider` + sub-mutations | (ii) `unit_id: activeUnitId!` → 42501 em Todas (4 mutations) | ALTA | Mesma pattern P3 |
| **P5** | `use-service-categories.ts:66` — `useCreateServiceCategory` | (ii) `unit_id: activeUnitId!` → 42501 em Todas | ALTA | Mesma pattern P3 (já existe `UnitPickerBanner` em Configurações de Manutenção; replicar) |
| **P6** | `use-equipment-categories.ts:48` — `useCreateEquipmentCategory` | (ii) `throw new Error('Nenhuma unidade selecionada')` antes do INSERT | MÉDIA | Aceitar `unit_id` no payload OR exibir `UnitPickerBanner` quando "Todas" |
| **P7** | `use-suppliers.ts:118` — `useCreateSupplier` (LEGADO) | (ii) `unit_id: activeUnitId!` | BAIXA | Verificar se `/manutencao/fornecedores` ainda é alcançável (rotas redirect → /prestadores). Se dead code, remover na Fase 5; senão, mesma pattern P3 |
| **P8** | `use-maintenance.ts:163` — `useCreateMaintenanceOrder` (LEGADO `maintenance_orders`) | (ii) `unit_id: activeUnitId!` | NENHUMA | Dead code — remover na Fase 5 |
| **P9** | `chamados/page.tsx:143` — `useSectors(true)` no filtro de listagem | (iii) **Confuso silencioso** — dropdown de Setor lista entradas de TODAS as unidades sem distinguir | BAIXA | Anexar nome da unidade no label OR agrupar por unidade. Não crítico (RLS protege a query final). |
| **P10** | `[id]/page.tsx:608/619` — `useLoadingTimeout(isLoading)` threshold 12s | (i) ok com null, mas threshold agressivo em produção lenta | MÉDIA | Aumentar para 20s OU mensagem mais informativa quando dispara. Não está relacionado a "Todas". |
| **P11** | `kanban-board.tsx:206` + `ticket-kanban-board.tsx:294` — `activeUnitId` na queryKey | (i) **OK com null** | NENHUMA | Apenas particiona cache. Comportamento correto. |
| **P12** | `PendingRatingsAlert.tsx:128` — `activeUnitId ?? ratingFor.unit_id` | (i) **OK com null** | NENHUMA | Fallback explícito para `unit_id` do rating. |
| **P13** | Hooks de leitura (`useTickets`, `useTicket`, `useEquipment`, `useProviders`, `useSuppliers`, `useSectors`, `useMaintenanceCategories`, `useMaintenanceItems`, `useMaintenanceCosts`, `useMaintenanceCostsSummary`, `useMaintenanceHistory`, `useMaintenanceTicketsTrend`, `useMaintenanceTicketsPeriod`, `useOverdueMaintenance`, `usePreventiveMaintenance`, `useEquipmentCategoryItems`, `useServiceCategories`, `useEquipmentCategoryNames`) | (i) **OK com null** | NENHUMA | Pattern `if (activeUnitId) q = q.eq('unit_id', activeUnitId)` correto. RLS filtra pelo escopo do usuário. |

Legenda de tipo: (i) ok com null; (ii) quebra/trava em "Todas"; (iii) comportamento incorreto silencioso em "Todas".

#### Resumo numérico

- **5 pontos ALTA** (P1, P2, P3, P4, P5) — quebram criação em "Todas". Mesma família do bug F1 da Fase 2, mas em entidades diferentes (equipamento, prestador, categoria de serviço, foto e execução de ticket).
- **2 pontos MÉDIA** (P6, P10) — degradam UX.
- **2 pontos BAIXA** (P7, P9) — dead code legado + dropdown de filtro.
- **4 pontos NENHUMA** (P8, P11, P12, P13) — comportamento atual correto OU dead code já marcado para remoção na Fase 5.

### 8.5.3 Resposta à Tarefa 3 — Botão delete na tela de detalhe

**Resposta direta: NÃO existe.**

- `grep` por `delete|Trash|Excluir|excluir|remover|Remover` em `[id]/page.tsx` → 0 ocorrências.
- `grep` por `useDeleteTicket|deleteTicket` em `src/` → 0 ocorrências em todo o projeto.
- O dropdown "..." nos cards da listagem (`uid 54_92/100/108`) não tem ação de delete (apenas alterar status via modal).

**Implicação para Fase 3:** a permissão `delete=false` em `user_permissions(module='manutencao')` para `brunocasaletti@hotmail.com` (gerente) e `suporte@grupodrk.com.br` (manutencao) é **inócua** — não há fluxo UI que dispare DELETE em `maintenance_tickets`. A nova policy `unit_delete_tickets` proposta na Fase 3 (`check_permission(..., 'manutencao', 'delete')`) protege a API direta, mas nenhuma role precisa adicionar `delete=true` para uso normal do produto.

**Decisão sugerida:** manter `delete=false` no template do gerente/manutencao. Se um dia for criada a ação UI, decidir caso a caso quem deveria deletar — provavelmente apenas super_admin/diretor.

---

## 8.6 Fase 4b — Plano coordenado para os 5 pontos ALTA + 2 MÉDIA

**Objetivo:** unificar a solução das mesmas pattern de bug (P1–P6) em UM PR coordenado, evitando descobrir os mesmos sintomas em criação de equipamento → prestador → categoria de serviço → upload de foto → adicionar execução, um a um.

### Escopo da Fase 4b

#### 4b.1 — Detalhe do chamado usa `ticket.unit_id` em vez de `activeUnitId` do store

**Arquivos:** `src/app/(auth)/manutencao/chamados/[id]/page.tsx`

**Mudanças:**
- Linha 597 (`handlePhotoUpload`): substituir `if (!file || !ticket || !activeUnitId)` por `if (!file || !ticket)`; usar `ticket.unit_id` na chamada `uploadPhoto({ file, ticketId: ticket.id, unitId: ticket.unit_id })`.
- Linha 803-806 (modal `ExecutionFormModal`): substituir `addExecOpen && activeUnitId && (...)` por `addExecOpen && ticket && (...)`; passar `unitId={ticket.unit_id}`.
- Remover `const { activeUnitId } = useUnitStore()` se ficar sem uso.

**Por quê:** o `ticket.unit_id` é a **fonte de verdade** — o chamado já carregou e tem a unidade certa. O `activeUnitId` do store é irrelevante uma vez que o detalhe está aberto. Mesmo em "Todas", o usuário sabe qual unidade é (ela está no header do ticket).

**Critério de aceite:**
- (a) super_admin em "Todas" + abrir detalhe → upload de foto funciona; modal "Adicionar execução" abre.
- (b) gerente em unidade única → comportamento inalterado.

#### 4b.2 — Mutations de criação aceitam `unit_id` no payload

**Arquivos:** `src/hooks/use-equipment.ts`, `src/hooks/use-providers.ts`, `src/hooks/use-service-categories.ts`, `src/hooks/use-equipment-categories.ts`.

**Mudanças (mesma pattern da Fase 2 em `useCreateTicket`):**
- Tipo do payload ganha `unit_id: string` obrigatório.
- `mutationFn` deixa de ler `activeUnitId` do store.
- `onError` recebe `payload` e passa `payload?.unit_id` para `mapPgError`.

#### 4b.3 — Formulários com `useFormUnitSelection`

**Arquivos:**
- `src/components/features/equipment/equipment-form.tsx`
- `src/app/(auth)/prestadores/components/ProviderForm.tsx`
- `src/app/(auth)/prestadores/components/steps/*` (passos do stepper)
- Formulário de criação de Categoria de Serviço (verificar onde está)
- Formulário de criação de Categoria de Equipamento (verificar onde está)

**Pattern (idêntica à Fase 2):**
- Importar `useFormUnitSelection` de `@/hooks/use-form-unit-selection`.
- Estado `formUnitId` inicializado com `effectiveUnitId` (ou `null` quando "Todas").
- Campo `<UnitSelect>` visível e obrigatório quando `requiresUnitSelection`.
- Submit disabled enquanto `requiresUnitSelection && !formUnitId`.
- Reset cascade: se `formUnitId` mudar, zerar dropdowns dependentes da unidade (ex.: categoria do equipamento, categoria de serviço, contatos do prestador, etc. — auditar caso a caso).
- Payload final: `unit_id: effectiveUnitId`.

#### 4b.4 — Listagem de chamados: dropdown de Setor diferencia unidade (opcional, P9 BAIXA)

**Arquivo:** `src/app/(auth)/manutencao/chamados/page.tsx`

**Quando "Todas as unidades" estiver ativo**, label do `<SelectItem>` no dropdown de Setor passa de `"Salão Principal"` para `"Salão Principal · Pinheiros"`. Implementação: `useSectors(true)` retorna `sector.unit_id`, fazer LEFT JOIN com `units(name)` ou usar `useUnits()` em paralelo.

#### 4b.5 — `useLoadingTimeout` mais informativo (opcional, P10 MÉDIA)

**Arquivos:** `src/hooks/use-loading-timeout.ts`, todas as páginas que usam.

**Mudanças:**
- Aumentar threshold default para **20s** (de 12s).
- Quando dispara, exibir "Está demorando mais do que o normal — verifique sua conexão." em vez de "Tempo esgotado".
- Não afeta Fase 4b crítica; pode ir separado.

### Critérios de aceite da Fase 4b

| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | super_admin em "Todas" abre detalhe de chamado → clica "Adicionar foto" | Foto sobe sem erro; ticket recebe foto na sua unidade |
| 2 | super_admin em "Todas" abre detalhe de chamado → clica "Adicionar execução" | Modal abre normalmente |
| 3 | super_admin em "Todas" → `/equipamentos/novo` | Form exibe campo "Unidade *" obrigatório |
| 4 | super_admin em "Todas" + escolhe unidade no form → submit | Equipamento criado na unidade escolhida |
| 5 | super_admin em "Todas" → `/prestadores/novo` | Form exibe campo "Unidade *" obrigatório |
| 6 | super_admin em "Todas" + cria categoria de serviço/equipamento | Aceita unidade explícita ou exibe UnitPickerBanner |
| 7 | gerente em unidade única | Comportamento inalterado em todos os fluxos acima |
| 8 | (opcional) listagem de chamados em "Todas" → dropdown Setor | Itens com sufixo "· {unidade}" |
| 9 | (opcional) timeout dispara em produção lenta | Mensagem informativa, não alarmante |

### Risco e custo

- **Risco:** baixo — mesma pattern já validada na Fase 2 (modal de Novo Chamado). 4b reaplica em 4–5 lugares.
- **Custo:** ~1 dia (4–6 arquivos de hook + 3–5 formulários).
- **Dependência:** nenhuma. Independe da Fase 3 (RLS) — pode subir antes ou depois.
- **Esperado em paralelo:** sumir definitivamente a classe de bug "ainda achou outro lugar que quebra em Todas".

### ✅ IMPLEMENTAÇÃO 4b — 2026-05-21 — DEPLOYED v1.11.5

> Implementação completa, validada localmente (tsc + lint + build verdes) e no browser. **Deployed em produção via PR #41 / tag v1.11.5 (merge `09b6542`).**

**Arquivos modificados (11):**

| Tipo | Arquivo |
|---|---|
| Hook (P3) | `src/hooks/use-equipment.ts` — novo `EquipmentCreatePayload = Partial<Equipment> & { unit_id: string }`, `useCreateEquipment` deixou de ler store |
| Hook (P4) | `src/hooks/use-providers.ts` — `useProviders(filters, unitIdOverride?)`, `useCreateProvider` lê `payload.unit_id` |
| Hook (P5) | `src/hooks/use-service-categories.ts` — `ServiceCategoryCreatePayload` com `unit_id` obrigatório (sem caller ativo — preventivo) |
| Hook (P6) | `src/hooks/use-equipment-categories.ts` — `useEquipmentCategoryItems(onlyActive, unitIdOverride?)`, `useCreateEquipmentCategory` com `EquipmentCategoryCreatePayload` exigindo `unit_id` |
| Tipo (P4) | `src/types/providers.ts` — `CreateProviderInput.unit_id: string` (obrigatório) |
| Página (P1+P2+P10) | `src/app/(auth)/manutencao/chamados/[id]/page.tsx` — removeu `useUnitStore`, upload foto usa `ticket.unit_id`, modal execução `addExecOpen && ticket && ...` com `unitId={typedTicket.unit_id}`, `EquipmentRow` recebe `ticketUnitId`, `useProviders` filtra pelo ticket. P10: `useLoadingTimeout(isLoading, 20_000)` LOCAL + mensagem "Está demorando mais do que o normal — verifique sua conexão e tente novamente." + botão "Tentar novamente" que faz `refetch()`. |
| Form (P3) | `src/components/features/equipment/equipment-form.tsx` — `useFormUnitSelection` + `UnitPickerBanner` quando criação em "Todas"; `formUnitId` inicializado do equipment em edição; submit disabled sem unidade; payload passa `unit_id: effectiveUnitId` |
| Form (P4) | `src/app/(auth)/prestadores/components/ProviderForm.tsx` — `useFormUnitSelection` + `UnitPickerBanner`; 4 sub-mutations (`createContact/createService/uploadDoc/updateContact`) usam `effectiveUnitId` (criação) ou `provider.unit_id` (edição) — não tocam mais o store |
| Page (P6) | `src/app/(auth)/configuracoes/page.tsx` — useFormUnitSelection separado por aba (`sectorsUnitId`, `equipCatsUnitId`); UnitPickerBanner em cada aba; `canCreate={!requiresUnitSelection \|\| !!effectiveUnitId}` no `ConfigTable`; lista e mutations escopadas à unidade escolhida |

**Validação local:**
- `npx tsc --noEmit` → 0 erros ✅
- `npm run lint` → 0 erros (348 warnings — baseline inalterado) ✅
- `npm run build` → success ✅

**Validação browser (super_admin local em "Todas as unidades", dev server :3004 v1.11.4):**

| Caso | Cenário | Resultado | Screenshot |
|---|---|---|---|
| P1/P2 | Detalhe de ticket Moema em "Todas" → clicar "Adicionar" execução | Modal abre normalmente, lista 11 usuários, botão "Salvar" pronto. Anteriormente o modal NÃO abria. | `docs/screenshots/fase4b-p1p2-detalhe-execucao-modal.png` |
| P3 | `/equipamentos/novo` em "Todas" | UnitPickerBanner amber "Selecione a unidade para cadastrar o equipamento" + dropdown; botão "Cadastrar equipamento" `disabled`. Escolher Moema + nome → criação OK; **DB: `unit = 'moema'` confirmado**. | `docs/screenshots/fase4b-p3-equipamentos-novo-todas-banner.png` + `fase4b-p3-equipamentos-novo-moema-escolhida.png` |
| P4 | `/prestadores/novo` em "Todas" → 4 etapas com Moema | UnitPickerBanner aparece acima do stepper; após escolher Moema, banner muda para "Visualizando configurações por unidade". Criação completa: prestador + contato + serviço; **DB: 1 contato + 1 serviço todos vinculados a Moema**. | `docs/screenshots/fase4b-p4-prestador-moema-preenchido.png` + `fase4b-p4-prestador-cadastrado.png` |
| P6 | `/configuracoes` aba "Categ. Equipamentos" em "Todas" | UnitPickerBanner "Selecione a unidade para criar categorias de equipamento"; **botão "Adicionar categoria" escondido** (canCreate=false). Escolher Moema + criar → toast "Categoria criada"; **DB: `unit = 'moema'` confirmado**. | `docs/screenshots/fase4b-p6-config-categ-todas-banner.png` + `fase4b-p6-categoria-criada-moema.png` |
| Regressão | `/equipamentos/novo` com seletor em **Pinheiros** | Form abre direto sem banner (comportamento original preservado). | `docs/screenshots/fase4b-p3-equipamentos-novo-todas.png` (na verdade screenshot pré-troca; comportamento confirmado em snapshot) |

**Observações:**
- O fluxo P5 (`useCreateCategory` em `use-service-categories.ts`) **não tem caller UI ativo no projeto** — apenas a API server-side `copy-templates/route.ts` faz INSERT. Hook foi deixado seguro (`unit_id` obrigatório no payload) para uso futuro, sem nova UI.
- Como o banco local de Moema não tinha `service_categories`, criamos uma via SQL (`Categoria Teste P4`) só para completar o fluxo de stepper de prestador. Não afeta produção.
- Banco local: 3 entidades criadas em Moema durante validação (equipamento, categoria, prestador+contato+serviço) — pode ser apagado a qualquer momento; não há impacto.

**✅ Empacotado e deployed como v1.11.5** (bump patch, PR #41, merge `09b6542`).

---

## 8.7 Fase 4b — AMPLIADA: fix das leituras-por-id (2026-05-21)

### Trigger

Após implementar P1–P6 da Fase 4b, Bruno navegou de volta para o detalhe do prestador `ed9b2e78` (criado em Moema durante a validação) com o seletor global em Pinheiros. Tela retornou erro "Não foi possível carregar o prestador. Verifique sua conexão."

Diagnóstico: `useProvider(id)` filtrava a query por `activeUnitId` (igual o bug original P1/P2 do detalhe de chamado, mas em outra entidade). O sweep original só cobriu **mutations** (criação); este passo cobre o lado **leitura por id**.

### Critério (bug vs intencional)

- **LEITURA DE UM REGISTRO POR ID** (`useX(id)` / detalhe): NÃO deve filtrar por `activeUnitId`. O id já é único; filtrar por unidade quebra ver um registro de outra unidade. RLS já garante o acesso. Padrão referência: `useTicket(id)` em `use-tickets.ts:114-138`. **→ CORRIGIR.**
- **LEITURA DE LISTA** com `activeUnitId`: pode ser intencional (filtro implícito por unidade ativa). **→ Apenas listar como suspeita, sem alterar.**
- **SUB-LEITURA ligada a um pai** (ex.: eventos de um prestador): derivar do pai ou confiar na RLS própria da tabela filha; nunca depender do store. **→ CORRIGIR como leitura-por-id.**

### Arquivos corrigidos (4)

| Hook | Arquivo | Mudança |
|---|---|---|
| `useProvider(id)` | `src/hooks/use-providers.ts:135` | Removido `activeUnitId` da queryKey + filtro `unit_id` da query. |
| `useProviderEvents(providerId)` | `src/hooks/use-providers.ts:257` | Idem. |
| `useUpdateProvider` / `useDeleteProvider` | mesmo arquivo | Invalidates alinhados com keys novas (`['providers']` / `['provider', id]`). |
| `useProviderRatings(providerId)` | `src/hooks/use-provider-ratings.ts:19` | Sub-leitura por pai. Removido filtro. |
| `useEventRatings(eventId)` | `src/hooks/use-provider-ratings.ts:170` | Idem. |
| `useCreateRating` / `useUpdateRating` | mesmo arquivo | Invalidates alinhados. |
| `useEventProviders(eventId)` | `src/hooks/use-event-providers.ts:34` | Sub-leitura por pai. Removido filtro. |
| `useProviderEvents(providerId)` (**duplicado**) | `src/hooks/use-event-providers.ts:66` | Idem. |
| `useProviderScheduleConflicts` | `src/hooks/use-event-providers.ts:99` | Removido `activeUnitId` da queryKey (query já não filtrava). |
| `useAddProviderToEvent` / `useUpdateEventProvider` / `useRemoveProviderFromEvent` | mesmo arquivo | Invalidates alinhados. |

### Já corretos antes (referência)

- `useTicket(id)` em `use-tickets.ts:114` — padrão referência.
- `useEquipmentItem(id)` em `use-equipment.ts:63` — não usava store.
- `useEquipmentMaintenanceHistory(id)` em `use-equipment.ts:84` — não usava store.
- `useMaintenanceOrder(id)` em `use-maintenance.ts:128` legacy — não usava store.
- `useSupplier(id)` em `use-suppliers.ts:80` legacy — importava `_activeUnitId` sem uso.

### LISTAS suspeitas (NÃO alteradas — pendentes de decisão Bruno)

| Hook | Arquivo:linha | Avaliação |
|---|---|---|
| `useProviders(filters)` | `use-providers.ts:43` | Lista global de prestadores. Em "Todas" não filtra (correto). Filtro por `activeUnitId` quando setado parece intencional — escopo natural do usuário. |
| `usePendingRatings()` | `use-provider-ratings.ts:51` | Avaliações pendentes cross-unit. Em "Todas" lista tudo. Filtro por unidade quando setado é intencional. |
| `useSuppliers(filters)` | `use-suppliers.ts:43` (legado) | Lista de fornecedores legacy. Mesma pattern. |

Para essas, RLS controla acesso; `activeUnitId` na queryKey particiona o cache (não muda comportamento funcional). Não correm risco do bug "detalhe de outra unidade quebra".

### Validação local

- **tsc**: 0 erros ✅
- **lint**: 0 erros (348 warnings — baseline inalterado) ✅
- **build**: success ✅

### Validação browser

Cenário do Bruno: `/prestadores/ed9b2e78-a778-4e89-b3b4-05ad1143494c` (prestador de **Moema**) com seletor global em **Pinheiros**.

**Antes do fix (na sessão anterior):**
- Request: `GET .../service_providers?...&id=eq.ed9b2e78&unit_id=eq.36d3b2e5-...` (filtra por Pinheiros)
- Status: 400 PGRST116 (no rows) — filtro de unidade rejeitava o registro de Moema
- UI: "Não foi possível carregar o prestador"

**Depois do fix (esta sessão):**
- Request: `GET .../service_providers?...&id=eq.ed9b2e78` (**sem `unit_id=`**) ✅
- Validado via `fetch()` direto com o JWT do usuário logado:
  ```json
  {"status":200,"body":"[{\"id\":\"ed9b2e78...\",\"name\":\"Prestador Teste Fase 4b\",\"unit_id\":\"df2e4286-...\"}]"}
  ```
  → Registro de Moema agora alcançado, mesmo com seletor em Pinheiros. RLS deixa passar (super_admin tem `is_global_viewer()` + `user_units` cobrindo ambas).
- Request `event_providers?provider_id=eq.ed9b2e78` (sub-leitura) também passou de 400 → 200.
- Screenshot: `docs/screenshots/fase4b-ampliada-fetch-200-cross-unit.png`

### Bug PRÉ-EXISTENTE descoberto (NÃO relacionado)

A UI ainda mostra "Não foi possível carregar" **no banco local** porque o select completo do `useProvider` inclui `rated_by_user:users!provider_ratings_rated_by_fkey(...)`. A FK `provider_ratings.rated_by` aponta para `auth.users` (não `public.users`), e o PostgREST local roda **12.2.3** que não suporta hints cross-schema. **Em produção, PostgREST = 14.6** que suporta — o select funciona normalmente (Bruno usa essa tela em produção sem reportar essa mensagem). Confirmado via SSH na VPS.

**Esse bug é independente da Fase 4b.** Existia antes; estava mascarado pelo filtro de unidade que rejeitava a query antes de chegar ao select. Não vamos tocar agora — fora do escopo.

### Resultado

A Fase 4b (ampliada) corrige **o bug funcional reportado pelo Bruno** em produção:
- Local: provado via `fetch()` direto que a query agora alcança o registro de outra unidade.
- Produção (após deploy): vai funcionar end-to-end, pois o PostgREST 14.6 resolve o select completo sem o PGRST200 que o 12.2.3 dispara.

### Arquivos modificados nesta sessão (total Fase 4b + ampliada)

```
docs/diagnostico-manutencao.md                          | +201 / -1
src/app/(auth)/configuracoes/page.tsx                   |  +50 / -3
src/app/(auth)/manutencao/chamados/[id]/page.tsx        |  +48 / -23
src/app/(auth)/prestadores/components/ProviderForm.tsx  |  +38 / -10
src/components/features/equipment/equipment-form.tsx    |  +38 / -3
src/hooks/use-equipment-categories.ts                   |  +27 / -7
src/hooks/use-equipment.ts                              |  +14 / -8
src/hooks/use-event-providers.ts                        |  ~30 / -30  (sweep ampliação)
src/hooks/use-providers.ts                              |  ~25 / -14  (P4 + ampliação)
src/hooks/use-provider-ratings.ts                       |  ~25 / -19  (ampliação)
src/hooks/use-service-categories.ts                     |  +31 / -10
src/types/providers.ts                                  |  +1 / -0
```

Total ~ +400 / -130 linhas; +0 dependências.

> **✅ DEPLOYED em 2026-05-21** — commit `8609778` (develop), merge commit `09b6542` (main), PR #41, tag `v1.11.5`. Deploy to Production: success (4m02s). VPS: `package.json v1.11.5` confirmado.

### Fase 5 — Limpeza de código legado (opcional, separável)
**Checkpoint:** Bruno aprova após auditar dados em `maintenance_orders` (F12).

- 5.1 SELECT COUNT(*) em `maintenance_orders` na VPS. Se vazia, marcar tabela como deprecated em comentário SQL.
- 5.2 Remover `src/hooks/use-maintenance.ts` e `src/hooks/use-suppliers.ts` (legacy).
- 5.3 Remover componentes legados de `src/components/features/maintenance/` (lista detalhada em §6.7).
- 5.4 Remover rotas legacy de redirect.

### Fase 6 — Recomendações fora do escopo crítico (opcional, separável)
- 6.1 KPIs server-side via RPC `get_maintenance_kpis_for_unit(p_unit_id UUID)`.
- 6.2 Padronizar filtros do módulo para server-side.
- 6.3 ✅ **Decidido e implementado (2026-05-22):** Equipamentos movido para submenu de Manutenção — ordem: Dashboard / Chamados / Equipamentos / Configurações. Prestadores permanece no topo do grupo Operações. Ver §13.

---

## 9. Próximo passo

**Status atual (2026-05-21):**

| Fase | Status | Versão | PR | Commit |
|---|---|---|---|---|
| Fase 1 — Toast melhorado + mapPgError | ✅ Deployed | v1.11.2 | #38 | `1de05f7` |
| Fase 2 — Fix modal Novo Chamado | ✅ Deployed | v1.11.3 | #39 | `0610b8d` |
| Fase 4 — Dashboard agrega "Todas" | ✅ Deployed | v1.11.4 | #40 | `ecbe55b` |
| **Sweep "Todas" completo** | ✅ Diagnóstico | — | — | — |
| **Fase 4b — Fix coordenado (5 ALTA + 2 MÉDIA)** | ✅ Deployed | v1.11.5 | #41 | `09b6542` |
| **QA Adversarial pós-4b** | ✅ Concluído — ver §10 | — | — | — |
| **Fase 4c — Fix QA-1/QA-2/QA-6 (corrupção de unidade)** | ✅ Deployed — ver §11 | v1.11.6 | #42 | `657f3f7` |
| **QA-3 — "Todas" sobrevive ao reload** | ✅ Deployed — ver §12 | v1.11.7 | #43 | `32e019d` |
| Fase 3 — Migration RLS + backfill (094) | ✅ Aplicada em produção (16→28 policies) — smoke test OK — aguarda validação visual — ver §3.4 | v1.11.8 | #44 | `bd81753` |
| Fase 3.5 — Trigger de aprovação de custo (095) | ✅ Aplicada em produção — smoke test 3/3 PASS — aguarda validação visual — ver §3.5 | v1.11.9 | #45 | `23d8518` |
| Fase 5 — Cleanup código legado | 🔲 Pendente | — | — | — |
| Fase 6 — Otimizações opcionais | 🔲 Pendente | — | — | — |
| **Fechamento do módulo — Sidebar** | ✅ Implementado — aguarda aprovação Bruno + commit — ver §13 | — | — | — |

**Próximo passo:** Bruno validar visualmente em produção — (a) `/manutencao/chamados` como super_admin sem erro de RLS (§3.4); (b) logado como **gerente**, aprovar um custo de verdade em um chamado e confirmar que funciona (§3.5). Fases 3 e 3.5 concluídas após o OK visual. Após aprovar screenshots do §13, commitar sidebar.

---

## 10. QA Adversarial — pós-Fase 4b (2026-05-21)

> **Tipo:** passada adversarial somente-teste sobre o trabalho multiunidade (Fases 2/4/4b, v1.11.5). Nenhum código alterado, nenhuma migration, nenhum commit.
> **Método:** análise estática dos 3 módulos (Manutenção, Equipamentos, Prestadores) + reprodução no browser local (`localhost:3004`, dev server — label exibe `v1.11.4` por env var bakeada no start, mas o código em disco e servido por hot reload é o de `v1.11.5`/`develop`).
> **Usuário:** `teste.diretor@cachola.local` (diretor — global viewer; usado como proxy de super_admin, mesmo `GLOBAL_VIEWER_ROLES`; não há `teste.superadmin` no seed local e a senha de `admin@cachola.local` é desconhecida).
> **Foco:** quebrar a classe de bug multiunidade / "Todas" / troca de unidade no meio do fluxo.

### 10.1 Resumo dos achados

| # | Achado | Severidade | Reproduzido |
|---|---|---|---|
| QA-1 | Trocar o seletor global durante o preenchimento de form de página inteira sobrescreve silenciosamente a unidade escolhida no `UnitPickerBanner` | **MÉDIA** | ✅ browser + SQL |
| QA-2 | `useServiceCategories()` no `ProviderForm` não é escopado pela unidade do form → categoria cross-unit em `provider_services` | **MÉDIA** | ✅ código (mecanismo confirmado) |
| QA-3 | Seleção "Todas as unidades" não sobrevive a reload / cold start — reverte para unidade específica | **MÉDIA** | ✅ browser (localStorage antes/depois) |
| QA-4 | `/configuracoes` (Setores e Categ. Equip.): a lista mistura unidades antes de uma unidade ser escolhida no banner; editar/excluir sem gate | BAIXA | ✅ código |
| QA-5 | `TicketFormModal`: o reset cascade não cobre mudança do seletor global — mas o modal é modal e bloqueia o acesso ao seletor (latente) | BAIXA (latente) | ✅ browser (mitigação confirmada) |
| QA-6 | `EquipmentForm` em edição: dropdown Categoria carrega categorias da unidade do seletor global, não a do equipamento | BAIXA | código |
| QA-7 | Inconsistência de guard entre as 2 abas de `/configuracoes` (`onCreate` de Categ. Equip. tem guard explícito; Setores não) | INFO | código |
| QA-8 | Após criar chamado em "Todas", o seletor global terminou numa unidade específica (provável efeito do QA-3) | INFO | observado |

### 10.2 Achados detalhados

#### QA-1 — [MÉDIA] Troca de seletor global sobrescreve a unidade do `UnitPickerBanner`

**Reprodução (confirmada):**
1. Seletor global em "Todas as unidades". Abrir `/equipamentos/novo` → `UnitPickerBanner` amber aparece.
2. Escolher **Pinheiros** no banner. Preencher Nome = `"QA adversarial - F2 equipamento banner-Pinheiros"`.
3. Sem sair da página, abrir o seletor global do header e trocar para **Moema**.
4. O `UnitPickerBanner` **desaparece** (screenshot `docs/screenshots/qa-f2-equipamento-banner-sumiu.png`). Nenhum aviso.
5. Clicar "Cadastrar equipamento".

**Evidência (SQL):** o equipamento — cujo próprio nome diz "banner-Pinheiros" — foi gravado com `unidade = Buffet Cachola Moema`.

**Causa-raiz:** `useFormUnitSelection(formUnitId)` (`src/hooks/use-form-unit-selection.ts:22-25`) deriva:
- `requiresUnitSelection = activeUnitId === null`
- `effectiveUnitId = requiresUnitSelection ? (formUnitId ?? null) : activeUnitId`

Quando o seletor global deixa de ser "Todas" (`activeUnitId` passa a um UUID), `requiresUnitSelection` vira `false` e `effectiveUnitId` passa a ser **o `activeUnitId` do store**, descartando o `formUnitId` que o usuário escolheu no banner. O banner é renderizado sob `!isEditing && requiresUnitSelection` (`equipment-form.tsx:211`, `ProviderForm.tsx:411`) — então some. O submit usa `unit_id: effectiveUnitId` (`equipment-form.tsx:198`, `ProviderForm.tsx:222`).

**Afeta:** `EquipmentForm` e `ProviderForm` (ambos páginas inteiras — o header e seu seletor estão sempre acessíveis). No `ProviderForm`, provider + contatos + serviços + documentos vão todos para a unidade errada (internamente consistentes entre si). No `EquipmentForm`, só a unidade fica errada (`category` é texto livre, sem FK).

**Correção proposta:** o `formUnitId` deve ter precedência sobre o `activeUnitId` do store assim que o usuário o escolhe explicitamente. Ex.: `effectiveUnitId = formUnitId || activeUnitId` (form vence sempre); e o banner deveria continuar visível enquanto `formUnitId` estiver setado, para o usuário ver/confirmar a unidade. Alternativa: re-exibir o banner com aviso quando `activeUnitId` mudar com o form sujo.

#### QA-2 — [MÉDIA] `useServiceCategories()` no `ProviderForm` ignora a unidade do form

`ProviderForm.tsx:95` chama `useServiceCategories()` sem argumento. O hook (`src/hooks/use-service-categories.ts:14-44`) filtra por `activeUnitId` do **store** e **não aceita `unitIdOverride`**. Em modo "Todas" (`activeUnitId = null`) o filtro `eq('unit_id', ...)` não é aplicado → o dropdown da etapa "Serviços" lista categorias de **todas as unidades** (no banco local: 13 de Pinheiros + 1 de Moema), sem rótulo de unidade.

**Consequência:** criar um prestador na unidade A (escolhida no `UnitPickerBanner`) e adicionar um serviço cuja categoria pertence à unidade B → `provider_services` gravado com `unit_id = A` e `category_id → service_categories` da unidade B. Corrupção cross-unit silenciosa; a FK é válida e a RLS não barra. **Não exige troca mid-flow** — basta estar em "Todas" e criar um prestador com serviço.

A Fase 4b ampliada deu `unitIdOverride` a `useProviders`, mas **não** a `useServiceCategories` — o `ProviderForm` ficou com uma fonte de categorias não escopada.

**Correção proposta:** `useServiceCategories(includeInactive, unitIdOverride?)` aceitar override (mesmo padrão de `useSectors`/`useEquipmentCategoryItems`); `ProviderForm` passar `effectiveUnitId`. Resetar `pendingServices` quando o `formUnitId` mudar.

#### QA-3 — [MÉDIA] "Todas as unidades" não sobrevive a reload / cold start

**Reprodução (confirmada):**
1. Selecionar "Todas as unidades" → `localStorage['cachola-active-unit'] = {"state":{"activeUnitId":null},"version":0}`.
2. Recarregar a página (F5 / `navigate reload`).
3. `localStorage['cachola-active-unit'] = {"state":{"activeUnitId":"36d3b2e5-…"},"version":0}` — voltou para **Pinheiros**.

**Causa-raiz (confirmada por código):** `src/lib/providers.tsx:64-82`. Linha 65: `const storedUnit = stored ? units.find(...) : null` — quando `stored === null` ("Todas" persistido), o ternário `stored ? … : null` curto-circuita para `storedUnit = null`. A linha 67 `if (storedUnit)` então é falsa e o boot cai no `else` (linha 73): `units.find(u => u.is_default) ?? units[0]` → `setActiveUnit(defaultUnit)`. O `null` legítimo de "Todas" é indistinguível de "nunca escolheu uma unidade" — ambos passam pelo mesmo ramo de fallback.

**Impacto:** todo global viewer (super_admin/diretor) que trabalha em "Todas" perde o modo a cada refresh ou cold start de PWA. Pode passar a operar escopado a uma unidade achando que vê tudo (ou vice-versa). Também explica QA-8.

**Correção proposta:** o boot precisa distinguir "`null` persistido intencionalmente (Todas)" de "nunca escolhido" — ex.: um flag separado `hasExplicitUnitChoice`, ou tratar a presença da chave persistida com `version` como decisão válida mesmo com valor `null`.

#### QA-4 — [BAIXA] `/configuracoes`: lista mistura unidades antes da escolha no banner

Em "Todas", antes de escolher a unidade no `UnitPickerBanner`, `effectiveUnitId = null`. `useSectors(false, null)` e `useEquipmentCategoryItems(false, null)` — com `unitIdOverride` explicitamente `null`, o `if (activeUnitId)` é falso e o `eq('unit_id')` não é emitido (`use-sectors.ts:16,24`) → retornam entradas de **todas as unidades** sem rótulo. O banner diz "Selecione a unidade para criar setores", mas a `ConfigTable` abaixo já mostra ~16 setores das duas unidades juntos; os botões editar/excluir de cada linha funcionam sem gate de unidade.

**Risco:** renomear ou desativar o setor "Cozinha" da unidade errada (nomes coincidem entre unidades).

**Correção proposta:** quando `requiresUnitSelection && !effectiveUnitId`, ocultar a `ConfigTable` (como o `SlaTab` da Manutenção já faz) ou rotular cada linha com a unidade.

#### QA-5 — [BAIXA, latente] `TicketFormModal` e a mudança do seletor global

O mesmo mecanismo do QA-1 existe no `TicketFormModal`: o reset cascade só dispara em `set('unit_id', …)` (`ticket-form-modal.tsx:119-128`), não quando o `activeUnitId` do store muda. Se o seletor global mudasse com o modal aberto, `effectiveUnitId` mudaria sem resetar `sector_id`/`category_id`/`item_id`/`equipment_id` → chamado gravado numa unidade com FKs de outra.

**Mitigação confirmada no browser:** o `Dialog` (`@/components/ui/dialog`) é modal — com o modal aberto, o seletor de unidade do header fica inerte/inacessível (o snapshot de a11y nem lista o header). **Não é reproduzível por interação normal de mouse/teclado.** É um risco latente: se o `Dialog` algum dia virar não-modal, o bug ativa. A correção do QA-1 (precedência do `formUnitId`) também cobre este caso.

#### QA-6 / QA-7 / QA-8 — menores

- **QA-6 [BAIXA]:** `EquipmentForm` em edição com o seletor global numa unidade ≠ da do equipamento → `requiresUnitSelection = false` → `effectiveUnitId = activeUnitId` → `useEquipmentCategoryItems` carrega categorias da unidade do seletor, não a do equipamento. `category` é texto livre (sem FK), então não há corrupção de FK, mas a lista oferecida é da unidade errada.
- **QA-7 [INFO]:** em `configuracoes/page.tsx`, o `onCreate` da aba "Categ. Equipamentos" tem `if (!equipCatsUnit.effectiveUnitId) return` explícito; o da aba "Setores" não tem — depende só do `canCreate`. Inconsistência de defensividade (code smell, sem bug funcional: `canCreate` gateia).
- **QA-8 [INFO]:** após criar um chamado em "Todas" e navegar, o seletor global terminou em Pinheiros (unidade do chamado criado). Não foi possível isolar o mecanismo exato — provável efeito combinado do QA-3 (reload) com a navegação. Mencionado para rastreio.

### 10.3 O que foi exercitado e passou limpo

- **Happy path — criar chamado em "Todas":** modal `Novo Chamado` com seletor em "Todas" → campo "Unidade *" obrigatório, escolher Pinheiros + setor "Cozinha" → chamado criado corretamente (`d83a485f`, unit Pinheiros, setor Cozinha).
- **Reset cascade dentro do modal de chamado:** trocar a unidade no campo do form reseta os 4 dependentes (validado na Fase 2; reconferido no código).
- **P1/P2 (Fase 4b):** no detalhe do chamado em "Todas", o modal "Adicionar Execução" abre normalmente (lista colaboradores etc.).
- **v1.11.5 — fix de leitura por id (deep-link cross-unit):** abrir a URL direta de um prestador → `GET /rest/v1/service_providers?…&id=eq.<id>` **sem `unit_id=`** na querystring — query unit-agnóstica, alcança registro de qualquer unidade. `event_providers?provider_id=eq.<id>` (sub-leitura) → HTTP 200, também sem filtro de unidade.
- **Empty state:** `/manutencao/chamados` numa unidade sem chamados → "Nenhum chamado ainda" renderiza corretamente, sem erro.
- **Error state:** detalhe de prestador que falhou ao carregar → mensagem + botões "Tentar novamente" e "Voltar".
- **Validação de obrigatórios:** "Próximo" no `ProviderForm` com CPF/Nome vazios não avança de etapa.
- **`TicketFormModal` é corretamente modal** — background inerte; protege contra o QA-5.

### 10.4 Não testado / fora de escopo

- **Guards de role por rota:** já cobertos pela matriz da Fase 2.8b (CLAUDE.md, 7 roles × 5 rotas). Não re-testados nesta passada — sem valor adversarial novo.
- **Render completo do detalhe de prestador no local:** bloqueado pelo artefato conhecido PGRST200 (PostgREST local 12.2.3 não resolve o embed cross-schema `rated_by_user`); produção usa 14.6 e funciona. Validado via query/network, não via render — conforme instrução do prompt.
- **Duplo submit:** não reproduzido no browser (difícil via automação de UI). Observação estática: os guards (`createTicket.isPending` / `disabled`) dependem de re-render; um duplo-clique sub-frame teoricamente escaparia antes do `isPending` propagar. Risco baixo; vale um teste manual dirigido pelo Bruno se quiser fechar o ponto.
- **Realtime/WebSocket:** não conecta no local (intencional).

### 10.5 Dados de teste criados e removidos

Durante a QA foram criados no banco local (todos com prefixo `QA adversarial`): 1 chamado (`d83a485f`, Pinheiros) e 1 equipamento (Moema). **Ambos removidos ao final** via `DELETE … WHERE … LIKE 'QA adversarial%'`. O prestador `ed9b2e78` (Moema) é resíduo da sessão da Fase 4b anterior — não criado por esta QA; deixado intacto.

---

## 11. Fase 4c — Correção das 3 corrupções silenciosas de unidade (QA-1, QA-2, QA-6)

> **Escopo:** corrige só os 3 achados da QA Adversarial (§10) onde dado é gravado na unidade/categoria ERRADA sem erro. QA-3 (persistência do "Todas" no store) fica para PR separado. QA-4/5/7/8 não incluídos.
> **Status:** ✅ **Deployed em produção** — commit `657f3f7`, merge `08bdddc`, tag `v1.11.6`, PR #42. Deploy concluído em 2026-05-22. Build ID em prod: `08bdddc`.

### 11.1 Arquivos alterados (3)

| Arquivo | Mudança | Resolve |
|---|---|---|
| `src/hooks/use-form-unit-selection.ts` | Escolha de unidade do formulário virou **pegajosa**: `hasFormChoice = !!formUnitId`; `effectiveUnitId = hasFormChoice ? formUnitId : activeUnitId`; `requiresUnitSelection = activeUnitId === null \|\| hasFormChoice`. A escolha explícita do form passa a ter precedência sobre o seletor global e o banner permanece visível/travado. | **QA-1 + QA-6** |
| `src/hooks/use-service-categories.ts` | `useServiceCategories(includeInactive, unitIdOverride?)` — aceita override opcional (mesmo padrão de `useSectors`/`useEquipmentCategoryItems`). Sem override, usa o store (legado). | **QA-2** |
| `src/app/(auth)/prestadores/components/ProviderForm.tsx` | `useServiceCategories(false, effectiveUnitId)` — categorias escopadas à unidade efetiva do form. Novo `handleFormUnitChange` (ligado ao `onChange` do `UnitPickerBanner`) reseta `pendingServices` ao trocar a unidade — evita `provider_services.category_id` cross-unit. | **QA-2** |

**Por que 3 arquivos para 3 bugs:** QA-1 e QA-6 têm a mesma causa-raiz (`useFormUnitSelection` deixava o store sobrescrever a escolha do form) — uma correção resolve os dois. QA-6 (edição de equipamento) é resolvido **transitivamente**: em modo edição `formUnitId` já é `equipment.unit_id`, então com a regra pegajosa `effectiveUnitId = equipment.unit_id` sempre, e o `EquipmentForm` já passava `effectiveUnitId` a `useEquipmentCategoryItems` — nenhuma alteração adicional no `EquipmentForm` foi necessária.

**Defesa em camadas do QA-2:** (a) `useServiceCategories` agora escopa a query pela unidade do form; (b) o banner pegajoso (QA-1) mantém a unidade visível e fixa; (c) `handleFormUnitChange` descarta serviços pendentes ao trocar a unidade. Juntas fecham a janela de corrupção. O override sozinho não bastava: em "Todas" sem unidade escolhida `effectiveUnitId` é `null` e a query volta a não filtrar (padrão "null = sem filtro", igual aos demais hooks) — por isso o reset de `pendingServices` é parte da correção, não escopo extra.

### 11.2 Consumidores verificados (sem regressão)

`useFormUnitSelection` tem 8 call sites — todos rastreados: `ticket-form-modal.tsx`, `equipment-form.tsx`, `ProviderForm.tsx`, `configuracoes/page.tsx` (×2), `manutencao/configuracoes/page.tsx` (×4). Em todos, `requiresUnitSelection` é consumido para mostrar banner/campo e gatear `canCreate`/submit; manter `requiresUnitSelection = true` após a escolha apenas mantém o banner visível (travado) — comportamento desejado. **Efeito colateral consciente:** em `/configuracoes` e `/manutencao/configuracoes`, escolher a unidade na aba e depois trocar o seletor global agora **mantém** a aba na unidade escolhida (antes re-escopava silenciosamente para a unidade global) — consistente com a correção do QA-1. `useServiceCategories` tem 2 call sites: `ProviderForm` (recebe override) e `prestadores/page.tsx` (sem override — inalterado, lista de filtro segue o store).

### 11.3 Validação local

- `npx tsc --noEmit` → 0 erros ✅
- `npm run lint` → 0 erros, 348 warnings (baseline inalterado) ✅
- `npm run build` → sucesso ✅

### 11.4 Validação no browser

Dev server fresh em `localhost:3002` (v1.11.5), usuário `teste.diretor@cachola.local`, service workers/caches limpos.

| Caso | Cenário | Resultado | Evidência |
|---|---|---|---|
| **QA-1 equipamento** | "Todas" → `/equipamentos/novo` → banner = Pinheiros → preencher nome → trocar seletor global p/ Moema | Banner **permaneceu** travado em "Buffet Cachola Pinheiros"; submit → **SQL: equipamento gravado em Pinheiros** (antes ia p/ Moema) | `docs/screenshots/qa4c-f1-equip-banner-pegajoso.png` + SQL |
| **QA-1 prestador** | "Todas" → `/prestadores/novo` → banner = Pinheiros → trocar seletor global p/ Moema | Banner **permaneceu** em "Buffet Cachola Pinheiros" (antes sumia) | `docs/screenshots/qa4c-f1-prestador-banner-pegajoso.png` |
| **QA-2** | `ProviderForm` em "Todas", banner = Pinheiros | Rede: `GET service_categories?…&unit_id=eq.36d3b2e5…` (Pinheiros) quando `effectiveUnitId`=Pinheiros; sem `unit_id=` quando "Todas" sem escolha — o override flui corretamente | reqid 3262 (escopada) vs 3273 (sem escopo) |
| **QA-6** | Editar equipamento de **Moema** com seletor global em **Pinheiros** | Dropdown Categoria lista **só "Categoria Teste Fase 4b"** (categoria de Moema) — não as 9 de Pinheiros | `docs/screenshots/qa4c-f6-edicao-categoria-da-unidade-do-equip.png` |
| **Regressão** | `/equipamentos/novo` e `/prestadores/novo` com seletor global numa unidade específica | Sem banner; form usa a unidade do store (comportamento original preservado) | snapshot |

**Limitação de validação — QA-2 reset de `pendingServices`:** não foi possível dirigir o stepper do `ProviderForm` até a etapa "Serviços" pela automação de browser (o input de CPF mascarado não sincroniza o estado React via eventos sintéticos da ferramenta — fricção de automação, não bug de produto; a validação de obrigatórios da etapa 1 funciona corretamente, ver §10.3). O reset (`handleFormUnitChange` → `setPendingServices([])`, ligado ao `onChange` do banner) está verificado por código + `tsc`. Recomenda-se um teste manual rápido do Bruno: em "Todas", `ProviderForm`, escolher unidade A → adicionar um serviço → trocar a unidade do banner → confirmar que a lista de serviços pendentes esvaziou.

### 11.5 Dados de teste

Criado e **removido** ao final: 1 equipamento (`QA4c - F1 equip banner-Pinheiros`, Pinheiros). O `ProviderForm` do QA-2 não chegou a ser submetido — nenhum prestador criado. Baseline do banco local restaurado.

### 11.6 git diff (resumo)

```
src/hooks/use-form-unit-selection.ts                    | reescrito — lógica pegajosa
src/hooks/use-service-categories.ts                     | +unitIdOverride em useServiceCategories
src/app/(auth)/prestadores/components/ProviderForm.tsx  | useServiceCategories(false, effectiveUnitId) + handleFormUnitChange
```

3 arquivos, +0 dependências, sem migration.

---

## 12. QA-3 — "Todas as unidades" deve sobreviver ao reload

> **Escopo:** PR separado da Fase 4c. Corrige a causa-raiz da confusão "o seletor voltou para Pinheiros sozinho". Mexe no **store global de unidade** (`unit-store`) usado pelo app inteiro — por isso o smoke check cross-módulo (§12.5) é obrigatório.
> **Status:** ✅ implementado e validado localmente (branch `develop`, v1.11.6). **Aguardando aprovação do Bruno — sem commit/push/PR/deploy.**

### 12.1 Causa-raiz

`providers.tsx → loadUserUnits` lê `useUnitStore.getState().activeUnitId` na hidratação. O `null` é **ambíguo**: significa tanto "usuário escolheu Todas" quanto "usuário nunca escolheu" (default em memória). A linha `stored ? units.find(...) : null` cai no `else` em ambos os casos e aplica o `is_default` — sobrescrevendo a escolha "Todas" no F5.

### 12.2 Arquivos alterados (5)

| Arquivo | Mudança |
|---|---|
| `src/stores/unit-store.ts` | Novo campo persistido `hasExplicitSelection: boolean` + nova action `selectUnit()` (marca o flag) + `setActiveUnit()` mantida intacta para uso programático. `partialize` persiste o flag; `reset()` (logout) zera o flag. |
| `src/lib/providers.tsx` | `loadUserUnits` recebe `profile`; novo ramo: se `stored === null && hasExplicitSelection && hasRole(profile?.role, GLOBAL_VIEWER_ROLES)` → preserva `null` ("Todas") em vez de cair no `is_default`. 2 call sites atualizados. |
| `src/components/layout/unit-switcher.tsx` | `setActiveUnit` → `selectUnit` (escolha do usuário no header). |
| `src/components/shared/select-unit-modal.tsx` | `setActiveUnit` → `selectUnit`. |
| `src/app/(auth)/admin/unidades/setup/components/UnitSetupWizard.tsx` | `setActiveUnit` → `selectUnit`. |

**Decisão de design:** `setActiveUnit` (programático — boot, impersonate) **não** marca escolha; só `selectUnit` (escolha do usuário pela UI) marca. A checagem `hasRole(..., GLOBAL_VIEWER_ROLES)` no `loadUserUnits` neutraliza um flag remanescente de outro usuário no mesmo browser (tab fechada sem logout): só super_admin/diretor podem ter "Todas" restaurado. `reset()` no logout zera o flag — dupla proteção.

**Comportamento preservado (primeira visita / usuários atuais):** localStorage sem `hasExplicitSelection` → o merge do persist usa o default `false` → cai no `is_default`, exatamente como hoje. Não muda o default de primeira visita.

### 12.3 Limite de migração (esperado, não é regressão)

Usuários que **hoje** têm `activeUnitId: null` persistido (tinham "Todas" pré-fix) revertem ao `is_default` **uma vez** após o deploy — o blob antigo não tem `hasExplicitSelection`. A partir da próxima escolha de "Todas", o flag é gravado e a preferência passa a grudar. É a fronteira de migração, não um bug.

### 12.4 Validação local

- `npx tsc --noEmit` → 0 erros ✅
- `npm run lint` → 0 erros, 348 warnings (baseline inalterado) ✅
- `npm run build` → sucesso ✅

Browser: dev server fresh em `localhost:3003` (v1.11.6), usuário super_admin (global viewer), service workers/caches limpos.

| Caso | Cenário | Resultado | Evidência |
|---|---|---|---|
| **QA-3** | Selecionar "Todas" → F5 | localStorage = `{"activeUnitId":null,"hasExplicitSelection":true}`; seletor permanece "Todas as unidades"; dashboard passa de 38→50 eventos (visão consolidada das 2 unidades) | `qa3-1-todas-antes-do-reload.png` + `qa3-2-todas-sobreviveu-ao-reload.png` |
| **Regressão 1** | Selecionar Moema → F5 | localStorage = `{"activeUnitId":"df2e4286…","hasExplicitSelection":true}`; seletor permanece "Moema"; dashboard mostra 12 eventos (só Moema) | snapshot |
| **Regressão 2** | Blob pré-fix `{"activeUnitId":null}` (sem flag) → F5 | Cai no `is_default` (Pinheiros), `hasExplicitSelection:false`; dashboard 38 eventos | `qa3-3-regressao-pre-fix-cai-no-default.png` |

### 12.5 Smoke check cross-módulo (de-risk do blast radius global)

Com "Todas" persistido após reload, todos os módulos carregaram sem erro:

| Módulo | Resultado | Evidência |
|---|---|---|
| Início (`/dashboard`) | ✅ calendário + KPIs, 50 eventos consolidados | §12.4 |
| Manutenção — Chamados | ✅ KPIs + lista de chamados | `qa3-smoke-1-manutencao-chamados.png` |
| Manutenção — Dashboard | ✅ KPIs + 3 gráficos + últimos chamados | `qa3-smoke-2-manutencao-dashboard.png` |
| BI (`/bi`) | ✅ KPIs + Detalhe por Unidade + Comparativo + funil + Origem dos Leads (ambas unidades) | `qa3-smoke-3-bi.png` |
| Checklist Operacional | ✅ KPIs + filtros + empty state | `qa3-smoke-4-checklists.png` |
| Eventos (`/eventos`) | ✅ 711 itens, ambas as unidades | `qa3-smoke-5-eventos.png` |

Console: 2 erros não relacionados ao QA-3 — `SyntaxError` de uma extensão de browser (`chrome-extension://…recordConsoleEvents.js`, não é código do app) e falha de WebSocket do realtime do Supabase local (ruído conhecido de dev). Nenhum erro originado das mudanças.

### 12.6 git diff (resumo)

```
src/stores/unit-store.ts                                      | +hasExplicitSelection + selectUnit
src/lib/providers.tsx                                         | loadUserUnits(profile) + ramo "Todas" explícito
src/components/layout/unit-switcher.tsx                       | setActiveUnit → selectUnit
src/components/shared/select-unit-modal.tsx                   | setActiveUnit → selectUnit
src/app/(auth)/admin/unidades/setup/.../UnitSetupWizard.tsx   | setActiveUnit → selectUnit
```

5 arquivos, +0 dependências, sem migration.

### 12.7 Resultado do deploy

- **Commit:** `32e019d` | **Versão:** v1.11.7 | **PR:** #43
- **Build ID em produção:** `71099ef` (merge commit main)
- **Deploy:** verde — run `26263218479` (2m57s)

**Validação pós-deploy solicitada ao Bruno:**
1. Login como super_admin → selecionar "Todas as unidades" → F5 → seletor permanece em "Todas" ✅?
2. Logout → login como gerente → confirmar unidade padrão (nunca "Todas") ✅?
3. v1.11.7 no rodapé ✅?

**Nota migration boundary:** usuários com `{activeUnitId:null}` sem o campo `hasExplicitSelection` (pré-deploy) voltarão à unidade padrão no primeiro reload pós-deploy. Comportamento esperado — na próxima seleção explícita de "Todas", o flag é gravado e persiste normalmente.

---

---

## 13. Fechamento do Módulo — Reorganização da Sidebar (2026-05-22)

### 13.1 Decisão

Equipamentos movido do nível superior do grupo "Operações" para **dentro do submenu de Manutenção**. Motivação: Equipamentos serve exclusivamente o fluxo de Manutenção (referenciado em `maintenance_orders`, `maintenance_executions`, sem outro módulo dependente — ver §3.2). Agrupar visualmente reforça a coesão funcional.

**Ordem no submenu Manutenção:** Dashboard → Chamados → **Equipamentos** → Configurações

**Prestadores:** permanece no topo do grupo Operações — serve outros módulos além de Manutenção (Eventos, Financeiro etc.) e tem `PRESTADORES_ACCESS_ROLES` mais amplo.

### 13.2 Mudança aplicada

**Arquivo:** `src/components/layout/nav-items.ts`

```diff
 children: [
   { label: 'Dashboard',     href: ROUTES.maintenanceDashboard, ... MAINTENANCE_ADMIN_ROLES   },
   { label: 'Chamados',      href: ROUTES.maintenanceChamados,  ... MAINTENANCE_MODULE_ROLES  },
+  { label: 'Equipamentos',  href: ROUTES.equipment,            ... MAINTENANCE_MODULE_ROLES  },
   { label: 'Configurações', href: ROUTES.maintenanceConfig,    ... MAINTENANCE_ADMIN_ROLES   },
 ],
-{ label: 'Equipamentos', href: ROUTES.equipment, ... MAINTENANCE_MODULE_ROLES },
```

- Rota `/equipamentos` inalterada — nenhum redirect, nenhuma migration
- `allowedRoles: [...MAINTENANCE_MODULE_ROLES]` idêntico ao que era no nível superior
- Estado ativo: `hasActiveChild` em `sidebar.tsx` já usa `pathname.startsWith(c.href + '/')` — cobre `/equipamentos/[id]`, `/equipamentos/novo` automaticamente

### 13.3 Validação técnica

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run lint` | ✅ 0 erros novos (348 warnings preexistentes) |
| `npm run build` | ✅ Verde |

### 13.4 Comportamento por role

| Role | Vê Manutenção? | Vê Equipamentos (submenu)? | Vê Prestadores? |
|---|---|---|---|
| super_admin / diretor / gerente | ✅ | ✅ | ✅ |
| manutencao | ✅ | ✅ | 🚫 (PRESTADORES_ACCESS_ROLES não inclui manutencao) |
| vendedora | 🚫 | 🚫 | 🚫 |
| pos_vendas | 🚫 | 🚫 | 🚫 |
| financeiro | 🚫 | 🚫 | ✅ |
| decoracao | 🚫 | 🚫 | ✅ |

### 13.5 Status

🔲 **Aguarda aprovação do Bruno** (screenshots + diff) antes de commitar/push/PR.

Skills consultadas: cachola-stack (SKILL.md + references/auth-and-session.md), cachola-supabase-ops (SKILL.md). cachola-dev-sync pulada — fluxo de implementação coberto pelo protocolo do CLAUDE.md.
