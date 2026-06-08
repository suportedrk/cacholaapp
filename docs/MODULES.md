# MODULES.md — Estado Atual dos Módulos

> Estado atual de cada módulo: o que existe, arquivos-chave e decisões específicas.
> Para histórico detalhado de implementação, ver git log.

---

## EVENTOS

**Rota base:** `/eventos`

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/eventos/page.tsx` | Lista com abas temporais (hoje/semana/mês/todos), agrupamento por dia, filtros de status, load more |
| `src/app/(auth)/eventos/[id]/page.tsx` | Detalhe com accordion sections, QuickActionsBar mobile, timeline |
| `src/app/(auth)/eventos/[id]/editar/page.tsx` | Formulário de edição |
| `src/app/(auth)/eventos/novo/page.tsx` | Formulário de criação |
| `src/hooks/use-events.ts` | `useEvents`, `useEventsInfinite`, `useEventsTabCounts`, `useEvent`, `useCreateEvent`, `useUpdateEvent`, `useChangeEventStatus`, `useDeleteEvent`, `useEventsKpis` |
| `src/components/features/events/` | `event-card.tsx`, `event-filters.tsx`, `event-form.tsx`, `event-temporal-tabs.tsx`, `event-day-group.tsx`, `events-kpi-cards.tsx`, `event-timeline.tsx` |
| `src/hooks/use-event-conflicts.ts` | `useEventConflicts`, `useConflictingEventIds`, `useOverlappingEventIds`, `useShortGapEventIds` |

**Campos extras (migration 019 + 020):** `client_phone`, `client_email`, `theme`, `father_name`, `school`, `birthday_date`, `has_show`, `photo_video`, `decoration_aligned`, `payment_method`, `briefing`, `deal_amount`, + 12 outros campos do Ploomes.

**Status possíveis:** `confirmed` | `lost` (sem `cancelled` — removido em migration 016). `lost` oculto por padrão na listagem.

**Conflito de horário:** gap_minutes ≤ 0 = sobreposição (vermelho); 0 < gap_minutes < 120 = intervalo curto (âmbar). Função SQL `get_event_conflicts(unit_id)`.

---

## CHECKLISTS

**Rota base:** `/checklists`

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/checklists/page.tsx` | Lista com KPIs, filtros, cards premium |
| `src/app/(auth)/checklists/[id]/page.tsx` | Preenchimento com filtro por status, footer sticky, offline support |
| `src/app/(auth)/checklists/[id]/components/` | `checklist-item-row.tsx`, `checklist-detail-header.tsx`, `item-assign-popover.tsx`, `item-deadline-popover.tsx`, `item-comments-sheet.tsx`, `export-pdf-modal.tsx`, `duplicate-checklist-modal.tsx` |
| `src/app/(auth)/checklists/components/checklist-card.tsx` | Card da listagem (PREMIUM — este é o arquivo usado pela listagem, não o legado em features/) |
| `src/app/(auth)/checklists/templates/` | Lista, novo, editar templates |
| `src/app/(auth)/checklists/recorrencias/page.tsx` | Gestão de regras de recorrência |
| `src/app/(auth)/checklists/minhas-tarefas/page.tsx` | Visão pessoal cross-checklist |
| `src/hooks/use-checklists.ts` | 15+ hooks — ver arquivo para lista completa |
| `src/hooks/use-checklist-comments.ts` | `useChecklistItemComments`, `useAddComment`, `useDeleteComment` |
| `src/hooks/use-checklist-recurrences.ts` | `useChecklistRecurrences`, `useCreateRecurrence`, `useUpdateRecurrence`, `useDeleteRecurrence` |
| `src/hooks/use-my-tasks.ts` | `useMyTasks`, `useMyCompletedTasksCount` |

**Tipos:** `event` | `standalone` | `recurring`
**Prioridades:** `low` | `medium` | `high` | `urgent`
**Item status:** `pending` | `done` | `na`

**ATENÇÃO — dois arquivos ChecklistCard:**
- `src/app/(auth)/checklists/components/checklist-card.tsx` → usado pela listagem `/checklists` (PREMIUM)
- `src/components/features/checklists/checklist-card.tsx` → legado, não usado na listagem

**Selects importantes em use-checklists.ts:**
- `CHECKLIST_LIST_SELECT` — para listagem, inclui `checklist_item_comments(id)` nos itens
- `CHECKLIST_DETAIL_SELECT` — para detalhe, inclui `checklist_item_comments(id)` + joins completos

