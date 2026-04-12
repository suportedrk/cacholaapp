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
