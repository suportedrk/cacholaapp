# CLAUDE.md — Memória Persistente do Cachola OS

> **Instrução:** Este arquivo é a memória persistente do projeto. Leia SEMPRE antes de qualquer implementação. Atualize SEMPRE após concluir um bloco.

---

## IDENTIDADE DO PROJETO

**Cachola OS** é um SaaS/PWA web que unifica a operação diária de um Buffet Infantil: eventos, checklists, manutenção, comunicação interna, calendário e gestão de equipe.

- **Problema:** Informações espalhadas em WhatsApp, planilhas e cadernos
- **Solução:** Sistema centralizado com rastreabilidade total
- **Metodologia:** Vibe Coding — Claude planeja + implementa, Bruno testa + valida

---

## STACK TECNOLÓGICA

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js | 16.2.1 |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 4.x (CSS-based config) |
| Components | shadcn/ui | 4.x (Tailwind v4 compatible) |
| Backend/DB | Supabase Self-Hosted | Community (Docker) |
| Auth | Supabase GoTrue | via @supabase/ssr |
| State server | TanStack Query | latest |
| State client | Zustand | latest |
| PWA | @ducanh2912/next-pwa | latest |
| Icons | Lucide React | latest |
| Toasts | Sonner | latest |
| Hosting dev | Docker Desktop (Windows 11) | — |
| Hosting prod | VPS Hostinger Ubuntu 24.04 + Nginx + Certbot | — |

> ⚠️ **Tailwind v4**: Não usa `tailwind.config.ts`. Toda configuração é via CSS em `globals.css` com `@theme inline {}`.

---

## REPOSITÓRIO

- **GitHub:** `suportedrk/cacholaapp`
- **Branch principal:** `main` (produção)
- **Branch desenvolvimento:** `develop`
- **Credenciais:** Em `GITHUB_CREDENTIALS.MD` (NUNCA commitar)

---

## ESTRUTURA DE PASTAS

```
src/
├── app/
│   ├── (auth)/          # Rotas protegidas (requerem login)
│   ├── (public)/        # Login, recuperação de senha
│   ├── api/             # Route handlers
│   └── layout.tsx
├── components/
│   ├── ui/              # shadcn/ui customizados
│   ├── layout/          # Navbar, Sidebar, Breadcrumbs
│   ├── features/        # Componentes por módulo
│   └── shared/          # Componentes reutilizáveis
├── lib/
│   ├── supabase/        # client.ts, server.ts, middleware, types
│   ├── ploomes/         # (vazio — Fase 2)
│   ├── utils/           # Helpers genéricos
│   └── constants/       # Enums, configurações
├── hooks/               # Custom hooks (useEvents, useUsers, etc.)
├── types/               # TypeScript types globais
│   ├── database.types.ts  # Gerado do schema Supabase
│   └── permissions.ts     # Types de roles/permissões
├── stores/              # Zustand stores
└── styles/              # (referenciado por globals.css)
```

---

## DESIGN SYSTEM

- **Arquivo fonte:** `DESIGN_SYSTEM_CLAUDE_CODE.md` (raiz do projeto)
- **LEIA ANTES** de criar qualquer componente visual
- **Tokens aplicados** em `src/app/globals.css`

### Cores da Marca

| Token | oklch | Hex | Uso |
|-------|-------|-----|-----|
| `--primary` | `oklch(0.567 0.044 144)` | `#7C8D78` | Verde sálvia — botões primários, navbar ativa |
| `--secondary` | `oklch(0.876 0.026 65)` | `#E3DAD1` | Bege quente — backgrounds, cards |
| `--background` | `oklch(0.981 0.004 106)` | `#FAFAF8` | Fundo geral |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Cards, modais |
| `--brand-primary-dark` | `oklch(0.487 0.044 144)` | ~`#697a65` | Hover de primário |
| `--brand-primary-light` | `oklch(0.667 0.038 144)` | ~`#8fa08b` | Backgrounds sutis |

### Convenção de Cores
- NUNCA usar hex diretamente na UI
- SEMPRE usar tokens semânticos: `bg-primary`, `text-foreground`, `border-border`, etc.
- Tailwind v4: as classes utilitárias são geradas via `@theme inline {}` em globals.css

---

## BANCO DE DADOS

### Schema Completo

> Ver `supabase/migrations/001_initial_schema.sql` para DDL completo.

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema (espelha auth.users) |
| `user_permissions` | Permissões granulares por usuário |
| `role_default_perms` | Template de permissões por role |
| `events` | Eventos/festas agendadas |
| `event_staff` | Funcionários escalados por evento |
| `checklists` | Checklists associados a eventos/templates |
| `checklist_items` | Itens individuais do checklist |
| `checklist_templates` | Templates reutilizáveis de checklist |
| `template_items` | Itens dos templates |
| `maintenance_orders` | Ordens de serviço de manutenção |
| `maintenance_photos` | Fotos antes/depois de manutenção |
| `notifications` | Notificações por usuário |
| `audit_logs` | Log de auditoria de todas as operações |

### Roles

```
super_admin → Acesso total
diretor     → Dashboard, relatórios, aprovações
gerente     → Eventos, equipe, checklists, manutenção
vendedora   → Eventos vinculados, checklists de vendas
decoracao   → Checklists decoração, fotos
manutencao  → Ordens manutenção, checklists técnicos
financeiro  → Relatórios, valores
rh          → Gestão usuários, escalas
freelancer  → Evento do dia, checklist designado
entregador  → Rotas do dia, checklist carga
```

### RLS
- Todas as tabelas com dados sensíveis têm Row Level Security ativo
- Verificação usa tabela `user_permissions` (não role direto)

---

## VARIÁVEIS DE AMBIENTE

Ver `.env.example` para lista completa.

| Variável | Onde usar |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server apenas (nunca expor) |
| `SUPABASE_JWT_SECRET` | Server apenas |
| `NEXT_PUBLIC_APP_VERSION` | UI (badge de versão) |

---

## COMANDOS ÚTEIS

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar app (apenas Next.js, sem Docker)
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

### Docker — Supabase Self-Hosted + App

```bash
# Subir todos os containers (desenvolvimento)
docker compose up -d

# Ver logs de todos os containers
docker compose logs -f

# Ver logs de um container específico
docker compose logs -f supabase-db
docker compose logs -f supabase-auth
docker compose logs -f app

# Parar todos os containers
docker compose down

# Parar e remover volumes (CUIDADO: apaga banco)
docker compose down -v

# Reiniciar um container específico
docker compose restart supabase-auth

# Executar migrations manualmente (SEMPRE via bash -c no Windows)
docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/001_initial_schema.sql"
docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/002_rls_policies.sql"
docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/003_functions.sql"
docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/004_seed.sql"

# ⚠️ Após primeiro `docker compose up`, também rodar (uma vez):
# docker exec cacholaos-db psql -U postgres -c "ALTER ROLE supabase_auth_admin WITH PASSWORD 'POSTGRES_PASSWORD';"
# docker exec cacholaos-db psql -U postgres -c "ALTER ROLE authenticator WITH PASSWORD 'POSTGRES_PASSWORD';"
# docker exec cacholaos-db psql -U postgres -c "ALTER ROLE supabase_storage_admin WITH PASSWORD 'POSTGRES_PASSWORD';"
# docker exec cacholaos-db psql -U postgres -c "ALTER ROLE supabase_replication_admin WITH PASSWORD 'POSTGRES_PASSWORD';"
# docker exec cacholaos-db psql -U postgres -c "CREATE DATABASE _analytics;"
# docker exec cacholaos-db psql -U postgres -d _analytics -c "GRANT ALL ON DATABASE _analytics TO supabase_admin; CREATE SCHEMA IF NOT EXISTS _analytics; GRANT ALL ON SCHEMA _analytics TO supabase_admin;"
# docker exec cacholaos-db psql -U postgres -c "CREATE SCHEMA IF NOT EXISTS _realtime; GRANT ALL ON SCHEMA _realtime TO supabase_admin, postgres;"

# Acessar PostgreSQL direto
docker compose exec supabase-db psql -U postgres -d postgres

# Backup do banco
docker compose exec supabase-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql
```