**Offline:** `useOfflineChecklist` — React Query quando online; IDB snapshot quando offline. Sync ao voltar online (status + notes apenas).

**Cron:** `POST /api/cron/generate-recurring-checklists` — gera checklists recorrentes quando `next_generation_at <= now()`.

---

## MANUTENÇÃO

**Rota base:** `/manutencao`

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/manutencao/page.tsx` | Lista com tabs (Lista/Kanban), filtros, OverdueBanner, PreventiveSchedule |
| `src/app/(auth)/manutencao/[id]/page.tsx` | Detalhe com QuickActionsBar mobile, SlaCard, seção de custos, timeline combinada |
| `src/app/(auth)/manutencao/nova/page.tsx` | Formulário de criação |
| `src/app/(auth)/manutencao/fornecedores/` | CRUD de fornecedores |
| `src/hooks/use-maintenance.ts` | `useMaintenanceOrders`, `useMaintenanceOrder`, `useCreateMaintenanceOrder`, `useCompleteMaintenanceOrder` (cria recorrente automático), `useOverdueOrders`, `useUpcomingPreventives` |
| `src/hooks/use-maintenance-costs.ts` | `useMaintCosts`, `useSubmitCost`, `useApproveCost`, `useRejectCost` |
| `src/hooks/use-maintenance-stats.ts` | `useMaintenanceStats` via `GET /api/maintenance/stats` |
| `src/hooks/use-suppliers.ts` | CRUD completo de fornecedores com docs e contatos |
| `src/components/features/maintenance/` | kanban-board, kanban-card, cost-card, cost-form-modal, sla-card, preventive-schedule, quick-actions-bar, history-tab, etc. |

**Tipos:** `emergency` | `punctual` | `recurring` | `preventive`
**Workflow de custos:** `pending` → `approved` / `rejected` (apenas gerentes aprovam, exceto próprio custo)
**Kanban:** 4 colunas: `open` / `in_progress` / `waiting_parts` / `completed`. DnD com @dnd-kit. Persistido em localStorage (`maintenance-view-mode`).

---

## EQUIPAMENTOS

**Rota base:** `/equipamentos`

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/equipamentos/` | CRUD completo (list, novo, [id], [id]/editar) |
| `src/hooks/use-equipment.ts` | `useEquipment`, `useEquipmentItem`, `useEquipmentMaintenanceHistory`, `useCreateEquipment`, `useChangeEquipmentStatus`, `useEquipmentCategories` |
| `src/components/features/equipment/` | `equipment-card.tsx`, `equipment-form.tsx` |

**Categorias:** gerenciadas em `/configuracoes` (tab "Categ. Equipamentos") via `equipment_categories` table. Fallback hardcoded se tabela vazia.

**FK em manutenção:** `maintenance_orders.equipment_id` → `equipment.id` (nullable). Substituiu campo texto livre.

---

## PRESTADORES DE SERVIÇOS

