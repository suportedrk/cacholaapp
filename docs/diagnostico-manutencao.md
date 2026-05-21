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

### Fase 3 — Migration de RLS + backfill de permissões (alinha módulo ao padrão)
**Checkpoint:** Bruno aprova plano de migration + smoke test local antes de aplicar em produção.

> ⚠️ **Risco de regressão em produção:** adicionar `check_permission(..., 'manutencao', ...)` a 8 tabelas que hoje não têm role-gate significa que, no momento exato em que a policy entra em vigor, qualquer usuário cujo `user_permissions` não tenha linha para `module='manutencao'` perde acesso imediato. Hoje a única barreira é o guard de layout — usuários em `MAINTENANCE_MODULE_ROLES` podem ter chegado nessa role sem nunca terem recebido linhas de permissão correspondentes (especialmente os criados antes da reconciliação da migration 073 e do PR 4 de templates por cargo). A migration **precisa** fazer backfill antes de ativar as novas policies, dentro da mesma transação.

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

### Fase 4 — Fix do dashboard "Todas"
**Checkpoint:** Bruno aprova após Bruno testar dashboard em "Todas" como super_admin.

- 4.1 Alterar `/api/maintenance/stats` para aceitar `unit_id` ausente quando o requisitante é `is_global_viewer()` (consultar via Supabase server) e agregar todas as unidades do escopo do usuário.
- 4.2 Para roles não-globais com `user_units` em múltiplas unidades, agregar todas elas.
- 4.3 Idem para `/api/maintenance/history-summary`.
- 4.4 Validar visualmente o painel com super_admin "Todas", diretor "Todas" e gerente em unidade única.

### Fase 5 — Limpeza de código legado (opcional, separável)
**Checkpoint:** Bruno aprova após auditar dados em `maintenance_orders` (F12).

- 5.1 SELECT COUNT(*) em `maintenance_orders` na VPS. Se vazia, marcar tabela como deprecated em comentário SQL.
- 5.2 Remover `src/hooks/use-maintenance.ts` e `src/hooks/use-suppliers.ts` (legacy).
- 5.3 Remover componentes legados de `src/components/features/maintenance/` (lista detalhada em §6.7).
- 5.4 Remover rotas legacy de redirect.

### Fase 6 — Recomendações fora do escopo crítico (opcional, separável)
- 6.1 KPIs server-side via RPC `get_maintenance_kpis_for_unit(p_unit_id UUID)`.
- 6.2 Padronizar filtros do módulo para server-side.
- 6.3 Decidir com Bruno se Equipamentos vai para submenu de Manutenção (sidebar). Mantém Prestadores no topo (recomendação firme).

---

## 9. Próximo passo

Aguardar revisão e aprovação do Bruno. **Nenhuma alteração de código foi feita.** Para iniciar a implementação:

1. Confirmar reprodução do erro em dev local (Fase 1.1).
2. Aprovar plano da Fase 1 isoladamente para que o toast melhorado vá em PR rápido — vai ajudar a diagnosticar bugs futuros do mesmo tipo.
3. Decidir se a Fase 3 (migration de RLS) entra junto da Fase 2 (UX) ou em PR separado — Fase 3 sem Fase 2 é inócua, Fase 2 sem Fase 3 deixa F3 (vulnerabilidade defense-in-depth) aberto.

---

Skills consultadas: cachola-rbac-pattern (SKILL.md + roles-ts-annotated.md + patterns-by-layer.md), cachola-stack (referência rápida), cachola-supabase-ops (referência). cachola-dev-sync pulada — modo investigação (somente leitura).