### Docker — Produção

```bash
# Build e subir produção (na VPS)
docker compose -f docker-compose.prod.yml up -d --build

# Renovar SSL (Certbot)
docker compose -f docker-compose.prod.yml exec certbot certbot renew

# Ver logs produção
docker compose -f docker-compose.prod.yml logs -f app
```

---

## CONVENÇÕES OBRIGATÓRIAS

| Item | Convenção |
|------|-----------|
| Arquivos | `kebab-case` → `event-card.tsx` |
| Componentes React | `PascalCase` → `EventCard` |
| Custom Hooks | `camelCase` + `use` → `useEvents` |
| Types/Interfaces | `PascalCase` + sufixo → `EventFormData` |
| Tabelas banco | `snake_case` → `maintenance_orders` |
| Commits | Conventional Commits → `feat:`, `fix:`, `docs:` |
| Idioma código | Inglês |
| Idioma interface | Português Brasileiro |
| Layout | Mobile-first obrigatório |

---

## REGRAS INVIOLÁVEIS

1. NUNCA codificar sem planejar — SEMPRE gere plano e aguarde aprovação do Bruno
2. NUNCA alterar sem documentar — Toda mudança atualiza este CLAUDE.md
3. NUNCA alterar visual sem documentar — Toda mudança visual atualiza DESIGN_SYSTEM_CLAUDE_CODE.md
4. NUNCA quebrar o que funciona — lint + type check antes de commitar
5. PERGUNTE na dúvida — não assuma
6. NUNCA hardcode credenciais — sempre variáveis de ambiente
7. NUNCA ignore erros — trate com mensagens amigáveis em PT-BR
8. NUNCA crie componentes sem responsividade mobile-first
9. NUNCA hardcode valores de select (tipos de evento, pacotes, setores) — configuráveis
10. SEMPRE loading states, empty states e error states em TODA tela
11. SEMPRE transições suaves e feedback visual

---

## O QUE FOI IMPLEMENTADO

### Fase 0 — Bloco 1: Setup do Projeto (2026-03-26)
- [x] Next.js 16.2.1 + TypeScript strict + Tailwind v4 + App Router
- [x] ESLint, Prettier, shadcn/ui 4.x, TanStack Query, Zustand, @ducanh2912/next-pwa, lucide-react, sonner, @supabase/ssr
- [x] `.env.example`, `.gitignore`, `globals.css`, `next.config.ts`
- [x] `src/types/permissions.ts`, `src/lib/constants/index.ts`, `src/lib/utils.ts`

### Fase 0 — Bloco 2: Docker + Supabase Self-Hosted (2026-03-26)
- [x] `docker-compose.yml` (dev): supabase-db, auth, rest, realtime, storage, imgproxy, kong, studio, meta, analytics, app
- [x] `docker-compose.prod.yml`: + nginx + certbot
- [x] `docker/kong.yml`: API Gateway routing
- [x] `.env.example` atualizado com todas variáveis Supabase

### Fase 0 — Bloco 3: Banco de Dados (2026-03-26)
- [x] `supabase/migrations/001_initial_schema.sql`: 13 tabelas, extensões uuid-ossp + pg_trgm + unaccent
- [x] `supabase/migrations/002_rls_policies.sql`: RLS em todas tabelas, check_permission(), auth_user_id()
- [x] `supabase/migrations/003_functions.sql`: handle_new_user() trigger, reload_user_permissions(), audit_log_trigger()
- [x] `supabase/migrations/004_seed.sql`: permissões padrão por role, system_config

### Fase 0 — Bloco 4: Autenticação (2026-03-26)
- [x] `src/lib/supabase/client.ts` + `server.ts` (createClient, createAdminClient)
- [x] `src/middleware.ts`: session refresh, redirects, route protection por role
- [x] `src/hooks/use-auth.ts`: useAuth() — profile, signIn, signOut, resetPassword
- [x] `src/app/(public)/login/page.tsx`: form mobile-first, show/hide senha
- [x] `src/app/(public)/recuperar-senha/page.tsx`: form + success state

### Fase 0 — Bloco 5: Layout Base (2026-03-26)
- [x] `src/lib/providers.tsx`: QueryClientProvider + TooltipProvider + Sonner + ReactQueryDevtools
- [x] `src/components/layout/sidebar.tsx`: fixed desktop / drawer mobile, nav items
- [x] `src/components/layout/navbar.tsx`: hamburguer, breadcrumbs, NotificationBell, avatar + dropdown
- [x] `src/components/layout/breadcrumbs.tsx`: geração automática por rota
- [x] `src/app/(auth)/layout.tsx` + `src/components/layout/app-layout.tsx`
- [x] `src/app/(auth)/dashboard/page.tsx`: placeholder

### Fase 0 — Bloco 6: Módulo de Usuários (2026-03-26)
- [x] `src/types/database.types.ts`: convertido interface → type (fix Supabase GenericTable compatibility); UserInsert/Update, UserPermissionInsert/Update, AppNotification, Relationships:[] em todas tabelas
- [x] `src/hooks/use-users.ts`: useUsers, useUser, useUpdateUser, useDeactivateUser, useReactivateUser
- [x] `src/hooks/use-permissions.ts`: useUserPermissions, useUpdatePermission
- [x] `src/components/shared/user-avatar.tsx`: avatar + initials fallback
- [x] `src/components/shared/status-badge.tsx`: badge Ativo/Inativo
- [x] `src/app/(auth)/admin/usuarios/page.tsx`: lista com busca e filtros
- [x] `src/app/(auth)/admin/usuarios/[id]/page.tsx`: editar + ativar/desativar
- [x] `src/app/(auth)/admin/usuarios/[id]/permissoes/page.tsx`: matriz 8×5
- [x] `src/app/(auth)/admin/usuarios/novo/page.tsx`: formulário de criação
- [x] `src/app/api/admin/users/route.ts`: POST cria usuário via Auth Admin API
- [x] `src/app/(auth)/perfil/page.tsx`: editar perfil + preferências de notificação
- [x] shadcn/ui: avatar, badge, dialog, dropdown-menu, input, label, separator, sheet, switch, table, tooltip

### Fase 0 — Bloco 7: PWA + Auditoria (2026-03-26)
- [x] `public/manifest.json`: PWA manifest completo
- [x] `public/icons/icon-192.png` + `icon-512.png`: ícones placeholder
- [x] `src/lib/audit.ts`: logAudit() helper para registrar no audit_logs
- [x] `src/app/layout.tsx`: icon paths corrigidos

### Fase 0 — Bloco 8: GitHub + CI/CD (2026-03-26)
- [x] Git configurado, branches main + develop criadas e pushadas
- [x] `.github/workflows/ci.yml`: TypeScript check + ESLint em push/PR
- [x] Repositório: `suportedrk/cacholaapp`

### Fase 0 — Bloco 10: Correções Next.js 16 + Rotas (2026-03-27)
- [x] `src/middleware.ts` → `src/proxy.ts` (nova convenção Next.js 16, export `proxy`)
- [x] `next.config.ts`: `turbopack: {}` adicionado (silencia conflito webpack/@ducanh2912/next-pwa)
- [x] `src/app/globals.css`: `@import url(googleapis)` removido (quebrava Turbopack PostCSS)
- [x] `src/app/layout.tsx`: Inter carregada via `next/font/google` (self-hosted, zero CLS)
- [x] Páginas placeholder criadas para 6 rotas da sidebar (Fase 1):
  - `/eventos`, `/checklists`, `/manutencao`, `/relatorios`, `/configuracoes`, `/admin/logs`
- [x] `src/components/shared/placeholder-page.tsx`: componente reutilizável de "Em desenvolvimento"

### ROTAS FUNCIONAIS