**Rota base:** `/prestadores`

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/prestadores/page.tsx` | Lista com KPIs, PendingRatingsAlert, filtros |
| `src/app/(auth)/prestadores/[id]/page.tsx` | Detalhe com accordion (contatos, serviços, docs, histórico, avaliações) |
| `src/app/(auth)/prestadores/novo/page.tsx` | Formulário multi-step 4 passos |
| `src/app/(auth)/prestadores/[id]/editar/page.tsx` | Edição multi-step |
| `src/hooks/use-providers.ts` | `useProviders`, `useProvider`, `useProviderKpis`, `useCreateProvider`, `useDeleteProvider`, `useProviderScheduleConflicts` |
| `src/hooks/use-event-providers.ts` | `useEventProviders`, `useAddProviderToEvent`, `useUpdateEventProvider`, `useRemoveProviderFromEvent` |
| `src/hooks/use-provider-ratings.ts` | `useProviderRatings`, `useEventRatings`, `useCreateRating`, `usePendingRatings` |
| `src/types/providers.ts` | Todos os tipos do módulo |
| `src/lib/utils/providers.ts` | `formatPhone`, `formatCPF`, `formatCNPJ`, `formatCurrency`, `parseAddressFromZip` |

**Documentos:** bucket `provider-documents` (20MB, privado). `expiry_alert_sent = true` garante idempotência do cron de alertas.

**Associação com eventos:** seção "Prestadores" no detalhe do evento — `event_providers` table.

**Cron:** `POST /api/cron/check-provider-alerts` — docs vencendo/vencidos + ratings pendentes 24–48h.

---

## DECORAÇÃO

**Rota base:** `/decoracao` (catálogo, categorias, temas, estoque, transferências, quarentena) + seção "Decoração" no detalhe do evento `/eventos/[id]`.

**Estado:** fase "Mari" completa (Blocos A–F) + foto por variação (migration 142) — tudo em produção, app em v1.44.0. Módulo nasceu com a camada de dados dourada (RLS + RPCs via `check_permission('decoracao', action)`) desde a migration 097.

### O que cada bloco entregou
| Bloco | Migration | Entrega |
|-------|-----------|---------|
| A | 128–129 | Itens repaginados: `decoracao_categorias` (10 categorias seed: balões, boleiras, mobiliário, displays, objetos decorativos, personagens 3D, bolos falsos, vasos e cestos, tecidos, tapetes), `categoria_id` + `preco_custo`/`preco_venda` nos itens, refator `tipo`→`origem` (acervo/fornecedor) |
| B | 130 | Tema vira "receita": `decoracao_tema_itens` (tema → variações + quantidade). Tema tem foto modelo em `decoracao_temas.foto_url` |
| C | 131 | Festa puxa o tema: `decoracao_festa` + `decoracao_festa_itens` (snapshot da receita, editável na festa, SEM reserva de estoque), romaneio de separação imprimível, foto override por festa, bucket `decoracao-festa` |
| D | 132 | Encerramento item a item (qtd_ok/quebrado/perdido/quarentena) com baixa `GREATEST(0,…)` no saldo + aba Quarentena (`decoracao_quarentena`, resolver consertado/descartado). Guard de integridade: festa encerrada → 409 em PATCH e em vincular |
| E | 133 | Galeria de fotos da montagem por festa (`decoracao_festa_fotos`, multi-upload, lightbox, legenda) — o registro; distinta da foto modelo/override |
| F | (sem migration) | Sugestão de transferência: na área de Transferências, compara lista da festa × saldo do local e sugere o que trazer da outra unidade; pré-preenche a Nova Transferência |

**Pós-fase Mari — Foto por variação (migration 142, v1.44.0):** a pedido do diretor Vinícius, cada variação de item (`decoracao_item_variacoes`) ganhou `foto_path` (registro visual por tamanho/cor). Upload por variação no editor do item via PhotoDropZone, bucket `decoracao-itens`, miniatura via signed URL. As RPCs `create/update_decoracao_item_with_variacoes` (mig 104) foram recriadas (corpo verbatim + foto_path), sem mudança de assinatura.

### Tabelas (RLS dourado via `check_permission('decoracao', action)`)
`decoracao_categorias`, `decoracao_itens` (+ `decoracao_item_variacoes`, agora com `foto_path`), `decoracao_temas`, `decoracao_tema_itens`, `decoracao_festa`, `decoracao_festa_itens`, `decoracao_quarentena`, `decoracao_festa_fotos` + infraestrutura de estoque pré-existente (`decoracao_estoque_saldo`, locais, transferências via RPC `criar_transferencia`).

### Arquivos-chave
| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/eventos/[id]/components/sections/EventDecoracaoSection.tsx` | Seção Decoração na festa (vincular tema, lista editável, foto, galeria) |
| `src/app/(auth)/eventos/[id]/components/sections/FestaFotosGaleria.tsx` | Galeria de fotos da montagem (Bloco E) |
| `src/app/(auth)/decoracao/_components/sugerir-pela-festa-sheet.tsx` | Sugestão de transferência pela festa (Bloco F) |
| `src/app/(auth)/decoracao/_components/nova-transferencia-sheet.tsx` | Nova transferência (aceita `initialSeed` via key-remount) |
| `src/app/(auth)/decoracao/_components/transferencias-client.tsx` | Área de transferências + botão "Sugerir pela festa" |
| `src/app/(auth)/decoracao/_components/item-editor.tsx` | Editor de item + variações (foto por variação, signed URLs agregadas, orphan cleanup) |
| `src/app/(auth)/decoracao/_components/variacao-card.tsx` | Card de variação (campo de foto via PhotoDropZone/PhotoThumb) |
| `src/hooks/use-decoracao.ts` | Hooks do módulo (categorias, itens, temas, festa, fotos, quarentena) |
| `src/hooks/use-sugestao-transferencia.ts` | `useFestasComDecoracao`, `useSugestaoTransferencia` (cálculo client, read-path dourado) |
| `src/types/decoracao.ts` | Tipos do módulo |
| `src/config/roles.ts` | `DECORACAO_MANAGE_ROLES` = [super_admin, diretor, gerente, decoracao]; `DECORACAO_DELETE_ROLES` = [super_admin, diretor] |

### Decisões e padrões
- **Sem reserva de estoque ao vincular tema** — a baixa só acontece no encerramento (Bloco D). Vincular gera lista + romaneio, não mexe em saldo.
- **Encerramento usa `GREATEST(0, saldo − consumo)`** — nunca trava por saldo insuficiente; aviso não-bloqueante quando zera.
- **Guard de integridade** — festa encerrada não pode ser editada nem re-vinculada (409). Re-vincular re-snapshota = "reabrir" disfarçado.
- **Sugestão de transferência (Bloco F) = read-path puro** — sem migration/RPC; lê `decoracao_festa_itens` + `decoracao_estoque_saldo` (ambas RLS view), nasce dourada. Lógica: `falta = max(0, precisa − tem)`; `sugerido = min(falta, saldo origem)`. Default de origem assume 2 locais (o Select cobre mais).
- **Pré-preenchimento da transferência** via `key`-remount + estado inicial (NÃO effect-hydration — evita clobber do `resetForm`/`handleOrigemChange`).
- **RLS de tabela-filha** — INSERT/UPDATE/DELETE gateados por `'edit'` (não `'delete'`): remover linha de uma lista é editar o pai. Vale para `festa_itens`, `tema_itens`, `festa_fotos`.

### RBAC
- Camada de dados dourada desde a migration 097. O backfill da 097 deu grants individuais a todos os usuários gerente/decoracao/diretor/super_admin — por isso essas contas aparecem com grants próprios na auditoria; são **redundantes com o cargo, NÃO overrides**.
- Decoradora (role `decoracao`) acessa por estar em `DECORACAO_MANAGE_ROLES` e em `EVENTOS_ACCESS_ROLES`.
- **Auditoria de overrides (gate de deploy):** conjunto CORRETO é `NOT IN ('super_admin','diretor','gerente','decoracao')` para view/create/edit e `NOT IN ('super_admin','diretor')` para delete. Usar só super_admin+diretor gera FALSO POSITIVO com as contas gerente.

### Pendências
- **Balões — decisão em alinhamento (jun/2026):** o diretor Vinícius respondeu que prefere UNIFICAR (tratar balões como item de fornecedor terceiro, eliminar o submódulo de OS de balões, deixar só a categoria "Balões" em Itens). Aguardando a Mari alinhar (ela ainda não fechou). Quando confirmar, desenhar a migração com cuidado: mover os dados da OS de balões para Itens + aposentar o submódulo sem quebrar o que roda. **NÃO mexer na OS de balões até o alinhamento final.**
- **FASE B (RBAC):** converter os guards por cargo restantes para permissão — layout pai `/decoracao` e tela `/transferencias` (hoje `requireRoleServer(DECORACAO_MANAGE_ROLES)`). Re-scan delta antes.
- **Default de origem da sugestão** assume 2 locais; revisitar quando surgir um 3º local permanente.
- Backlog: "reabrir/desfazer" encerramento; órfãos de storage da decoração.

---

## PLOOMES CRM

**Integração:** Sincroniza deals do Ploomes → eventos no sistema.

| Arquivo | Função |
|---------|--------|
| `src/lib/ploomes/client.ts` | HTTP singleton com retry 3x |
| `src/lib/ploomes/field-mapping.ts` | `DEAL_FIELD_MAP` (32 campos), `parseDeal()` |
| `src/lib/ploomes/sync.ts` | `syncDeals()` com paginação OData ($top=100), `resolveUnitId()` via `ploomes_unit_mapping` |
| `src/app/api/ploomes/` | sync, sync/status, config, webhook-register, deals, upload |
| `src/app/api/webhooks/ploomes/route.ts` | Valida `X-Ploomes-Validation-Key`, processa Win/Update |
| `src/app/api/cron/ploomes-sync/route.ts` | Sync automático com notificação após 3 falhas |
| `src/hooks/use-ploomes-sync.ts` | `usePloomesSyncStatus` (polling), `useTriggerPloomesSync` |

**StatusId Ploomes → status DB:**
- `StatusId=1` (Em aberto) → `confirmed`
- `StatusId=2` (Ganho) → `confirmed`
- `StatusId=3` (Perdido) → `lost`

**Mapeamento de unidade:** tabela `ploomes_unit_mapping` (ploomes_value TEXT → unit_id UUID). Prioridade: lookup exato → ilike em units.name → primeira unidade ativa.

**Link deal:** `https://app10.ploomes.com/deal/{ploomes_deal_id}` (derivado do ID, não de `ploomes_url`).