| Rota | Arquivo | Status |
|------|---------|--------|
| `/dashboard` | `(auth)/dashboard/page.tsx` | ✅ funcional (Bloco 2) |
| `/perfil` | `(auth)/perfil/page.tsx` | ✅ funcional |
| `/admin/usuarios` | `(auth)/admin/usuarios/page.tsx` | ✅ funcional |
| `/admin/usuarios/novo` | `(auth)/admin/usuarios/novo/page.tsx` | ✅ funcional |
| `/admin/usuarios/[id]` | `(auth)/admin/usuarios/[id]/page.tsx` | ✅ funcional |
| `/admin/usuarios/[id]/permissoes` | `(auth)/admin/usuarios/[id]/permissoes/page.tsx` | ✅ funcional |
| `/eventos` | `(auth)/eventos/page.tsx` | ✅ funcional (Bloco 1) |
| `/eventos/novo` | `(auth)/eventos/novo/page.tsx` | ✅ funcional (Bloco 1) |
| `/eventos/[id]` | `(auth)/eventos/[id]/page.tsx` | ✅ funcional (Bloco 1) |
| `/eventos/[id]/editar` | `(auth)/eventos/[id]/editar/page.tsx` | ✅ funcional (Bloco 1) |
| `/configuracoes` | `(auth)/configuracoes/page.tsx` | ✅ funcional (Bloco 1) |
| `/checklists` | `(auth)/checklists/page.tsx` | ✅ funcional (Bloco 3) |
| `/checklists/[id]` | `(auth)/checklists/[id]/page.tsx` | ✅ funcional (Bloco 3) |
| `/checklists/templates` | `(auth)/checklists/templates/page.tsx` | ✅ funcional (Bloco 3) |
| `/checklists/templates/novo` | `(auth)/checklists/templates/novo/page.tsx` | ✅ funcional (Bloco 3) |
| `/checklists/templates/[id]/editar` | `(auth)/checklists/templates/[id]/editar/page.tsx` | ✅ funcional (Bloco 3) |
| `/manutencao` | `(auth)/manutencao/page.tsx` | ✅ funcional (Fase 2 Bloco 1) |
| `/manutencao/nova` | `(auth)/manutencao/nova/page.tsx` | ✅ funcional (Fase 2 Bloco 1) |
| `/manutencao/[id]` | `(auth)/manutencao/[id]/page.tsx` | ✅ funcional (Fase 2 Bloco 1) |
| `/manutencao/[id]/editar` | `(auth)/manutencao/[id]/editar/page.tsx` | ✅ funcional (Fase 2 Bloco 1) |
| `/admin/unidades` | `(auth)/admin/unidades/page.tsx` | ✅ funcional (Fase 2.5) |
| `/admin/unidades/nova` | `(auth)/admin/unidades/nova/page.tsx` | ✅ funcional (Fase 2.5) |
| `/admin/unidades/[id]` | `(auth)/admin/unidades/[id]/page.tsx` | ✅ funcional (Fase 2.5) |
| `/equipamentos` | `(auth)/equipamentos/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/novo` | `(auth)/equipamentos/novo/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/[id]` | `(auth)/equipamentos/[id]/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/[id]/editar` | `(auth)/equipamentos/[id]/editar/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/relatorios` | `(auth)/relatorios/page.tsx` | ✅ funcional (Fase 3 Bloco 1) |
| `/admin/logs` | `(auth)/admin/logs/page.tsx` | ✅ funcional (Fase 3 Bloco 4) |
| `/login` | `(public)/login/page.tsx` | ✅ funcional |
| `/recuperar-senha` | `(public)/recuperar-senha/page.tsx` | ✅ funcional |

### Fase 1 — Bloco 1: Módulo de Eventos (2026-03-27)
- [x] Migrations: `005_fase1_config_tables.sql` (event_types, packages, venues, checklist_categories + RLS + seed)
- [x] Migrations: `006_fase1_events_update.sql` (novo enum EventStatus, FKs para config tables)
- [x] `src/types/database.types.ts`: EventType, Package, Venue, ChecklistCategory, EventStatus atualizado, EventWithDetails, CalendarEvent
- [x] `src/hooks/use-events.ts`: useEvents (com filtros + paginação), useEvent, useCreateEvent, useUpdateEvent, useChangeEventStatus, useDeleteEvent
- [x] `src/hooks/use-event-config.ts`: useEventTypes/Packages/Venues + CRUD de cada
- [x] `src/hooks/use-debounce.ts`: hook genérico de debounce (300ms)
- [x] `src/components/shared/event-status-badge.tsx`: badge com dot + STATUS_CONFIG + DOT_COLOR exportados
- [x] `src/components/shared/empty-state.tsx`: empty state reutilizável com ícone + ação
- [x] `src/components/shared/confirm-dialog.tsx`: dialog de confirmação destrutiva
- [x] `src/components/shared/page-header.tsx`: cabeçalho padrão de página
- [x] `src/components/features/events/event-card.tsx`: card de evento + skeleton
- [x] `src/components/features/events/event-filters.tsx`: busca com debounce + filtros de status (pills)
- [x] `src/components/features/events/event-form.tsx`: formulário 5 seções (criar + editar)
- [x] `src/components/features/settings/config-table.tsx`: CRUD inline para tabelas de configuração
- [x] `src/app/(auth)/eventos/page.tsx`: lista paginada com filtros
- [x] `src/app/(auth)/eventos/novo/page.tsx`: formulário de criação
- [x] `src/app/(auth)/eventos/[id]/page.tsx`: detalhe com troca de status + editar + excluir
- [x] `src/app/(auth)/eventos/[id]/editar/page.tsx`: formulário de edição
- [x] `src/app/(auth)/configuracoes/page.tsx`: tabs Tipos/Pacotes/Salões com ConfigTable

### Fase 1 — Bloco 4: Sistema de Notificações (2026-03-27)
- [x] `supabase/migrations/008_notifications_functions.sql`: função `create_notification` (SECURITY DEFINER), RLS policies para notifications
- [x] `src/types/database.types.ts`: adicionado `create_notification` à seção Functions
- [x] `src/lib/notifications.ts`: notifyEventCreated, notifyStatusChanged, notifyChecklistAssigned, notifyChecklistCompleted — usa `supabase.rpc('create_notification')`
- [x] `src/hooks/use-notifications.ts`: useNotifications — lista 20 notificações, unreadCount derivado, markRead, markAllRead, Supabase Realtime subscription (INSERT), polling fallback 60s
- [x] `src/components/layout/notification-bell.tsx`: sino real com DropdownMenu — badge vermelho, lista de notificações, ícone por tipo, tempo relativo PT-BR, "Marcar todas como lidas", empty state
- [x] `src/app/api/cron/check-alerts/route.ts`: endpoint GET protegido por CRON_SECRET — alertas de eventos amanhã e checklists atrasados
- [x] `src/hooks/use-events.ts`: integração fire-and-forget em useCreateEvent + useChangeEventStatus
- [x] `src/hooks/use-checklists.ts`: integração fire-and-forget em useCreateChecklist + useUpdateChecklistStatus (só quando 'completed')
- [x] `src/components/layout/navbar.tsx`: NotificationBell sem prop count (auto-managed)