---

## DASHBOARD

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/dashboard/page.tsx` | 5 KPI cards + calendário + SetupChecklistCard |
| `src/hooks/use-dashboard.ts` | `useDashboardKpis`, `useDashboardStats`, `useCalendarEvents`, `useCalendarMaintenance` |
| `src/components/features/dashboard/` | `kpi-card.tsx` (com sparkline Recharts), `calendar-view.tsx` (3 visões CSS Grid) |

**KPIs (5 cards):**
| KPI | Métrica | Período |
|-----|---------|---------|
| Eventos do Mês | COUNT confirmed | date da festa no mês atual |
| Taxa de Conversão | confirmed / (confirmed+lost) × 100 | date da festa no mês atual |
| Leads do Mês | COUNT todos status | date da festa no mês atual |
| Manutenções Abertas | COUNT status NOT IN (completed,cancelled) | snapshot atual |
| Checklists Pendentes | COUNT status NOT IN (completed,cancelled) | snapshot atual |

**IMPORTANTE:** Usar campo `date` (data da festa) para agrupar por mês — NUNCA `created_at` (todos os eventos têm created_at igual à data do sync Ploomes em batch).

---

## MULTI-UNIDADE

| Arquivo | Função |
|---------|--------|
| `src/stores/unit-store.ts` | Zustand persist — `activeUnitId`, `activeUnit`, `userUnits` |
| `src/hooks/use-units.ts` | CRUD completo + `useMyUnits`, `useUnitUsers`, `useSetDefaultUnit` |
| `src/components/layout/unit-switcher.tsx` | Dropdown no navbar — invalida todas as queries ao trocar |
| `src/app/(auth)/admin/unidades/` | CRUD + wizard de setup (5 etapas) |

**`activeUnitId = null`** = visão de todas as unidades (super_admin/diretor). Hooks NÃO devem travar em `enabled: !!activeUnitId` — `null` é estado legítimo.

**Wizard de setup:** `/admin/unidades/setup` (nova) e `/admin/unidades/[id]/setup` (existente) — 5 etapas: Dados, Ploomes, Templates, Equipe, Prestadores.

---

## RELATÓRIOS

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/relatorios/page.tsx` | 4 abas (Eventos/Manutenção/Checklists/Equipe), lazy loaded |
| `src/hooks/use-reports.ts` | `useEventReport`, `useMaintenanceReport`, `useChecklistReport`, `useStaffReport` |
| `src/lib/utils/export.ts` | `exportToExcel`, `exportReportPDF`, `exportChecklistPDF`, `exportProviderPDF` |

**13 RPC functions** em `supabase/migrations/011_fase3_reports.sql` (SECURITY INVOKER + GRANT EXECUTE TO authenticated).

---

## CONFIGURAÇÕES

**Rota base:** `/configuracoes`

Tabs: Tipos de Evento | Pacotes | Salões | Setores | Categ. Equipamentos | Horários | Geral | Identidade Visual | Integrações

| Arquivo | Função |
|---------|--------|
| `src/hooks/use-unit-settings.ts` | `useUnitSettings`, `useUnitSettingsData`, `useUpdateUnitSettings`, `useUnitBrand` |
| `src/hooks/use-equipment-categories.ts` | CRUD de categorias de equipamento |
| `src/components/features/settings/` | `general-settings-tab.tsx`, `business-hours-tab.tsx`, `brand-identity-tab.tsx`, `config-table.tsx` |

**Unit settings:** JSONB em `unit_settings.settings`. Upsert via `onConflict: 'unit_id'`. Inclui campo `brand: { accent_color?, logo_url?, display_name? }`.

**Identidade Visual:** cor de destaque override via `style={{ '--primary': accentColor }}` em `UnitAccentWrapper`. Logo em bucket `user-avatars/unit-logos/{unitId}/logo.jpg`.

---

## VENDEDORAS

**Rota base:** `/configuracoes/vendedoras`

Gestao da tabela `sellers` (vendedoras/operadores espelhados do Ploomes via `owner_id`). Escrita: `SELLERS_MANAGE_ROLES` (super_admin + diretor).

| Arquivo | Funcao |
|---------|--------|
| `src/app/(auth)/configuracoes/vendedoras/vendedoras-client.tsx` | Lista com abas (Todas/Ativas/Inativas/Sistema), edicao via sheet, botao "Sincronizar do Ploomes" |
| `src/app/(auth)/configuracoes/vendedoras/seller-edit-sheet.tsx` | Edita status, unidade, contratacao/desligamento, notas, conta de sistema |
| `src/hooks/use-sellers.ts` | `useSellers`, `useUpdateSeller`, `useAvailableSellersForInvite` |
| `src/lib/ploomes/sync-sellers.ts` | `syncSellersFromPloomes` — importa usuarios ativos do Ploomes (`/Users`, filtro `Suspended === false`) |
| `src/app/api/ploomes/sync-sellers/route.ts` | POST — dispara o sync (gate `SELLERS_MANAGE_ROLES`), logAudit module `settings` |

**Origem dos dados:** `sellers` e populada por duas portas — (1) trigger `trg_auto_insert_seller` ao chegar Order nova em `ploomes_orders` (migration 054); (2) botao "Sincronizar do Ploomes" via `/Users` (v1.49.0). O `owner_id` e o `Id`/`OwnerId` do usuario no Ploomes — chave de ligacao com deals/orders/BI.

**Idempotencia do sync:** `ON CONFLICT (owner_id)` — atualiza so `name` (e `email` se nulo); nunca toca `status`, `is_system_account`, `primary_unit_id`, `notes`, `hire_date`, `termination_date` (curadoria manual preservada). Contas de integracao do Ploomes entram como ativas e devem ser marcadas como `is_system_account` manualmente.

**Gotcha:** `/Users` usa `Suspended`, nao `Active` (`$select=Active` retorna HTTP 400). Ver skill `ploomes-cachola-api` gotcha #19.

---

## NOTIFICAÇÕES

| Arquivo | Função |
|---------|--------|
| `src/hooks/use-notifications.ts` | Lista 50 notificações, `markRead`, `markAllRead`, `deleteNotification`, Realtime subscription |
| `src/components/layout/notification-bell.tsx` | Slide-over com filtros por categoria, swipe-to-archive mobile, bell shake + áudio |
| `src/lib/notifications.ts` | Funções fire-and-forget: `notifyEventCreated`, `notifyMaintenanceEmergency`, etc. |

**RPC:** `create_notification` (SECURITY DEFINER) — permite inserir para outros usuários bypassando RLS.

---

## LOGS DE AUDITORIA

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/admin/logs/page.tsx` | Tabela com diff visual, filtros, load more |
| `src/hooks/use-audit-logs.ts` | `useInfiniteQuery` cursor-based (100/página) |
| `src/components/features/audit/` | `audit-diff.tsx`, `audit-filters.tsx`, `audit-log-table.tsx` |

---

## USUÁRIOS E PERMISSÕES

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/admin/usuarios/` | Lista, novo, [id] (editar + ativar/desativar), [id]/permissoes (matriz 8×5) |
| `src/hooks/use-users.ts` | `useUsers`, `useUser`, `useUpdateUser`, `useDeactivateUser`, `useReactivateUser` |
| `src/hooks/use-permissions.ts` | `useUserPermissions`, `useUpdatePermission` |
| `src/app/api/admin/users/route.ts` | POST — cria usuário via Auth Admin API |

---

## LAYOUT E NAVEGAÇÃO

| Arquivo | Função |
|---------|--------|
| `src/components/layout/sidebar.tsx` | 240px/64px colapsável desktop, drawer mobile, estado em localStorage |
| `src/components/layout/navbar.tsx` | h-12 mobile / h-14 desktop, shadow ao rolar, botões: Search, UnitSwitcher, NotificationBell, Avatar |
| `src/components/layout/nav-items.ts` | Definição dos grupos e itens de navegação |
| `src/components/layout/breadcrumbs.tsx` | Geração automática por rota, `HIDDEN_SEGMENTS` (admin oculto), `SEGMENT_LABELS` |
| `src/components/features/command-palette/command-palette.tsx` | Ctrl+K — busca global: eventos, checklists, manutenção, equipamentos, prestadores |
| `src/hooks/use-keyboard-shortcuts.ts` | Atalhos: `G+D/C/M/E/S` para navegação, `N` abre notificações, `?` abre shortcuts |

---

## OFFLINE MODE

| Arquivo | Função |
|---------|--------|
| `src/lib/offline-db.ts` | Schema IDB: `checklists` (snapshot), `checklist_items` (fila sync), `calendar_events` (cache) |
| `src/hooks/use-online-status.ts` | `useOnlineStatus()` |
| `src/hooks/use-sync-manager.ts` | Auto-sync ao voltar online — envia status + notes |
| `src/hooks/use-offline-checklist.ts` | Hook unificado online/offline |