### Fase 1 — Bloco 3: Módulo de Checklists (2026-03-27)
- [x] `supabase/migrations/007_fase1_checklists_update.sql`: `checklist_items.status` (pending/done/na), `checklist_templates.category_id` FK, bucket `checklist-photos` + RLS
- [x] `src/types/database.types.ts`: ChecklistItemStatus, ChecklistWithItems, ChecklistForList, TemplateWithItems
- [x] `src/hooks/use-checklists.ts`: useChecklists (filtros+paginação), useChecklist, useEventChecklists, useCreateChecklist, useUpdateChecklistStatus, useDeleteChecklist, useUpdateChecklistItem (status/notes/photo+Storage), useChecklistTemplates, useChecklistTemplate, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useChecklistCategories
- [x] `src/components/features/checklists/checklist-progress.tsx`: barra de progresso + calcProgress() exportado
- [x] `src/components/features/checklists/checklist-card.tsx`: card com badge de status, progresso, overdue highlight + skeleton
- [x] `src/components/features/checklists/checklist-item-row.tsx`: toque para ciclar status (pending→done→na), notas expandíveis, upload de foto com câmera
- [x] `src/components/features/checklists/sortable-template-items.tsx`: DnD reorder com @dnd-kit/core + @dnd-kit/sortable
- [x] `src/components/features/checklists/add-checklist-modal.tsx`: modal de criação a partir de template
- [x] `src/app/(auth)/checklists/page.tsx`: lista paginada com filtros de status + categoria
- [x] `src/app/(auth)/checklists/[id]/page.tsx`: tela de preenchimento mobile-first (footer sticky + finalizar)
- [x] `src/app/(auth)/checklists/templates/page.tsx`: lista de templates com editar/desativar
- [x] `src/app/(auth)/checklists/templates/novo/page.tsx`: formulário de criação com DnD
- [x] `src/app/(auth)/checklists/templates/[id]/editar/page.tsx`: formulário de edição com DnD
- [x] `src/app/(auth)/eventos/[id]/page.tsx`: seção Checklists real (lista + AddChecklistModal)

### Fase 1 — Bloco 2: Dashboard + Calendário Unificado (2026-03-27)
- [x] `src/hooks/use-dashboard.ts`: useDashboardStats, useNextEvent, useCalendarEvents + tipo CalendarEvent
- [x] `src/components/features/dashboard/stats-card.tsx`: card de métrica com ícone, valor, loading skeleton
- [x] `src/components/features/dashboard/next-event-card.tsx`: próximo evento com equipe + link direto
- [x] `src/components/features/dashboard/event-quick-view.tsx`: Sheet drawer com detalhes do evento
- [x] `src/components/features/dashboard/calendar-view.tsx`: calendário 3 visões (mês/semana/dia) com CSS Grid
- [x] `src/app/(auth)/dashboard/page.tsx`: página completa substituindo placeholder

### Fase 2 — Bloco 1: Módulo de Manutenção (2026-03-27)
- [x] `supabase/migrations/009_fase2_maintenance.sql`: tabela `sectors` (8 setores seed), `maintenance_orders` atualizado (sector_id FK, recurrence_rule JSONB, tipo emergency/punctual/recurring), buckets privados `maintenance-photos` + `user-avatars` com RLS Storage
- [x] `src/types/database.types.ts`: Sector, RecurrenceRule, MaintenanceWithDetails, MaintenanceForList, CalendarMaintenance, DashboardMaintenanceStats, MaintenanceType atualizado
- [x] `src/hooks/use-sectors.ts`: useSectors, useCreateSector, useUpdateSector, useDeleteSector
- [x] `src/hooks/use-maintenance.ts`: useMaintenanceOrders (filtros+paginação, emergency-first), useMaintenanceOrder, useCreateMaintenanceOrder, useUpdateMaintenanceOrder, useChangeMaintenanceStatus, useCompleteMaintenanceOrder (recorrência automática), useDeleteMaintenanceOrder, useAddMaintenancePhoto, useRemoveMaintenancePhoto
- [x] `src/hooks/use-dashboard.ts`: useDashboardMaintenanceStats, useCalendarMaintenance adicionados
- [x] `src/lib/notifications.ts`: notifyMaintenanceCreated, notifyMaintenanceEmergency, notifyMaintenanceStatusChanged, notifyMaintenanceCompleted adicionados
- [x] `src/components/features/maintenance/maintenance-type-badge.tsx`: pills emergency(vermelho)/punctual(âmbar)/recurring(verde)
- [x] `src/components/features/maintenance/maintenance-status-badge.tsx`: MaintenanceStatusBadge + MaintenancePriorityBadge
- [x] `src/components/features/maintenance/maintenance-card.tsx`: card com overdue highlight + responsável + skeleton
- [x] `src/components/features/maintenance/maintenance-filters.tsx`: busca debounce + pills tipo/status/prioridade + select setor
- [x] `src/components/features/maintenance/maintenance-form.tsx`: formulário 5 seções com recorrência condicional
- [x] `src/components/features/maintenance/maintenance-timeline.tsx`: timeline de audit_logs por ordem
- [x] `src/app/(auth)/manutencao/page.tsx`: lista paginada, default excluindo concluídas
- [x] `src/app/(auth)/manutencao/nova/page.tsx`: formulário criação
- [x] `src/app/(auth)/manutencao/[id]/page.tsx`: detalhe com concluir/editar/excluir/mudar-status inline + recorrência + timeline
- [x] `src/app/(auth)/manutencao/[id]/editar/page.tsx`: formulário edição
- [x] `src/components/features/dashboard/calendar-view.tsx`: props maintenanceItems/showMaintenance/onToggleMaintenance/onMaintenanceClick, pills de manutenção com ícone Wrench nas 3 visões
- [x] `src/components/features/dashboard/stats-card.tsx`: prop onClick adicionada
- [x] `src/app/(auth)/dashboard/page.tsx`: 2 cards de manutenção (Abertas + Urgentes Hoje), toggle manutenções no calendário
- [x] `src/app/(auth)/configuracoes/page.tsx`: tab Setores com ConfigTable
- [x] `src/app/api/cron/check-alerts/route.ts`: alertas maintenance_overdue + maintenance_due_soon adicionados
- [x] `src/components/shared/confirm-dialog.tsx`: refatorado para suportar `trigger` prop (DialogTrigger) + `destructive` bool