**Supabase Realtime (Docker local):** `_client.realtime.disconnect()` no init do singleton — evita loop de reconexão. Remover em produção quando Realtime estiver configurado na VPS.

---

## E-MAIL (SMTP)

| Arquivo | Função |
|---------|--------|
| `src/lib/email.ts` | Singleton nodemailer, lazy init, graceful fallback sem SMTP vars |
| `src/lib/email-templates/` | `base.ts` (layout HTML), `maintenance-emergency.ts`, `maintenance-overdue.ts`, `event-tomorrow.ts`, `checklist-overdue.ts`, `generic-notification.ts` |

**SMTP:** Hostinger `smtp.hostinger.com:465 SSL`, remetente `noreply@cachola.cloud`.
**GoTrue SMTP:** configurado separado no `.env` da VPS para e-mails de auth (recovery, invite).

---

## AUTENTICAÇÃO

| Arquivo | Função |
|---------|--------|
| `src/hooks/use-auth.ts` | `useAuth()` — profile, signIn, signOut, resetPassword, loadUserUnits |
| `src/middleware.ts` (proxy.ts) | Session refresh, redirects, route protection por role |
| `src/app/(public)/login/page.tsx` | Layout split desktop, classifyError, state machine idle/loading/success |
| `src/app/auth/callback/route.ts` | Troca code por sessão OAuth. Usa `NEXT_PUBLIC_SITE_URL` para redirect (NUNCA request.url) |

**Google OAuth:** trigger `block_unauthorized_oauth_signup` — bloqueia contas Google cujo e-mail não está em `public.users` ou está inativo (migration 028 + 029).

**`ADDITIONAL_REDIRECT_URLS`** (não `GOTRUE_URI_ALLOW_LIST`) controla allowlist OAuth no self-hosted. Após mudar: `docker compose up -d --force-recreate auth`.

---

## CENTRAL DE SERVIÇOS