### Fase 2 — Bloco 3: E-mails com Resend (2026-03-27)
- [x] `resend` instalado como dependência
- [x] `src/lib/email.ts`: `sendEmail(to, subject, html)` com graceful fallback, 4 templates: `tplMaintenanceEmergency`, `tplMaintenanceOverdue`, `tplEventTomorrow`, `tplChecklistOverdue` — HTML responsivo com cores da marca (#7C8D78)
- [x] `src/app/api/email/maintenance-emergency/route.ts`: POST route que busca destinatários, checa `preferences.notifications.email` e envia e-mail de emergência
- [x] `src/hooks/use-maintenance.ts`: chama `POST /api/email/maintenance-emergency` fire-and-forget no `onSuccess` de ordem emergencial
- [x] `src/app/api/cron/check-alerts/route.ts`: adicionado `sendEmail` para event_tomorrow, checklist_overdue e maintenance_overdue — sempre checando preferência do usuário antes
- [x] `.env.example`: `RESEND_API_KEY` e `EMAIL_FROM` adicionados

### Fase 2.5 — Multi-Unidade (2026-03-27)
- [x] `supabase/migrations/010_fase25_units.sql`: tabelas `units` (slug UNIQUE) + `user_units` (role por unidade, is_default), `unit_id` nullable→NOT NULL em events/checklists/checklist_templates/maintenance_orders, nullable em audit_logs + config tables (event_types, packages, venues, checklist_categories, sectors, user_permissions), RLS completo com `get_user_unit_ids()` + `is_global_viewer()`, seed Pinheiros
- [x] `src/types/database.types.ts`: Unit, UserUnit, UserUnitWithUnit types; `unit_id` em todas entidades
- [x] `src/stores/unit-store.ts`: Zustand com persist — activeUnitId (localStorage), activeUnit, userUnits; reset no sign out
- [x] `src/hooks/use-units.ts`: useUnits, useUnit, useMyUnits, useUserUnits, useUnitUsers, useCreateUnit, useUpdateUnit, useDeactivateUnit, useAddUserToUnit, useUpdateUserUnitRole, useRemoveUserFromUnit, useSetDefaultUnit
- [x] `src/hooks/use-auth.ts`: loadUserUnits() — carrega user_units, restaura unidade persistida ou usa default; retorna activeUnitId + userUnits
- [x] `src/components/layout/unit-switcher.tsx`: dropdown navbar — "Todas as unidades" (super_admin/diretor), lista de unidades do usuário com check mark, invalida todas queries ao trocar
- [x] `src/components/layout/navbar.tsx`: UnitSwitcher integrado antes de NotificationBell
- [x] `src/components/layout/nav-items.ts`: item "Unidades" → `/admin/unidades` com ícone Building2
- [x] `src/lib/constants/index.ts`: `ROUTES.units = '/admin/unidades'`
- [x] Todos os hooks de dados com filtro `unit_id`: useEvents, useChecklists, useChecklistTemplates, useChecklistCategories, useCreateChecklist, useCreateTemplate, useMaintenanceOrders, useCreateMaintenanceOrder, useDashboardStats, useNextEvent, useDashboardMaintenanceStats, useCalendarEvents, useCalendarMaintenance, useEventTypes, usePackages, useVenues, useCreateEventType, useCreatePackage, useCreateVenue, useSectors, useCreateSector — queryKeys incluem activeUnitId
- [x] `src/app/(auth)/admin/unidades/page.tsx`: lista cards de unidades com busca, status badge, endereço/telefone
- [x] `src/app/(auth)/admin/unidades/nova/page.tsx`: formulário com slug auto-gerado a partir do nome
- [x] `src/app/(auth)/admin/unidades/[id]/page.tsx`: editar dados + gerenciar usuários vinculados (add/remove/change role)
- [x] `src/app/(auth)/admin/usuarios/[id]/page.tsx`: seção Unidades Vinculadas — lista com change role + remove

### Fase 2 — Bloco 2: Upload de Fotos (2026-03-27)
- [x] `src/hooks/use-signed-urls.ts`: `useSignedUrls(bucket, paths)` — batch `createSignedUrls`, staleTime 30min
- [x] `src/components/shared/photo-upload.tsx`: Canvas compress (max 1200px, 80%), preview thumbnail, progress bar, dois botões (Câmera com `capture="environment"` + Galeria), `PhotoThumb` para exibir foto existente
- [x] `src/components/shared/photo-lightbox.tsx`: overlay fullscreen, prev/next, keyboard (Esc/Arrows), contador e label por foto
- [x] `src/components/features/maintenance/photo-section.tsx`: grid before/during/after, signed URLs, PhotoUpload por seção, PhotoThumb clicável, PhotoLightbox, remove de Storage + DB
- [x] `src/app/(auth)/manutencao/[id]/page.tsx`: substituído placeholder por `<PhotoSection orderId photos canEdit />`
- [x] `src/app/(auth)/perfil/page.tsx`: avatar upload funcional — compressão (max 600px), upload para `user-avatars/{userId}/avatar.jpg`, signed URL 1 ano salva em `users.avatar_url`

### Fase 3 — Bloco 1: Relatórios e Dashboards Analíticos (2026-03-27)
- [x] `supabase/migrations/011_fase3_reports.sql`: 9 índices de performance + 13 RPC functions (SECURITY INVOKER + GRANT EXECUTE TO authenticated) — report_events_summary/by_month/by_type/by_venue, report_maintenance_summary/by_month/by_sector, report_checklists_summary/by_month/by_category, report_staff_by_events/by_checklists/summary
- [x] `recharts`, `xlsx`, `jspdf`, `html2canvas` instalados
- [x] `src/types/database.types.ts`: 13 tipos de retorno RPC + ReportFilters, todos os tipos de summary/detail
- [x] `src/hooks/use-reports.ts`: useEventReport, useMaintenanceReport, useChecklistReport, useStaffReport — todos leem activeUnitId do Zustand
- [x] `src/lib/utils/export.ts`: exportToExcel (SheetJS, dynamic import) + exportToPDF (jsPDF + html2canvas, A4 landscape, brand header, paginação)
- [x] `src/components/features/reports/`: report-filters.tsx, report-stats-card.tsx, bar-chart-card.tsx, donut-chart-card.tsx, horizontal-bar-chart-card.tsx, export-button.tsx, events-tab.tsx, maintenance-tab.tsx, checklists-tab.tsx, staff-tab.tsx
- [x] `src/app/(auth)/relatorios/page.tsx`: 4 abas dinâmicas (next/dynamic + ssr:false), ReportFiltersBar, filtros de período com presets

### Fase 3 — Bloco 2: Cadastro de Equipamentos/Ativos (2026-03-27)
- [x] `supabase/migrations/012_fase3_equipment.sql`: tabela `equipment` (status CHECK, garantia, foto, serial_number, FK unit_id), RLS por unidade, bucket privado `equipment-photos` (5MB, imagens), ALTER maintenance_orders: DROP equipment TEXT, ADD equipment_id UUID FK nullable
- [x] `src/types/database.types.ts`: EquipmentStatus, Equipment, EquipmentWithHistory; MaintenanceWithDetails/ForList com `equipment: Pick<Equipment,'id'|'name'|'category'|'location'> | null`
- [x] `src/hooks/use-equipment.ts`: useEquipment (filtros search/category/status/onlyActive), useEquipmentItem, useEquipmentMaintenanceHistory, useCreateEquipment, useUpdateEquipment, useChangeEquipmentStatus, useEquipmentCategories
- [x] `src/components/features/equipment/equipment-card.tsx`: card com foto signed URL, badges status/garantia/OS abertas + EquipmentCardSkeleton
- [x] `src/components/features/equipment/equipment-form.tsx`: formulário com upload de foto (compressImage exportada de photo-upload.tsx), categorias select, status, campos técnicos
- [x] `src/app/(auth)/equipamentos/page.tsx`: lista com busca, filtro categoria, filtro status
- [x] `src/app/(auth)/equipamentos/novo/page.tsx`: formulário de criação
- [x] `src/app/(auth)/equipamentos/[id]/page.tsx`: detalhe com histórico de manutenções linkado
- [x] `src/app/(auth)/equipamentos/[id]/editar/page.tsx`: formulário de edição
- [x] `src/app/(auth)/manutencao/[id]/page.tsx`: campo equipment exibe nome com link `/equipamentos/[id]`
- [x] `src/components/shared/photo-upload.tsx`: `compressImage` exportada como função pública
- [x] Nav e ROUTES: item Equipamentos (Package icon, module:'maintenance'), ROUTES.equipment='/equipamentos'

### Fase 3 — Bloco 3: Configurações Avançadas (2026-03-27)
- [x] `supabase/migrations/013_fase3_settings.sql`: tabelas `unit_settings` (id, unit_id UNIQUE, settings JSONB, updated_at + trigger) e `equipment_categories` (id, unit_id, name, is_active, sort_order — UNIQUE(name, unit_id)), RLS por `get_user_unit_ids()` em ambas, seed de 9 categorias para unidade Pinheiros
- [x] `src/types/database.types.ts`: UnitSettingsData (timezone, date_format, business_hours, event_defaults), BusinessHourDay, UnitSettings, EquipmentCategory + entradas em Database.Tables
- [x] `src/hooks/use-unit-settings.ts`: useUnitSettings, useUnitSettingsData (merge com DEFAULT_UNIT_SETTINGS), useUpdateUnitSettings (upsert via onConflict:'unit_id'), DEFAULT_UNIT_SETTINGS exportado (Mon–Sat 08:00–22:00, duração 4h, gap 1h, início 14:00)
- [x] `src/hooks/use-equipment-categories.ts`: useEquipmentCategoryItems (onlyActive flag), useCreateEquipmentCategory (auto sort_order), useUpdateEquipmentCategory, useDeleteEquipmentCategory
- [x] `src/components/features/settings/general-settings-tab.tsx`: aba Geral — nome da unidade (readonly, link para /admin/unidades), fuso horário (10 zonas BR), formato de data (BR/EUA/ISO)
- [x] `src/components/features/settings/business-hours-tab.tsx`: aba Horários — grid 7 dias (enable toggle + open/close inputs), padrões de evento (duração, intervalo mínimo, horário início)
- [x] `src/app/(auth)/configuracoes/page.tsx`: + abas Categ. Equipamentos (ConfigTable), Horários, Geral; TabsList com flex-wrap para mobile
- [x] `src/components/features/equipment/equipment-form.tsx`: select de categoria usa `useEquipmentCategoryItems(true)`, fallback para FALLBACK_CATEGORIES se lista vazia

### Fase 0 — Bloco 9: Docker Funcional + Banco Inicializado (2026-03-27)
- [x] `.env` criado com todos os valores reais (JWTs gerados via Node.js HS256)
- [x] `docker-compose.yml` corrigido: volumes nomeados, kong sem eval/echo, realtime APP_NAME + RLIMIT_NOFILE
- [x] `docker/kong.yml`: JWTs hardcoded (sem substituição em runtime — evita corrupção YAML)
- [x] `docker/gcloud.json`: stub com RSA key válida para analytics Logflare
- [x] `_analytics` database criado manualmente no PostgreSQL
- [x] `_realtime` schema criado manualmente antes do startup do realtime
- [x] Senhas dos roles Supabase definidas via `ALTER ROLE ... WITH PASSWORD`
- [x] imgproxy desabilitado (segfault exit 139 no WSL2/Windows) — ENABLE_IMAGE_TRANSFORMATION=false
- [x] Migrations executadas: 001→004 (14 tabelas, RLS, functions, seed)
- [x] Super admin criado: `admin@cacholaos.com.br` / `Admin2026cacholaos` / role: super_admin / 32 permissões

---

## SERVIÇOS E PORTAS (DEV LOCAL)

| Serviço | URL | Status |
|---------|-----|--------|
| App Next.js | http://localhost:3000 | ✅ |
| Supabase API (Kong) | http://localhost:8000 | ✅ healthy |
| Supabase Studio | http://localhost:3001 | ✅ (healthcheck falso-negativo) |
| Analytics (Logflare) | http://localhost:4000 | ✅ |
| PostgreSQL | localhost:5432 | ✅ healthy |

> **Studio unhealthy**: Next.js 14 no Studio escuta no IP de rede, não em 127.0.0.1.
> O healthcheck interno falha, mas o serviço funciona em http://localhost:3001.
> Não é um problema real — é um falso-negativo do Docker healthcheck.

---

## CREDENCIAIS SUPER ADMIN (DEV LOCAL APENAS)

```
Email: admin@cacholaos.com.br
Senha: Admin2026cacholaos
Role:  super_admin (32 permissões)
```

> ⚠️ NUNCA usar estas credenciais em produção. Criar novo super_admin em prod.

---

### Fase 3 — Bloco 4: Logs de Auditoria (2026-03-27)
- [x] `src/types/database.types.ts`: AuditLogWithUser, AuditLogFilters adicionados
- [x] `src/hooks/use-audit-logs.ts`: useAuditLogs — useInfiniteQuery com cursor-based pagination (created_at < cursor, PAGE_SIZE=100), filtros por período/usuário/módulo/ação, filtro unit_id via Zustand
- [x] `src/components/features/audit/audit-diff.tsx`: diff visual old_data vs new_data — verde (adicionado), vermelho (removido), amarelo com "antes → depois" (modificado); modo especial para create/delete sem diff
- [x] `src/components/features/audit/audit-filters.tsx`: barra com 5 filtros (De/Até, Usuário via useUsers, Módulo, Ação) + botão "Limpar filtros" condicional
- [x] `src/components/features/audit/audit-log-table.tsx`: tabela com rows expansíveis (chevron), skeleton de loading, badge de ação colorido, coluna IP hidden em mobile; rodapé com contagem + "Carregar mais" (load more)
- [x] `src/app/(auth)/admin/logs/page.tsx`: substitui placeholder; check de permissão audit_logs:view com tela de acesso negado; achata páginas do infiniteQuery em lista única
- [x] Fix colateral: `src/lib/email.ts` — new Resend() lazy (getResend()) para não crashar build sem RESEND_API_KEY

### Fase 3 — Bloco 5: Otimizações de Performance (2026-03-27)
- [x] `use-permissions.ts`: select('module,action,granted') — remove colunas desnecessárias + staleTime 5min
- [x] `use-users.ts`: useUsers omite `preferences` JSONB na lista + staleTime 30s em ambas as queries
- [x] `use-units.ts`: staleTime 5min em useUnits + useUnit (dado quase estático)
- [x] `use-audit-logs.ts`: staleTime 30s no useInfiniteQuery
- [x] `event-card.tsx`, `maintenance-card.tsx`, `checklist-card.tsx`, `equipment-card.tsx`: React.memo nos 4 card components de lista
- [x] `@next/bundle-analyzer` instalado; `next.config.ts` com `withBundleAnalyzer(enabled: ANALYZE==='true')` — uso: `ANALYZE=true npm run build`

### Fase 3 — Bloco 6: Offline Mode (2026-03-27)
- [x] `idb` instalado (4KB, Promise-based IndexedDB)
- [x] `src/lib/offline-db.ts`: schema IDB tipado — `checklists` (snapshot), `checklist_items` (fila de sync com index `by-checklist`), `calendar_events` (cache read-only); singleton `getOfflineDb()` SSR-safe
- [x] `src/hooks/use-online-status.ts`: `useOnlineStatus()` — `navigator.onLine` como estado inicial + `window.addEventListener('online'/'offline')`
- [x] `src/hooks/use-sync-manager.ts`: `useSyncManager()` — conta pendentes no IDB, auto-sync ao voltar online (for loop com upsert Supabase), toast de sucesso, `countPending` exposto
- [x] `src/hooks/use-offline-checklist.ts`: hook unificado online/offline — React Query quando online; IDB snapshot + `localPatches` quando offline; `patchesRef` para evitar stale closures; `useMemo` mescla snapshot + patches; `handleItemStatus/Notes` persiste no IDB offline; foto (`handleItemPhoto`) só disponível online
- [x] `src/app/(auth)/checklists/[id]/page.tsx`: refatorado para `useOfflineChecklist`; banner amber WifiOff com contador de pendentes; banner azul spinning ao sincronizar; botão Finalizar + upload foto desabilitados offline; mensagem de erro diferencia offline vs rede
- [x] `src/components/features/checklists/checklist-item-row.tsx`: `onPhotoChange` prop agora opcional (`?`) — permite desabilitar upload offline via `undefined`
- [x] `src/components/layout/navbar.tsx`: badge amber "Offline" com ícone WifiOff — visível apenas quando offline, rótulo oculto em mobile (apenas ícone)
- [x] `src/hooks/use-dashboard.ts` `useCalendarEvents`: salva no IDB store `calendar_events` após cada fetch online; quando offline lê do IDB; retorna `isOffline` + `cachedAt` além de `data`/`isLoading`/`isError`; query desabilitada offline (`enabled: isOnline && ...`)
- [x] `src/app/(auth)/dashboard/page.tsx`: banner amber no calendário quando offline com horário da última atualização (HH:MM)

## PROXIMOS PASSOS — FASE 1

- [x] Bloco 1: Módulo de Eventos (CRUD completo + config tables)
- [x] Bloco 2: Dashboard + Calendário Unificado
- [x] Bloco 3: Módulo de Checklists (templates + instâncias + itens + categorias)
- [x] Bloco 4: Sistema de Alertas Persistentes (notification bell + real-time + cron)
- [x] Fase 2 Bloco 1: Módulo de Manutenção — CRUD completo
- [x] Fase 2 Bloco 2: Upload de Fotos (before/after + lightbox + avatar)
- [x] Fase 2 Bloco 3: E-mails com Resend (4 templates + cron + emergency route)
- [x] Fase 2.5: Multi-Unidade (schema N:N, RLS, UnitSwitcher, filtros, CRUD admin)
- [x] Fase 3 Bloco 1: Relatórios e Dashboards Analíticos (13 RPC functions, 4 abas, Excel + PDF)
- [x] Fase 3 Bloco 2: Cadastro de Equipamentos/Ativos (CRUD completo + foto + FK em OS)
- [x] Fase 3 Bloco 3: Configurações Avançadas (unit_settings JSONB, equipment_categories, 3 novas abas)
- [x] Fase 3 Bloco 4: Logs de Auditoria (useInfiniteQuery cursor-based, diff visual, filtros, permissão)
- [x] Fase 3 Bloco 5: Otimizações de Performance (select específico, staleTime, React.memo, bundle analyzer)
- [x] Fase 3 Bloco 6: Offline Mode (IDB checklists R/W com sync queue + calendário read-only cached)

> **NOTA:** Após subir o Supabase com `docker compose up -d`, regenerar os tipos com:
> ```bash
> npx supabase gen types typescript --local > src/types/database.types.ts
> ```

---

## DECISÕES TÉCNICAS

| Decisão | Razão |
|---------|-------|
| `@ducanh2912/next-pwa` | `next-pwa` v5.6 abandonado com 23 vulnerabilidades. Fork mantido é compatível com Next 16. |
| Tailwind v4 (CSS config) | `create-next-app` 16.2.1 já vem com Tailwind v4. Config via `@theme inline {}` em globals.css. |
| Next.js 16.2.1 | Versão atual do create-next-app. Compatível com toda a stack + React 19. |
| oklch para cores | Tailwind v4 e shadcn/ui v4 usam oklch internamente. Conversão dos hex da marca para oklch. |
| Supabase self-hosted dev e prod | Decisão do Bruno: sem Supabase Cloud. Total controle de dados. Dev === Prod em termos de infra. |
| `type` ao invés de `interface` em database.types.ts | TypeScript interfaces NÃO satisfazem `Record<string, unknown>` em conditional types (Supabase GenericTable constraint). Type aliases SIM. Regra: sempre usar `type = {}` para tipos de entidades do banco. |
| `AppNotification` ao invés de `Notification` | `Notification` conflita com a interface DOM global do browser. Renomeada para `AppNotification`. |
| Volume nomeado para PostgreSQL (não bind mount) | Bind mounts no Windows criam arquivos ocultos (`.s.PGSQL.5432.lock`, etc.) que impedem a inicialização do PostgreSQL. Named volumes resolvem isso. |
| NÃO montar migrations em `/docker-entrypoint-initdb.d` | A imagem `supabase/postgres` tem seus próprios init scripts nesse path (cria schema `auth`, roles, etc). Sobrescrever quebra tudo. Usar `/docker-entrypoint-migrations` e rodar manualmente. |
| JWTs hardcoded em `docker/kong.yml` (dev) | Kong 2.8.1 não faz substituição de env vars nativamente. A trick `eval "echo \"$(cat ...)\"` corrompe `_format_version: "1.1"` (YAML string vira número). Solução: valores literais no arquivo. |
| Senhas dos roles Supabase via `ALTER ROLE` | A imagem cria os roles `supabase_auth_admin`, `authenticator`, etc. SEM senha. Necessário rodar `ALTER ROLE ... WITH PASSWORD '...'` após o primeiro startup. |
| `_analytics` database criado manualmente | A imagem `supabase/postgres:15.8.1.084` NÃO cria o database `_analytics` automaticamente. Logflare exige esse database separado (não schema). Criar uma vez: `CREATE DATABASE _analytics`. |
| `_realtime` schema criado manualmente | Realtime v2.34.47 usa `DB_AFTER_CONNECT_QUERY: SET search_path TO _realtime`. Se o schema não existe ao conectar, o Ecto migrator falha com `invalid_schema_name`. Criar antes do startup. |
| `docker/gcloud.json` stub com RSA real | Logflare inicializa Goth (Google Auth) mesmo em modo postgres. `File.read!("gcloud.json")` é chamado em `runtime.exs:218`. Precisava de um JSON com RSA PKCS8 sintaticamente válido (gerado via `crypto.generateKeyPairSync`). Auth GCP falha graciosamente (Goth retry warnings), mas não crasha. |
| Calendário custom (CSS Grid, sem lib) | react-big-calendar e similares são pesados e difíceis de customizar no design system. Implementado com date-fns + Tailwind CSS Grid. 3 visões: mês/semana/dia. Eventos como pills coloridos por status. |
| Debounce sem useEffect em EventFiltersBar | `useEffect([debouncedSearch])` causava loop infinito no StrictMode (React 18 monta/desmonta duas vezes). Solução: timer manual com `setTimeout` no handler, limpeza no `useEffect(() => () => clearTimeout, [])` (só cleanup de unmount). |
| Stats do dashboard filtrados por mês atual | Query leve: só busca `status, date` dos eventos do mês corrente. Não usa COUNT do banco para flexibilidade de cálculo no client. |
| CalendarEvent tipo slim (não EventWithDetails) | Queries do calendário trazem apenas os campos necessários para exibição (id, title, date, times, status, client_name, event_type, venue). Reduz payload. Ao clicar, o detalhe completo fica em /eventos/[id]. |
| imgproxy desabilitado em dev Windows | `darthsim/imgproxy:v3.8.0` causa segfault (exit code 139) no WSL2/Windows. Provável incompatibilidade libvips/CPU. Desabilitado via `ENABLE_IMAGE_TRANSFORMATION: "false"`. Reabilitar em prod Linux nativo. |
| `RLIMIT_NOFILE` obrigatório no realtime | `run.sh` do realtime v2.34.47 usa `set -u` (unbound vars = error) e referencia `$RLIMIT_NOFILE`. Sem essa var, o script aborta imediatamente. Valor: `4096`. |
| `APP_NAME` obrigatório no realtime | `runtime.exs:78` do realtime exige `APP_NAME`. Sem ela, boot falha com `APP_NAME not available`. Valor: `realtime`. |
| `npm run build` usa `--webpack` (não Turbopack) | `@ducanh2912/next-pwa` é um plugin webpack. `next build` default (Turbopack) não executa plugins webpack — `sw.js` não é gerado. Solução: `next build --webpack`. Dev continua com Turbopack (mais rápido). |
| `suppressHydrationWarning` no `<body>` | Extensões de browser (Dashlane, LastPass, etc.) injetam atributos no `<body>` (ex: `cz-shortcut-listen="true"`), causando mismatch de hidratação React. Não é bug de código. |
| PWA não funciona em `npm run dev` | Service worker desabilitado em development (`disable: process.env.NODE_ENV === 'development'`) e Turbopack não executa plugins webpack. Para testar PWA: `npm run build && npm start`. |
| `useSearchParams()` exige `<Suspense>` no Next.js 15+ | Componentes que usam `useSearchParams()` precisam estar envolvidos em `<Suspense>` para pré-renderização estática. Padrão: extrair em componente interno + export padrão com `<Suspense>`. |
| Role check em Server Component layout (não no proxy) | Verificar role do usuário no `proxy.ts` adicionava uma query ao banco em CADA request, causando ~400–800ms de latência extra. Movido para `(auth)/admin/layout.tsx` (Server Component, roda uma vez por navegação). |
| `create_notification` com SECURITY DEFINER | RLS de notifications só permite usuário ler as próprias. Para inserir para outros usuários (notificar equipe), precisava de uma função com SECURITY DEFINER que bypassa RLS. Alternativa API route foi descartada por adicionar latência. |
| Notificações fire-and-forget nos hooks | Inserção de notificação em `onSuccess` é não-crítica. Wrapped em IIFE async sem await no handler para não bloquear invalidação de queries e toast. Erros são silenciados (`catch {}`). |
| Supabase Realtime com polling fallback | Realtime pode ser instável em dev (container Docker). `refetchInterval: 60 * 1000` garante que o sino se atualiza mesmo sem WebSocket. Realtime é bonus — polling é o baseline. |
| Cron endpoint protegido por CRON_SECRET | Endpoint `/api/cron/check-alerts` usa `Authorization: Bearer <CRON_SECRET>` para evitar chamadas não autorizadas. Usar com Vercel Cron, GitHub Actions ou curl manual. |
| `ConfirmDialog` refatorado para dual-mode | Versão original usava apenas `open`/`onOpenChange` (controlled). Refatorada para aceitar também `trigger` prop (usa `DialogTrigger asChild`) sem quebrar os usos existentes. `destructive` bool substituiu `variant` string para simplificar. |
| `asChild` ausente em shadcn Primitive wrappers | `dropdown-menu.tsx` e `dialog.tsx` da versão local do shadcn expõem `ComponentProps` via `Trigger.Props` que não inclui `asChild` nos tipos. Solução: adicionar `& { asChild?: boolean }` na assinatura do componente — o Radix processa `asChild` em runtime corretamente. |
| Recorrência automática no useCompleteMaintenanceOrder | Ao concluir uma ordem `recurring`, o hook lê o `recurrence_rule`, calcula `next_due_date` via `calcNextDueDate()` e cria uma nova ordem `open` em uma única mutation. Zero intervenção manual. |
| `useSignedUrls` com paths (não URLs) | `maintenance_photos.url` armazena o storage PATH (não URL completa). `useSignedUrls` faz batch de `createSignedUrls` com staleTime 30min (URLs válidas 1h). React Query evita re-fetch desnecessário. |
| Avatar com signed URL de 1 ano | `user-avatars` é bucket privado. Gerar signed URL de 1 ano no upload e salvar em `users.avatar_url`. Evita hook `useSignedUrls` em todo componente `UserAvatar`. |
| Canvas compression antes do upload | Imagens comprimidas para max 1200px / 80% quality (fotos) e max 600px / 85% quality (avatar) via Canvas API antes do upload. Reduz banda e storage. |
| Dois botões de upload (câmera + galeria) | Mobile-first: botão "Câmera" usa `capture="environment"` (força câmera traseira), botão "Galeria" abre seletor de arquivos. Melhor UX do que um único input. |
| `PhotoLightbox` sem Radix Dialog | Lightbox é um overlay `fixed inset-0 z-[100]` puro com navegação via teclado (Escape/Arrows). Mais leve e sem dependência de Radix para esse caso de uso. |
| E-mail emergency via API route (não hook) | `RESEND_API_KEY` é server-only. Hook client-side chama `POST /api/email/maintenance-emergency` fire-and-forget. Cron chama `sendEmail()` diretamente (já server-side). |
| Resend graceful fallback | `sendEmail()` nunca lança exceção — erros são `console.error`. Se `RESEND_API_KEY` ausente, apenas avisa no log e segue. Fluxo principal nunca é interrompido por falha de e-mail. |
| `preferences.notifications.email` já existia | O toggle de e-mail no perfil já existia como `notifEmail` (mapeado para `preferences.notifications.email`). Nenhuma migração necessária — campo já no JSONB. |
| Multi-unidade com `activeUnitId` no Zustand (não na URL) | URL-based unit routing (ex: `/pinheiros/eventos`) forçaria refactor de todas as rotas. Zustand + localStorage = troca de unidade sem navegar. RLS garante isolamento no banco. |
| `activeUnitId = null` = todas as unidades | super_admin/diretor veem dados agregados de todas as unidades quando null. Hooks não adicionam filtro unit_id nesse caso. Stats no dashboard somam todas as unidades. |
| `unit_id` nullable → NOT NULL com migration incremental | Coluna adicionada nullable, UPDATE atribui unidade pinheiros a todos os registros existentes, depois ALTER COLUMN NOT NULL. Safe em banco não vazio. |
| `get_user_unit_ids()` e `is_global_viewer()` como SQL functions | RLS policies precisam verificar acesso por unidade em múltiplas tabelas. Funções SQL reutilizáveis evitam subquery duplicada em cada policy. SECURITY DEFINER para bypass RLS interno. |
| UNIQUE(name, unit_id) nas config tables | Config tables (event_types, packages, venues, checklist_categories, sectors) tinham UNIQUE(name). Multi-unidade exige UNIQUE(name, unit_id) para permitir mesmo nome em unidades diferentes. |
| `useUnitUsers` separado de `useUserUnits` | `useUserUnits(userId)` retorna unidades de um usuário (admin user). `useUnitUsers(unitId)` retorna usuários de uma unidade (admin unit). Semânticas opostas, queries distintas. |
| queryKey inclui `activeUnitId` em todos os hooks | React Query revalida automaticamente ao trocar de unidade sem precisar de `invalidateQueries` manual. UnitSwitcher ainda invalida explicitamente para garantia dupla. |
| RPC reports com SECURITY INVOKER + GRANT EXECUTE | RLS das tabelas se aplica automaticamente (sem bypass). super_admin vê tudo via `is_global_viewer()` na policy. `p_unit_id = null` retorna todos os dados naturalmente. |
| `equipment TEXT` → `equipment_id UUID FK` na migration 012 | Campo freetext não tinha valor histórico importante. DROP + ADD com nullable FK é mais limpo que manter ambos. Formulário de manutenção agora usa Select dos equipamentos ativos. |
| `logAudit` removido dos hooks client-side de equipamento | `logAudit` usa `createAdminClient` (server-only). Hooks de equipamento são client-side. Auditoria de equipamentos pode ser adicionada futuramente via API route. |
| `compressImage` exportada de photo-upload.tsx | Função era private. Exportada para reutilização em equipment-form.tsx sem duplicação de código. |
| `/* eslint-disable react-hooks/set-state-in-effect */` em useEffect de inicialização de form | Padrão legítimo: carregar dados async → preencher formulário. A regra é muito estrita para este caso de uso. Envolvido em disable/enable para escopo mínimo. |
| `Button asChild` não suportado pelo @base-ui/react/button | Button usa `@base-ui/react/button` que não processa `asChild`. Padrão: `<Link className={cn(buttonVariants({...}))}>`. Mesmo fix aplicado em DropdownMenuTrigger no Bloco 1. |
| `unit_settings` com upsert `onConflict: 'unit_id'` | Evita inserção de linha duplicada. A constraint UNIQUE(unit_id) garante no máximo 1 row por unidade. Primeira gravação insere; edições subsequentes atualizam. |
| `DEFAULT_UNIT_SETTINGS` exportado do hook | Reutilizado em business-hours-tab.tsx para inicializar estado antes dos dados carregarem. Evita duplicação de defaults. |
| `equipment_categories` fallback hardcoded | Se nenhuma categoria gerenciada existir ainda, `equipment-form.tsx` usa `FALLBACK_CATEGORIES`. Facilita onboarding sem precisar configurar antes de usar. |
| `idb` em vez de IDB nativo para offline | API Promise-based, schema tipado via DBSchema, 4KB de bundle. Alternativa `localForage` tem mais peso e menos controle de schema. Dexie foi descartada por API verbosa. |
| `patchesRef` para evitar stale closures no IDB | `handleItemStatus/Notes` são callbacks memorizados com `useCallback`. Se lessem `localPatches` diretamente do state, teriam valor stale na closure. `useRef` sincronizado via `useEffect` garante acesso ao valor atual sem re-criar os callbacks. |
| Checklist offline: patches em memória + IDB | Patches aplicados em memória (`localPatches`) para UI otimista imediata. Salvos no IDB para persistência entre page refreshes. Ao voltar online, React Query (fonte de verdade) substitui tudo e patches são limpos. |
| Upload de foto desabilitado offline | `File` não é serializable para IDB de forma prática (Blob + metadata complexo). Botão de câmera desabilitado quando `isOffline`, `onPhotoChange` passa `undefined`. |
| `useCalendarEvents` com `enabled: isOnline` | Evita query desnecessária ao Supabase quando offline. IDB serve como fallback via `useState` + `useEffect` separados — não mistura com o `queryFn`. |
| Cache key do calendário inclui `activeUnitId` | Garante que trocar de unidade offline não sirva cache de outra unidade. Formato: `dateFrom::dateTo::unitId\|all`. |