Área de uso geral da empresa para todos os colaboradores. **Publicada em produção em v1.46.0 (03/jun/2026, PR #60, merge `e9d6fc7`).** Módulo **GLOBAL**: tabelas sem `unit_id`; a "unidade" é sempre apenas um **rótulo informativo** (geral/pinheiros/moema), nunca trava de segurança.

### RBAC — reaproveita um único módulo `central_servicos`
Code PT-BR `central_servicos` (migration 144). **NÃO** há módulo por feature — Links, Contatos e Avisos compartilham o mesmo conjunto de permissões:
- `view` → **todos os 13 cargos** (qualquer colaborador vê o conteúdo vigente)
- `create` / `edit` / `delete` → **só super_admin + diretor**

Guard de rota: `requirePermissionServer('central_servicos','view')` em `(auth)/central-servicos/layout.tsx`. APIs: `requirePermissionApi('central_servicos', action)`. UI: botões de CRUD via hook `useCentralServicosPermissions` (chama a RPC `check_permission` no client — trata o bypass de super_admin). Item de sidebar com `allowedRoles` omitido (view universal).

### O que cada bloco entregou
- **Bloco A (mig 144):** fundação — registra `central_servicos` em `modules` + `permission_controls` (4 ações) + `role_permissions`/`role_default_perms` (template) + backfill de `user_permissions`; rota `/central-servicos` (hub) e menu.
- **Bloco B (mig 145):** **Links úteis** — atalhos para sistemas/portais. Ícone via `icone_url` → favicon do domínio → `Globe` (onError).
- **Bloco C1 (mig 146):** **Agenda de Contatos** (pessoas) + **bucket PRIVADO** `central-servicos-contatos`. RLS REFORÇADA: a SELECT esconde inativos no banco para quem só tem view.
- **Bloco C2 (mig 147):** **Grupos** ("quem recebe") — `tipo` pessoa/grupo + tabela de membros; "quem recebe" via JOIN `!inner` (a RLS do C1 esconde membros inativos). Limpeza confiável (await) da foto antiga na troca (PATCH).
- **Bloco D (mig 148):** **Mural de Avisos** (RLS de vigência) + **guard da troca de tipo** de contato (trigger + API 409 + campo desabilitado na UI).

### Tabelas (RLS via `check_permission('central_servicos', action)`)
| Tabela | Conteúdo | Observações de RLS |
|--------|----------|--------------------|
| `central_servicos_links` | Links úteis | SELECT: `view OR is_global_viewer`; CUD por ação. Inativos filtrados na **consulta** do cliente |
| `central_servicos_contatos` | Pessoas e grupos (`tipo`) | SELECT REFORÇADA: `view AND (ativo OR edit)` → inativo escondido no **banco** |
| `central_servicos_grupo_membros` | Membros de grupo ("quem recebe") | SELECT: `view AND grupo visível (ativo OR edit)`; INSERT/DELETE = `edit` (tabela filha) |
| `central_servicos_avisos` | Mural de avisos | SELECT: `view AND (edit OR (publicado_em<=now AND (expira_em IS NULL OR expira_em>now)))` |

### Storage (bucket privado de fotos)
`central-servicos-contatos` (`public=false`, 5 MB, jpeg/png/webp). Policies em `storage.objects` gateadas por `check_permission`: **leitura = view**, **upload = create OR edit**, **update = edit**, **remoção = delete OR edit**. Leitura via signed URL (`useSignedUrls`); upload client-side direto (`PhotoDropZone`). Como o contato inativo nem retorna pela RLS para quem só lê, o `foto_path` dele não vaza.

### Triggers
- `validate_grupo_membro` (em `central_servicos_grupo_membros`): grupo_id deve ser `tipo=grupo`, membro_id `tipo=pessoa`; sem aninhamento; sem auto-membro.
- `validate_contato_tipo_change` (BEFORE UPDATE OF tipo em `central_servicos_contatos`): bloqueia trocar o tipo de um contato com vínculos (grupo com membros, ou pessoa membro de algum grupo).

### Arquivos-chave
- Rotas/UI: `app/(auth)/central-servicos/{page.tsx, layout.tsx, links/, contatos/, avisos/, _components/}`
- Hooks: `hooks/use-central-servicos-links.ts` (+ `useCentralServicosPermissions`), `use-central-servicos-contatos.ts` (+ `useGrupoMembros`, `useContatoVinculosCount`), `use-central-servicos-avisos.ts`
- APIs: `app/api/central-servicos/{links,contatos,contatos/[id]/membros,avisos}/`
- Tipos/constantes: `types/central-servicos.ts`, `ROUTES.centralServicos*` em `lib/constants/index.ts`
- Reuso: `components/shared/photo-upload.tsx` (PhotoDropZone), `hooks/use-signed-urls.ts`, `components/shared/photo-lightbox.tsx` (PhotoLightbox — modo foto única, avatar clicável quando há foto real; v1.46.2)

### LGPD (Contatos = dado pessoal)
Agenda interna de trabalho (legítimo interesse / execução do contrato — art. 7), **sem tela de consentimento**. Minimização (art. 6 III): só contatos corporativos. Retenção (art. 16): saída = **inativar** (some para todos); exclusão definitiva só Diretoria. Foto antiga removida do bucket de forma confiável na troca/exclusão (sem órfão).

### Pendências / backlog
- Extrair `useCentralServicosPermissions` para arquivo próprio (hoje em `use-central-servicos-links.ts`, consumido por links/contatos/avisos).
- Tabelas de conteúdo nascem vazias em produção (time popula os dados reais).

---

## MIGRATIONS (ordem)

| Migration | Conteúdo |
|-----------|----------|
| 001–004 | Schema inicial, RLS, functions, seed |
| 005–006 | Config tables (event_types, packages, venues, checklist_categories) |
| 007 | Checklists update (item status, bucket checklist-photos) |
| 008 | Notifications functions |
| 009 | Manutenção (sectors, types, buckets) |
| 010 | Multi-unidade (units, user_units, unit_id em todas as tabelas) |
| 011 | Reports (13 RPC functions) |
| 012 | Equipamentos |
| 013 | Settings (unit_settings, equipment_categories) |
| 014–015 | Ploomes (sync_log, config) |
| 016 | Status 'lost' em events |
| 017 | Manutenção schema expandido (suppliers, costs, preventive) |
| 018–018b | Checklists premium (priority, type, recurrence, comments) |
| 019 | Events extra fields (client_phone, client_email, theme) |
| 020 | Ploomes enrichment (22 campos) |
| 021 | Prestadores de serviços |
| 022 | Ploomes unit mapping |
| 028–029 | Bloqueio OAuth não autorizado |
| … | (sequência completa em `supabase/migrations/`; ordem é estrita NNN_) |
| 144–148 | **Central de Serviços** (v1.46.0–1.46.2): 144 fundação RBAC · 145 Links · 146 Contatos + bucket privado · 147 Grupos + triggers · 148 Avisos + guard de troca de tipo. v1.46.1–1.46.2 frontend-only (sem migration): UX Agenda + lightbox de foto (createPortal fix) |
