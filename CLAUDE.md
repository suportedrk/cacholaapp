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

### Foundation Layer (feat/ui-polish-foundation — 2026-03-28)

| Artefato | Descrição |
|----------|-----------|
| `src/app/globals.css` | Todos os tokens CSS §1.1–1.5 + dark mode completo + `.interactive` + `prefers-reduced-motion` |
| `src/components/theme-provider.tsx` | ThemeProvider + `useTheme()` — light/dark/system, localStorage, prefers-color-scheme |
| `src/app/layout.tsx` | Script anti-FOUC inline + `<ThemeProvider>` no root |
| `src/components/layout/navbar.tsx` | Toggle Sol/Lua (`<Sun>/<Moon>`) integrado ao `useTheme()` |
| `src/lib/constants/brand-colors.ts` | Hex centralizados para Recharts/html2canvas/e-mails |

### Cores da Marca

| Token | oklch | Hex | Uso |
|-------|-------|-----|-----|
| `--primary` | `oklch(0.567 0.044 144)` | `#7C8D78` | Verde sálvia — botões primários, navbar ativa |
| `--secondary` | `oklch(0.876 0.026 65)` | `#E3DAD1` | Bege quente — backgrounds, cards |
| `--background` | `oklch(0.981 0.004 106)` | `#FAFAF8` | Fundo geral |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Cards, modais |
| `--brand-primary-dark` | `oklch(0.487 0.044 144)` | ~`#697a65` | Hover de primário |
| `--brand-primary-light` | `oklch(0.667 0.038 144)` | ~`#8fa08b` | Backgrounds sutis |

### Rampas de Cor (novas)
- **`bg-brand-50` … `bg-brand-900`** — Verde sálvia completo (50–900)
- **`bg-beige-50` … `bg-beige-900`** — Bege quente completo (50–900)

### Tokens Semânticos Disponíveis (Tailwind utilities)
- **Superfícies:** `bg-surface-primary`, `bg-surface-secondary`, `bg-surface-tertiary`, `bg-surface-inverse`
- **Texto:** `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-inverse`, `text-text-link`
- **Bordas:** `border-border-default`, `border-border-strong`, `border-border-focus`
- **Status:** `bg-status-error-bg`, `text-status-error-text`, `border-status-error-border` (e success/warning/info)
- **Interativos:** `bg-interactive-primary`, `hover:bg-interactive-primary-hover` etc.
- **Sombras:** `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`
- **Z-index:** `z-dropdown` (10), `z-sticky` (20), `z-overlay` (30), `z-modal` (40), `z-toast` (50), `z-tooltip` (60)

### Convenção de Cores
- NUNCA usar hex diretamente na UI — sempre tokens semânticos Tailwind
- **Exceções legítimas** (hex obrigatório): Recharts color props, html2canvas, HTML de e-mail
  → Usar `CHART_COLORS` / `BRAND_GREEN` / `BRAND_BEIGE` de `src/lib/constants/brand-colors.ts`
- Tailwind v4: classes utilitárias geradas via `@theme inline {}` em globals.css

### Dark Mode
- Toggle no navbar (ícone Sol/Lua) — salvo em `localStorage` com chave `cachola-theme`
- Valores: `'light'` | `'dark'` | `'system'` (default)
- Sistema: `prefers-color-scheme` como fallback quando `'system'`
- Anti-FOUC: script inline no `<head>` antes da hidratação React
- CSS: `.dark` e `[data-theme="dark"]` aplicados no `<html>`
- `prefers-reduced-motion`: todas as transições/animações desabilitadas globalmente

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
- [x] `src/components/layout/navbar.tsx`: hamburguer, breadcrumbs (desktop), MobileBackButton (mobile sub-pages) ou logo (top-level), NotificationBell, avatar + dropdown
- [x] `src/components/layout/breadcrumbs.tsx`: geração automática por rota; exporta `Breadcrumbs` (desktop) + `MobileBackButton` (mobile, com `fallback` prop)
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
| `/manutencao/fornecedores/novo` | `(auth)/manutencao/fornecedores/novo/page.tsx` | ✅ funcional (Prompt 4) |
| `/manutencao/fornecedores/[id]` | `(auth)/manutencao/fornecedores/[id]/page.tsx` | ✅ funcional (Prompt 4) |
| `/admin/unidades` | `(auth)/admin/unidades/page.tsx` | ✅ funcional (Fase 2.5) |
| `/admin/unidades/nova` | `(auth)/admin/unidades/nova/page.tsx` | ✅ funcional (Fase 2.5) |
| `/admin/unidades/[id]` | `(auth)/admin/unidades/[id]/page.tsx` | ✅ funcional (Fase 2.5) |
| `/equipamentos` | `(auth)/equipamentos/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/novo` | `(auth)/equipamentos/novo/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/[id]` | `(auth)/equipamentos/[id]/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/[id]/editar` | `(auth)/equipamentos/[id]/editar/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/relatorios` | `(auth)/relatorios/page.tsx` | ✅ funcional (Fase 3 Bloco 1) |
| `/admin/logs` | `(auth)/admin/logs/page.tsx` | ✅ funcional (Fase 3 Bloco 4) |
| `/configuracoes/integracoes/ploomes` | `(auth)/configuracoes/integracoes/ploomes/page.tsx` | ✅ funcional (Fase 4) |
| `/configuracoes/integracoes/ploomes/mapeamento` | `(auth)/configuracoes/integracoes/ploomes/mapeamento/page.tsx` | ✅ funcional (Fase 4) |
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
- [x] `src/components/features/checklists/checklist-item-row.tsx`: toque para ciclar status (pending→done→na), notas expandíveis, upload de foto com câmera; polimento Prompt 7 (2026-03-28):
  - Touch target 48px (`w-12 h-12`) com círculo visual interno (`w-7 h-7`) — nenhum clique acidental
  - SVG inline com `animate-check-draw` (stroke-dashoffset 20→0 em 280ms) ao marcar done
  - Flash verde overlay (`.animate-item-flash`) + haptic `navigator.vibrate(10)` ao concluir
  - "Adicionar nota" / "Ver nota" como link de texto inline (não ícone isolado)
  - Notas com `autoFocus` + botão "Fechar nota" inline
  - Câmera apenas quando `onPhotoChange` fornecido (sem ícone morto no modo read-only)
- [x] `src/components/features/checklists/sortable-template-items.tsx`: DnD reorder com @dnd-kit/core + @dnd-kit/sortable
- [x] `src/components/features/checklists/add-checklist-modal.tsx`: modal de criação a partir de template
- [x] `src/app/(auth)/checklists/page.tsx`: lista paginada com filtros de status + categoria
- [x] `src/app/(auth)/checklists/[id]/page.tsx`: tela de preenchimento mobile-first (footer sticky + finalizar); polimento Prompt 7 (2026-03-28):
  - Sticky sub-header: `-mx-4 lg:-mx-6` full-width dentro do `<main p-4>`, com título + evento + barra de progresso + contagem X/Y + badge de status
  - `SaveIndicator`: "Salvando…" (animate-pulse) → "Salvo ✓" (2s auto-dismiss) via `useEffect` em `isUpdating`
  - `EmptyState`: ícone ClipboardList + textos descritivos
  - `CompletedBanner`: ícone CheckCircle2 com `animate-celebrate` (scale 0.4→1.12→1 bounce)
  - Banner offline/syncing com dark mode completo
  - Footer full-width `size="lg"` com contagem inline no botão
  - `globals.css`: `@keyframes check-draw`, `item-flash-done`, `celebrate-check` + classes `.animate-check-draw` e `.animate-item-flash` + token `--animate-celebrate`
- [x] `src/app/(auth)/checklists/templates/page.tsx`: lista de templates com editar/desativar
- [x] `src/app/(auth)/checklists/templates/novo/page.tsx`: formulário de criação com DnD
- [x] `src/app/(auth)/checklists/templates/[id]/editar/page.tsx`: formulário de edição com DnD
- [x] `src/app/(auth)/eventos/[id]/page.tsx`: seção Checklists real (lista + AddChecklistModal)

### Fase 1 — Bloco 2: Dashboard + Calendário Unificado (2026-03-27)
- [x] `src/hooks/use-dashboard.ts`: useDashboardStats, useNextEvent, useCalendarEvents + tipo CalendarEvent
- [x] `src/components/features/dashboard/stats-card.tsx`: card de métrica com ícone, valor, loading skeleton
- [x] `src/components/features/dashboard/next-event-card.tsx`: próximo evento com equipe + link direto
- [x] `src/components/features/dashboard/event-quick-view.tsx`: Sheet drawer com detalhes do evento
- [x] `src/components/features/dashboard/calendar-view.tsx`: calendário 3 visões (mês/semana/dia) com CSS Grid + polimento visual (Prompt 6 — 2026-03-28):
  - Popover ao clicar número do dia (quando há eventos) via base-ui Popover com `render` prop
  - Hoje: `bg-brand-50` na célula; círculo filled (light) / ring-2 (dark)
  - Dia cheio (≥3 eventos): `border-l-2 border-l-primary/40 bg-primary/[0.03]`
  - Hover nas células: `hover:bg-muted/30`
  - Badge "N eventos" no header da visão mensal
  - Botão "Hoje" quando fora do período atual (desktop)
  - Toggle calendário/lista no mobile (ícones CalendarDays / LayoutList)
  - `ListView` — visão lista para mobile: agrupa por data, sort por hora, touch targets 44px
  - Transição slide direcionada ao trocar mês (`navDir` state + `animate-slide-left-in` / `animate-slide-right-in`)
  - Skeleton granular por célula (skeleton-shimmer) substituindo animate-pulse
  - Eventos `lost`: `opacity-60` + `line-through`; dot vermelho com opacity
  - Dark mode completo: todos os pills/dots com variantes `dark:`
  - `globals.css`: `@keyframes slide-left-in` + `slide-right-in` + tokens `--animate-slide-left-in/right-in`
  - `popover.tsx`: `render` prop adicionada ao tipo de `PopoverTrigger`
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

### Manutenção — Schema Expandido (Migration 017 — 2026-03-28)

#### Tipos de manutenção
- `emergency`: resolução imediata (brinquedo quebrou durante evento)
- `punctual`: tem prazo definido (trocar lâmpada)
- `recurring`: tarefas rotineiras de curto prazo (limpar banheiro toda segunda)
- `preventive`: plano de manutenção programada com checklist técnico (revisão ar-cond. a cada 6 meses)

#### Tabelas novas
- `maintenance_suppliers`: fornecedores/empresas (unit_id, company_name, cnpj, category, rating 1–5)
- `supplier_contacts`: contatos N:1 do fornecedor (name, role, phone, whatsapp, is_primary)
- `supplier_documents`: documentos do fornecedor com vencimento (file_url, expires_at)
- `maintenance_costs`: custos com workflow de aprovação (amount, cost_type, status: pending→approved/rejected)

#### Novas colunas em maintenance_orders
- `supplier_id`: FK para maintenance_suppliers (nullable)
- `cost_estimate`: estimativa de custo DECIMAL(10,2) (nullable)
- `completed_at`: timestamp de conclusão para cálculo de SLA (nullable)
- `preventive_plan`: JSONB `{ frequency, interval, checklist_items[], last_performed_at, next_due_date, advance_notice_days, linked_equipment_id }`

#### Diferença recurrence_rule vs preventive_plan
- `recurrence_rule` → tarefas rotineiras de curto prazo (semanal/quinzenal)
- `preventive_plan` → manutenção programada médio/longo prazo com checklist técnico

#### Buckets Storage
- `supplier-documents`: documentos de fornecedores (10MB, PDF/imagem/doc, privado)
- `maintenance-receipts`: comprovantes de custos (10MB, PDF/imagem, privado)

#### Workflow de custos (maintenance_costs)
1. Técnico registra custo (`status: pending`) com comprovante
2. Gerente aprova ou reprova (`status: approved/rejected`) com motivo em `review_notes`
3. Financeiro visualiza custos aprovados (filtro por status)

#### Notificações de custos (src/lib/notifications.ts)
- `cost_submitted`: técnico submeteu → notifica gerentes da unidade
- `cost_approved`: gerente aprovou → notifica técnico que submeteu
- `cost_rejected`: gerente rejeitou → notifica técnico (com motivo)

### Manutenção — Dashboard / KPIs (Prompt 2 — 2026-03-28)

#### API
- `GET /api/maintenance/stats?unit_id=X` — retorna KPIs + dados de gráficos
- 10 queries em `Promise.all`; processamento de gaps semanais e médias no JS
- Auth: cookie-based via `createClient()` server (padrão do projeto)

#### Hook
- `useMaintenanceStats()` em `src/hooks/use-maintenance-stats.ts`
- `staleTime: 2min`, `enabled: !!activeUnitId && isSessionReady`
- `retry`: não retenta 401/403

#### Componentes
- `MaintenanceKPIs`: 5 cards — abertas, atrasadas, concluídas (mês), tempo médio, custos (mês)
  - Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`; card 5 tem `col-span-2 sm:col-span-1`
  - Variante `error` (fundo vermelho) no card Atrasadas quando `count > 0`
  - Sub-texto emergenciais (vermelho) e pendentes de aprovação (âmbar)
  - Counter animation: `requestAnimationFrame` com ease-out cúbico (500ms)
- `MaintenanceCharts`: AreaChart semanal + barras CSS por tipo/setor
  - AreaChart: Recharts `ResponsiveContainer` 140px, gradiente `#22C55E`
  - Barras CSS: `transition-width 500ms ease-out`, delay por índice
  - Stagger de entrada: `animationDelay` 0–50ms, `animationFillMode: backwards`

#### Cores por tipo (hex — Recharts/CSS)
- `emergency`=#EF4444, `punctual`=#F59E0B, `recurring`=#22C55E, `preventive`=#3B82F6
- Setores: `BRAND_GREEN[500]` (#7C8D78)

#### Animação `fadeSlideUp`
- `@keyframes fade-slide-up` em `globals.css`; `prefers-reduced-motion` sem translateY
- Token: `--animate-fade-slide-up`; classe: `.animate-fade-slide-up`

### Manutenção — Fornecedores (Prompt 4 — 2026-03-28)

#### Hooks (`src/hooks/use-suppliers.ts`)
- `useSuppliers(filters)`: lista com `*, contacts:supplier_contacts(*), documents_count:supplier_documents(count)`
- `useSupplier(id)`: detalhe com `*, contacts:supplier_contacts(*), documents:supplier_documents(*)`
- `useCreateSupplier`, `useUpdateSupplier`, `useDeleteSupplier`
- `useCreateContact`, `useUpdateContact`, `useDeleteContact` — lógica de contato principal (batch update is_primary=false antes)
- `useUploadSupplierDocument`: fake progress interval 12%/180ms→85%, snap 100% ao concluir; path `{supplierId}/{timestamp}_{safeFilename}`
- `useDeleteSupplierDocument`: remove registro + storage (best-effort)
- Exports: `SUPPLIER_CATEGORIES`, `SupplierFilters`, `SupplierWithCounts`, `SupplierWithDetails`, `SupplierInsert`, `ContactInsert`

#### Componentes
- `src/components/features/maintenance/supplier-rating.tsx`: 5 estrelas, hover preview, nullable (clicar estrela selecionada remove rating)
- `src/components/features/maintenance/supplier-card.tsx`: avatar Building2, category color badge, primary contact, doc/contact counts, CNPJ mono, `SupplierCardSkeleton`
- `src/components/features/maintenance/supplier-form.tsx`: form criação/edição com CNPJ+phone mascarados, rating stars, category select, is_active Switch
- `src/components/features/maintenance/contact-list.tsx`: lista inline de contatos com add/edit/delete; badge "Principal" (estrela âmbar); ConfirmDialog para exclusão
- `src/components/features/maintenance/supplier-document-section.tsx`: upload com progress bar, badges de vencimento (vermelho=vencido, âmbar≤30 dias), view por tipo (lightbox imagens, window.open PDFs), `formatBytes` helper
- `src/components/features/maintenance/supplier-list.tsx`: busca debounce 300ms, filtro categoria Select, FilterChips status Ativo/Inativo, grid `lg:grid-cols-2`

#### Páginas
- `src/app/(auth)/manutencao/fornecedores/novo/page.tsx`: form de criação → redirect para `/manutencao/fornecedores/[id]`
- `src/app/(auth)/manutencao/fornecedores/[id]/page.tsx`: 3 sections (Dados da Empresa, Contatos, Documentos), inline edit, delete com ConfirmDialog

#### Integrações
- `maintenance-tabs.tsx`: aba Fornecedores → `<SupplierList />` (substituiu PlaceholderTab)
- `maintenance-form.tsx`: campo `supplier_id` (select fornecedores ativos), campo `cost_estimate`, tipo `preventive` adicionado

#### Buckets Storage
- `supplier-documents`: documentos de fornecedores (privado, path `{supplierId}/{timestamp}_{filename}`)

---

### Manutenção — Custos e Prestação de Contas (Prompt 5 — 2026-03-28)

#### Hooks (`src/hooks/use-maintenance-costs.ts`)
- `useMaintCosts(filters)`: lista com relações order/submitter/reviewer; pending primeiro; filtros status/tipo/período
- `useOrderCosts(orderId)`: custos de uma ordem específica (usado no detalhe da OS)
- `useCostsSummary()`: 3 KPIs em queries paralelas — `pendingCount`, `approvedSum` (mês), `totalSum` (mês)
- `useCurrentUser()`: perfil atual para checar role/id (permission gate nos componentes)
- `useSubmitCost()`: insere com `status='pending'`, invalida queries de custos + stats
- `useApproveCost()`: update para `approved` + `reviewed_by/at`
- `useRejectCost({ costId, review_notes })`: update para `rejected` + motivo obrigatório
- `useDeleteCost({ costId, receiptUrl })`: remove registro + storage best-effort
- `useUploadReceipt()`: upload para `maintenance-receipts` com fake progress 12%/180ms→85%
- Exports: `COST_TYPE_LABELS`, `PERIOD_OPTIONS`, `MANAGER_ROLES`, `formatBRL()`

#### Componentes
- `src/components/features/maintenance/costs-tab.tsx`: aba Custos — 3 KPI cards (Pendentes/Aprovados/Total), filtros período+status+tipo, lista de `CostCard`, EmptyState, botão "Registrar Custo"
- `src/components/features/maintenance/cost-card.tsx`: card com `border-l-4` por status (amber/green/red), comprovante (gera signed URL on-demand via `createSignedUrl`), ações contextuais, motivo em alert banner vermelho quando rejeitado; `CostCardSkeleton`
- `src/components/features/maintenance/cost-form-modal.tsx`: Dialog com select ordem, descrição, currency input (máscara R$ centavos→decimal), select tipo, upload comprovante, notas
- `src/components/features/maintenance/reject-cost-modal.tsx`: Dialog com textarea motivo (mín 10 chars), contador de caracteres

#### Permissões
- **Registrar:** qualquer usuário autenticado com acesso ao módulo
- **Aprovar/Reprovar:** `MANAGER_ROLES = ['super_admin', 'diretor', 'gerente']` + `submitted_by !== currentUserId`
- **Cancelar:** apenas autor (`isOwnCost && status==='pending'`) quando não for gerente (gerentes veem "Aguarda revisão")

#### Integrações
- `maintenance-tabs.tsx`: aba Custos → `<CostsTab />` (substituiu PlaceholderTab)
- `manutencao/[id]/page.tsx`: seção "Custos" com lista inline, totalizadores (aprovado/pendente/estimativa) e barra de progresso vs `cost_estimate`
- Input monetário: máscara centavos (`15000` → `"150,00"`), salvo como decimal `150.00`

#### Buckets Storage
- `maintenance-receipts`: comprovantes de custo (privado, path `{userId}/{timestamp}_{filename}`)

### Manutenção — Histórico Consolidado (Prompt 6 — 2026-03-28)

#### API
- `GET /api/maintenance/history-summary?unit_id=X[&date_from&date_to&type&sector_id&supplier_id]`
- KPIs: `total_completed`, `avg_resolution_hours`, `total_cost_approved`, `avg_cost_per_order`
- Chart: `by_month[]` — últimos 12 meses fixos (count + cost), com filtros type/sector/supplier aplicados
- Auth: cookie-based, retorna 401 sem sessão

#### Hooks (`src/hooks/use-maintenance-history.ts`)
- `useMaintenanceHistory(filters)` — `useInfiniteQuery`, 20/batch, offset pagination, status=completed
- `useHistorySummary(filters)` — fetch para API route, `staleTime: 2min`
- `formatResolutionTime(hours)` — `< 1h → Xmin`, `< 24h → Xh`, `>= 24h → X dias`
- `calcResolutionHours(created_at, completed_at)` — diferença em horas, null se sem completed_at
- `HistoryFilters` type: `date_from`, `date_to`, `type[]`, `sector_id`, `supplier_id`

#### Componentes
- `src/components/features/maintenance/history-timeline.tsx`: timeline vertical agrupada por mês
  — `groupByMonth()` via `format(parseISO(completed_at), 'MMMM yyyy')`
  — Dot colorido por tipo (vermelho/âmbar/verde/azul) + linha conectora `bg-border`
  — Card com ícone, título, setor, fornecedor, data conclusão, tempo de resolução
  — `HistoryTimelineSkeleton` incluído
- `src/components/features/maintenance/history-tab.tsx`: aba completa
  — 4 KPI cards (2×2 mobile, 4×1 desktop)
  — Recharts `ComposedChart`: `Bar` (count, eixo Y esquerdo) + `Line` (cost, eixo Y direito)
  — Filtros: date range inputs + type `FilterChip`s + sector `Select` + supplier `Select`
  — Export Excel (`exportToExcel`) + PDF (`exportReportPDF`) — botões aparecem só quando há dados
  — Load-more button (hasNextPage via useInfiniteQuery)
  — Empty state (HistoryIcon), skeleton, error state

#### Integração
- `maintenance-tabs.tsx`: aba Histórico → `<HistoryTab />` (substituiu `PlaceholderTab`)

---

### Fase 2 — Bloco 2: Upload de Fotos (2026-03-27 → polimento Prompt 8 2026-03-28)
- [x] `src/hooks/use-signed-urls.ts`: `useSignedUrls(bucket, paths)` — batch `createSignedUrls`, staleTime 30min
- [x] `src/components/shared/photo-upload.tsx`: **Prompt 8** — reescrita completa; exports: `compressImage`, `PhotoDropZone` (alias `PhotoUpload`), `PhotoThumb`
  - `PhotoDropZone`: drop zone visual (border-dashed 2px, ícone Camera 32px, texto responsivo "Toque para tirar foto" mobile / "Arraste fotos ou clique" desktop), drag-and-drop com isDragOver, hover/dragover com `--color-brand-50` + `border-primary`; estados: `confirm` (Usar foto / Tirar outra), `uploading` (overlay 55% + % centralizado + progress bar h-1.5 + indicador "2.4 MB → 480 KB"), `success` (CheckCircle2 verde + `animate-scale-in` 1.3s), `error` (X vermelho + mensagem + botão "Tentar novamente"); dois inputs ocultos: câmera (`capture="environment"`) + galeria; link secundário "ou escolher da galeria"
  - `PhotoThumb`: aspect-ratio 4:3 (era 80×80 fixo), hover `scale-[1.02]`, botão X sempre visível no mobile (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`), `hover:bg-red-500`
- [x] `src/components/shared/photo-lightbox.tsx`: overlay fullscreen, prev/next, keyboard (Esc/Arrows), contador e label por foto
- [x] `src/components/features/maintenance/photo-section.tsx`: **Prompt 8** — layout 2 colunas Antes|Depois (`grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x`) + Durante abaixo; badges `badge-gray`/`badge-green`/`badge-amber border`; `SectionColumn` sub-componente; estado vazio read-only (aspect-[4/3] border-dashed); usa `PhotoDropZone`
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

### Fase 4 — Integração Ploomes CRM (2026-03-27)
- [x] `supabase/migrations/014_ploomes_integration.sql`: UNIQUE constraint em `events.ploomes_deal_id`, nova coluna `events.ploomes_url TEXT`, tabela `ploomes_sync_log` com RLS (super_admin/diretor/gerente), índices por started_at/status/unit_id
- [x] `.env.example`: `PLOOMES_USER_KEY`, `PLOOMES_API_URL`, `PLOOMES_PIPELINE_ID`, `PLOOMES_STAGE_FESTA_FECHADA_ID`, `PLOOMES_WON_STATUS_ID`, `PLOOMES_SYNC_INTERVAL_MINUTES`, `PLOOMES_WEBHOOK_SECRET` adicionados
- [x] `src/lib/ploomes/types.ts`: `PloomesODataResponse<T>`, `PloomesDeal`, `PloomesContact`, `PloomesOtherProperty`, `PloomesAttachment`, `ParsedDeal`, `SyncResult`, `PloomesApiError`, `FieldMappingDef`
- [x] `src/lib/ploomes/client.ts`: singleton HTTP com retry 3x (backoff exp.), timeout 30s, `ploomesGet`, `ploomesGetOne`, `ploomesPost`, `ploomesUpload`
- [x] `src/lib/ploomes/field-mapping.ts`: `DEAL_FIELD_MAP` (9 campos customizados), `FIELD_LABELS`, `parseDeal()` — converte `OtherProperties[]` em `ParsedDeal` com parsers date/time/string/number
- [x] `src/lib/ploomes/sync.ts`: `syncDeals(supabase, options)` — carrega config do banco via `loadPloomesConfig()`, busca deals, resolve unit_id/venue_id (auto-cria venue), upsert em `events` via `ON CONFLICT (ploomes_deal_id)`, registra log; fallback para env vars
- [x] `src/lib/ploomes/upload.ts`: `uploadFileToDeal(dealId, file, filename)` — multipart/form-data para `/Deals({id})/UploadFile`, retorna `PloomesAttachment`
- [x] `src/app/api/ploomes/sync/route.ts`: POST — sync manual com auth + permissão + debounce 2min
- [x] `src/app/api/ploomes/sync/status/route.ts`: GET — últimos 20 registros de `ploomes_sync_log`
- [x] `src/app/api/ploomes/config/route.ts`: GET/POST/PATCH — CRUD de `ploomes_config` (pipeline_id, stage_id, won_status_id, field_mappings, contact_mappings, status_mappings, webhook_url)
- [x] `src/app/api/ploomes/webhook-register/route.ts`: POST (super_admin) — registra webhook no Ploomes, persiste webhook_url em `ploomes_config`, idempotente
- [x] `src/app/api/ploomes/deals/route.ts`: GET — proxy: lista deals do pipeline com `parseDeal`
- [x] `src/app/api/ploomes/deals/[dealId]/route.ts`: GET — proxy: deal específico com campos parseados
- [x] `src/app/api/ploomes/upload/[dealId]/route.ts`: POST — upload via FormData (PDF de checklist → Deal)
- [x] `src/app/api/webhooks/ploomes/route.ts`: POST — valida `X-Ploomes-Validation-Key` (env `PLOOMES_VALIDATION_KEY`), filtra por Entity=Deal e Action Win/Update, ignora Create e outras entidades
- [x] `src/app/api/cron/ploomes-sync/route.ts`: GET protegido por `CRON_SECRET` — sync global automático + notificação para admins após 3 falhas consecutivas
- [x] `src/hooks/use-ploomes-sync.ts`: `usePloomesSyncStatus()` (polling 5s/30s), `useTriggerPloomesSync()` (mutation com toast), `usePloomesIntegrationActive(unitId)`, `usePloomesConfig(unitId)` — carrega ploomes_config do banco
- [x] `src/components/features/ploomes/ploomes-badge.tsx`: pill azul "Ploomes" clicável (abre deal) ou estático
- [x] `src/components/features/ploomes/sync-status-card.tsx`: card com badge status, counters 4-grid, botão "Sincronizar Agora", timestamp, mensagem de erro
- [x] `src/components/features/ploomes/sync-history-table.tsx`: tabela das últimas 20 syncs com status icons, contadores, duração
- [x] `src/components/features/ploomes/ploomes-event-details.tsx`: seção com fundo azul, campos do deal (read-only), link "Ver no Ploomes", Deal ID
- [x] `src/components/features/ploomes/mapping-pipeline-card.tsx`: card Pipeline/Funil (pipeline_id, stage_id, won_status_id) lidos do banco
- [x] `src/components/features/ploomes/mapping-field-card.tsx`: tabela com todos os field_mappings do banco (FieldKey, campo interno, valueKey, parser)
- [x] `src/components/features/ploomes/mapping-contact-card.tsx`: mapeamento contact_mappings (campo interno → Contact.campo)
- [x] `src/components/features/ploomes/mapping-status-card.tsx`: mapeamento status_mappings com badges coloridos (Ploomes → evento)
- [x] `src/app/(auth)/configuracoes/integracoes/ploomes/page.tsx`: página completa (SyncStatusCard + SyncHistoryTable + link para mapeamento)
- [x] `src/app/(auth)/configuracoes/integracoes/ploomes/mapeamento/page.tsx`: 4 cards de mapeamento lidos de `ploomes_config`, skeleton, empty state
- [x] `src/app/(auth)/configuracoes/page.tsx`: nova aba "Integrações" com link card para `/configuracoes/integracoes/ploomes`
- [x] `src/components/features/events/event-card.tsx`: `PloomeBadge` exibido ao lado do status badge quando `ploomes_deal_id != null`
- [x] `src/app/(auth)/eventos/[id]/page.tsx`: seção "Dados do Ploomes" inserida antes da equipe quando evento tem `ploomes_deal_id`
- [x] `src/app/(auth)/eventos/page.tsx`: banner azul informativo quando integração ativa + botão "Novo Evento" oculto + empty state adaptado
- [x] `src/app/(auth)/eventos/[id]/editar/page.tsx`: banner âmbar avisando que campos do Ploomes serão sobrescritos na próxima sync
- [x] `src/types/database.types.ts`: `PloomesSyncLog`, `PloomesConfigRow` types + `ploomes_sync_log`, `ploomes_config` em `Database.Tables` + `ploomes_url` em `Event`

### Fase 4 — Ploomes Config no Banco (2026-03-27)
- [x] `supabase/migrations/015_ploomes_config.sql`: tabela `ploomes_config` (UNIQUE unit_id), campos pipeline/stage/won_status_id, field_mappings/contact_mappings/status_mappings JSONB, webhook_url, trigger updated_at, RLS (managers can select), seed Pinheiros com 9 campos customizados
- [x] `src/lib/ploomes/sync.ts`: refatorado — `loadPloomesConfig(supabase, unitId)` lê do banco, fallback para env vars se sem config
- [x] `src/app/api/ploomes/config/route.ts`: GET/POST/PATCH da tabela ploomes_config
- [x] `src/app/api/ploomes/webhook-register/route.ts`: POST registra webhook no Ploomes via API (idempotente) + salva em ploomes_config
- [x] `src/app/api/webhooks/ploomes/route.ts`: corrigido — `X-Ploomes-Validation-Key`, parse de Action/Entity/New/Old, ignora Create
- [x] `.env.example`: `PLOOMES_VALIDATION_KEY`, `NEXT_PUBLIC_APP_URL`; pipeline/stage/status marcados deprecated
- [x] `src/app/(auth)/configuracoes/integracoes/ploomes/mapeamento/page.tsx`: página visual com 4 seções carregadas do banco
- [x] 4 componentes mapping-*-card.tsx: Pipeline, Fields, Contact, Status

### Fase 4 — Status 'lost' + Paginação Ploomes (2026-03-27)
- **StatusId no Ploomes (padrão global):** 1=Em aberto, 2=Ganho, 3=Perdido (NOT 1=Ganho como assumido originalmente)
- **REGRA:** Todos os deals no stage "Festa Fechada" são importados.
  - StatusId=1 (Em aberto) → `confirmed` (negociação aberta mas no stage fechada = festa confirmada)
  - StatusId=2 (Ganho) → `confirmed` (a maioria dos deals — ~642 de 654)
  - StatusId=3 (Perdido) → `lost` (mantido para estatísticas, oculto por padrão na UI)
- **Paginação OData:** loop `$top=100 + $skip=N` até `page.length < 100`; total: 654 deals (646 confirmed + 8 lost)
- **'lost' na UI:** filtro "Perdido" separado do grupo principal (após separador vertical), desativado por padrão; cards com `opacity-60` e título `line-through`; excluído de contadores do dashboard e do calendário
- **Nota técnica:** `cancelled` foi removido do CHECK em migration 006; `lost` adicionado em migration 016
- [x] `supabase/migrations/016_events_status_lost.sql`: ADD `lost` ao CHECK constraint de `events.status`; ADD `deals_removed INTEGER DEFAULT 0` ao `ploomes_sync_log`
- [x] `src/types/database.types.ts`: `EventStatus` += `'lost'`; `PloomesSyncLog` += `deals_removed`; `SyncResult` += `dealsMarkedLost`
- [x] `src/components/shared/event-status-badge.tsx`: STATUS_CONFIG e DOT_COLOR com entrada `lost` (cinza suave)
- [x] `src/lib/ploomes/sync.ts`: paginação OData com loop `$skip`; `StatusId===3→lost`, demais→`confirmed`; `dealsMarkedLost` counter; error log no sync_log INSERT
- [x] `src/components/features/events/event-filters.tsx`: `MAIN_STATUSES` sem `lost`; badge "Perdido" após separador, desativado por padrão
- [x] `src/components/features/events/event-card.tsx`: `opacity-60` + `line-through` no título quando `status==='lost'`
- [x] `src/hooks/use-events.ts`: sem filtro de status → `neq('status','lost')` por padrão
- [x] `src/hooks/use-dashboard.ts`: `useDashboardStats` e `useNextEvent` excluem `lost`; `useCalendarEvents` exclui `lost`
- [x] `src/components/features/ploomes/mapping-status-card.tsx`: suporte a `cacholaStatus` (novo) + `cacholaAction` (legado); `lost` renderizado como "Perdido" cinza
- [x] `supabase/migrations/015_ploomes_config.sql`: seed `status_mappings` com formato correto (1=Em aberto→confirmed, 2=Ganho→confirmed, 3=Perdido→lost)

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

## AUDITORIA DE QUALIDADE UI/UX (2026-03-28)

Varredura completa do codebase para consistência visual, acessibilidade e idioma.

### Corrigido

| Categoria | Arquivo | Correção |
|-----------|---------|----------|
| **Idioma (pt-BR)** | `src/components/ui/dialog.tsx` | `"Close"` → `"Fechar"` (sr-only + aria-label) |
| **Idioma (pt-BR)** | `src/components/ui/sheet.tsx` | `"Close"` → `"Fechar"` (sr-only) |
| **Idioma (pt-BR)** | `src/components/ui/command.tsx` | `"Command Palette"` → `"Paleta de Comandos"`, placeholder traduzido |
| **Hex hardcoded** | `src/components/features/reports/donut-chart-card.tsx` | 8 hex → `BRAND_GREEN` / `BRAND_BEIGE` / `BRAND_CHART.tealMid/tealLight` |
| **Hex hardcoded** | `src/hooks/use-unit-settings.ts` | `'#7C8D78'` → `BRAND_GREEN[500]` |
| **Hex hardcoded** | `src/lib/constants/brand-colors.ts` | Adicionado `tealMid: '#6B9E8B'` e `tealLight: '#A8C5BD'` ao `CHART_COLORS` |
| **Alt text** | `src/components/features/settings/brand-identity-tab.tsx` | `alt="Logo"` → `alt="Logo da unidade"` |
| **Alt text** | `src/components/layout/sidebar.tsx` | `alt="Logo"` → `alt={\`Logo \${displayName \|\| APP_NAME}\`}` |
| **Breadcrumb** | `src/components/layout/breadcrumbs.tsx` | Segmento `admin` ocultado via `HIDDEN_SEGMENTS`; hrefs preservados |
| **Breadcrumb** | `src/app/(auth)/configuracoes/integracoes/ploomes/mapeamento/page.tsx` | Breadcrumb inline duplicado removido |

### Exceções Legítimas (não corrigidas intencionalmente)

| Arquivo | Razão |
|---------|-------|
| `src/app/global-error.tsx` | Inline styles obrigatórios — Tailwind não carrega em error boundary global |
| `src/app/layout.tsx` `themeColor` | Meta tag do browser requer hex real |
| `src/app/(auth)/dashboard/page.tsx` `STROKE` | Recharts sparkline requer hex |
| `src/lib/utils/export.ts` | jsPDF desenha com RGB/hex diretamente |
| `src/lib/constants/brand-colors.ts` | Arquivo de definição — hex aqui são intencionais |
| `src/components/features/pwa/splash-screen.tsx` | Gradient inline sem Tailwind disponível |
| `src/app/(public)/login/page.tsx` | BrandingPanel gradient inline intencional |
| `src/components/features/settings/brand-identity-tab.tsx` `ACCENT_PRESETS` | São dados de cor (opções do color picker), não estilos |

### Resultado TypeScript
`npx tsc --noEmit` → **zero erros**

---

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
- [x] Fase 4: Integração Ploomes CRM (lib cliente, sync, upload, cron, webhook, UI completa)

> **NOTA:** Após subir o Supabase com `docker compose up -d`, regenerar os tipos com:
> ```bash
> npx supabase gen types typescript --local > src/types/database.types.ts
> ```

---

## UI/UX CHANGELOG — Polimento Visual (2026-03-28)

Série de 5 prompts que implementou o sistema visual completo do Cachola OS.
Branch: `feat/ui-polish-foundation`

### Prompt 1 — Foundation Layer
- `globals.css`: tokens CSS completos (cores, sombras, z-index, tipografia, espaçamento, transições)
- `ThemeProvider` + toggle Sol/Lua + anti-FOUC script inline
- `.icon-{cor}` e `.badge-{cor}` — utilitários semânticos adaptados a dark mode
- PloomeBadge: corrigido dark mode (`badge-blue border` em vez de hex hardcoded)

### Prompt 2 — Componentes Base Polish
- **FilterChip** (`src/components/shared/filter-chip.tsx`): novo componente reutilizável
  — cores semânticas por tipo (brand/amber/red/green/blue/purple/orange/gray)
  — estado ativo usa `.badge-{cor}`, inativo usa ghost outlined
  — touch target 44px, `aria-pressed`
- **Tabs** (`src/components/ui/tabs.tsx`): variante `line` como default
  — underline 2px em `bg-primary` na aba ativa, sem bg sólido
- **Input/Select** (`src/components/ui/input.tsx`, `select.tsx`): h-10 (40px), hover border
- **Migração `__all__`→`null`**: Select base-ui renderiza value raw; `null` = placeholder
  — aplicado em `equipamentos/page.tsx`, `audit-filters.tsx`
- **Badges dark mode**: checklist-card, equipment-card migrados para `.badge-*`

### Prompt 3 — Sidebar + Navbar + Layout
- **Sidebar colapsável** (`sidebar.tsx`):
  — 240px expandida / 64px colapsada (desktop), drawer mobile com overlay
  — Labels ocultam via `lg:opacity-0 lg:w-0` ao colapsar
  — Tooltips com `render` prop (base-ui não suporta `asChild` em Trigger)
  — Botão toggle ChevronLeft/Right no footer
  — Estado persistido em `localStorage` (`sidebar-collapsed`)
  — Grupos de navegação com section labels (`NAV_GROUPS` em `nav-items.ts`)
- **AppLayout** (`app-layout.tsx`): `sidebarCollapsed` state + `mainRef` scroll tracking
- **Navbar** (`navbar.tsx`): h-12 mobile / h-14 desktop; `shadow-sm` condicional ao rolar
- **Tooltip.tsx**: `render?: ReactElement` adicionado ao tipo de `TooltipTrigger`

### Prompt 4 — Animações e Micro-interações
- **globals.css** — 4 `@keyframes`:
  - `page-enter`: fade + slide-up 8px (300ms) — page transitions
  - `fade-up`: para stagger no dashboard (400ms)
  - `shimmer`: gradiente deslizante para skeleton (1.5s infinite)
  - `scale-in`: escala 0.95→1 para modais (200ms bounce)
- **Tokens Tailwind**: `animate-page-enter`, `animate-fade-up`, `animate-shimmer`, `animate-scale-in`
- **`.skeleton-shimmer`**: substitui `animate-pulse` — gradiente `color-mix` dark-mode safe
- **`.card-interactive`**: hover lift `translateY(-2px)` + `shadow-md` + `border-strong`; active `scale(0.98)`; dark mode shadow ajustado; `prefers-reduced-motion` suprime transform mantendo mudança de cor — GPU only
- **`app-layout.tsx`**: `key={pathname}` no wrapper → `animate-page-enter` a cada navegação
- **`button.tsx`**: `hover:scale-[1.02] active:scale-[0.98]` + `disabled:scale-100`
- **Todos os cards**: migrados para `.card-interactive` (event, checklist, maintenance, equipment, stats)
- **Dashboard stagger**: 6 stats cards com `animate-fade-up` e delays 0–250ms (50ms cada)
- **Reduced motion**: coberto pela regra global já existente (`0.01ms !important`)

### Prompt 5 — Polimento Final
- **`src/app/not-found.tsx`**: página 404 estilizada com ícone Compass + `animate-page-enter`
- **`src/app/(auth)/error.tsx`**: error boundary para rotas auth — ícone destrutivo, "Tentar novamente" + "Dashboard"
- **`src/app/global-error.tsx`**: error boundary global (inclui `<html>/<body>`) — fallback inline CSS
- Mobile 375px verificado: sem scroll horizontal, filter chips wrapping, touch targets OK
- TypeScript strict: zero erros em todo o polimento

---

## UI/UX CHANGELOG — Phase 2 (2026-03-28)

Branch: `claude/optimistic-poitras`

### Prompt 7 — Checklist Fill Page Polish (verificação)
- Checklist fill page (`/checklists/[id]`) verificada com dados reais
- Sticky sub-header full-width, touch target 48px, SVG `animate-check-draw`, haptic vibrate(10)
- `SaveIndicator`: "Salvando…" → "Salvo ✓" (2s auto-dismiss); `CompletedBanner` com `animate-celebrate`

### Prompt 8 — Photo Upload Polish
- **`src/components/shared/photo-upload.tsx`** — State machine `idle|confirm|uploading|success|error`:
  - Drop zone dashed border + Camera 32px; hover/dragover `bg-[var(--color-brand-50)]`
  - "Toque para tirar foto" (mobile) / "Arraste fotos ou clique" (desktop)
  - Confirm step: preview `aspect-[4/3]` + "Usar foto" / "Tirar outra"
  - Progress overlay 55% + barra bottom + compression indicator "2.4 MB → 480 KB"
  - Success: `CheckCircle2` verde + `animate-scale-in`, auto-reset 1.3s; Error: retry
  - `PhotoThumb`: `aspect-[4/3]`, hover scale, remove btn `sm:opacity-0 sm:group-hover:opacity-100`
- **`src/components/features/maintenance/photo-section.tsx`**:
  - Grid 2 colunas `sm:grid-cols-2 divide-x` (Antes|Depois) + `border-t` row (Durante)
  - Badges: `badge-gray` (Antes), `badge-green` (Depois), `badge-amber` (Durante)

### Prompt 9 — Ploomes Mapping Page Redesign
- **`src/app/(auth)/configuracoes/integracoes/ploomes/mapeamento/page.tsx`** — Reescrita completa:
  - Breadcrumb + header com título + `SaveIndicator` inline
  - `SyncMiniCard`: último sync + deal count + "Sincronizar agora" (usa `usePloomesSyncStatus`)
  - **Section 1 — Funil & Estágio** (editável): Pipeline ID, Stage ID, Won Status ID com tooltips + ✓/⚠ indicators + badge "Configuração obrigatória"
  - **Section 2 — Campos da Festa** (read-only): tabela de 9 campos de `DEAL_FIELD_MAP` com ✓/○ + badge "N/9 configurados"
  - **Section 3 — Dados do Cliente** (editável): 3 inputs `Contact.[field]`
  - **Section 4 — Status do Deal** (read-only): 3 linhas com pills coloridos + nota contextual azul
  - Auto-save debounce 500ms; guard vs save na hidratação (compara com `config` do DB)
  - Footer sticky: "Testar mapeamento" → chama `/api/ploomes/deals`, toast com título/data/cliente
  - TypeScript strict: zero erros

### Prompt 10 — Login Page Premium Branding
- **`src/app/(public)/login/page.tsx`** — Reescrita completa com layout split desktop:
  - `<div className="min-h-svh lg:grid lg:grid-cols-2">` — split 50/50 no desktop
  - `BrandingPanel` (hidden mobile, `lg:flex`): gradiente `from-brand-500 to-beige-500` (light) / `from-brand-900 to-brand-700` (dark); dots pattern radial-gradient; 3 blobs decorativos; logo "C" com `bg-white/20 backdrop-blur-sm`; tagline "Gestão inteligente de buffets infantis"; 3 feature pills `Check + texto` com stagger `animate-fade-up` 0–380ms
  - `LoginForm` (full-width mobile, metade desktop): logo mobile-only + heading + form card
  - `ErrorAlert`: 5 tipos (`credentials/blocked/rate_limit/server/unconfirmed`) com ícones `AlertCircle/Clock/WifiOff`; botão "Tentar novamente" só no tipo `server`
  - `classifyError(error: string): LoginError` — mapeia strings Supabase para tipos amigáveis em PT-BR
  - Input email com `<Mail>` icon à esquerda; input senha com `<Lock>` + toggle `<Eye>/<EyeOff>` à direita
  - Checkbox "Lembrar-me" + link "Esqueci minha senha → /recuperar-senha"
  - `autocomplete="email"` + `autocomplete="current-password"` para gestor de senhas
  - Submit state machine `'idle' | 'loading' | 'success'`: idle→`Entrar`, loading→`Loader2 spin + Entrando…`, success→`CheckCircle2 verde + Entrando…`
  - `triggerShake()`: remove class → `void el.offsetHeight` (reflow) → add class → remove após 600ms
  - Redirect: 700ms delay após success para mostrar feedback visual antes de navegar
  - `callbackError` query param → exibe erro de link expirado automaticamente
  - `aria-invalid`, `aria-describedby`, `role="alert"`, `aria-live="assertive"` — acessibilidade completa
  - `animate-fade-up` com delays progressivos no form
- **`src/app/globals.css`**: `@keyframes login-shake` (7-step translateX damping) + `.animate-login-shake` + `.pb-safe` (env safe-area-inset-bottom)
- **`src/app/(public)/layout.tsx`**: simplificado para `<>{children}</>` — cada página pública controla seu próprio layout e fundo
- **`src/app/(public)/recuperar-senha/page.tsx`**: `<main>` atualizado para `min-h-svh flex items-center justify-center bg-background` (compatível com layout transparente)

### Prompt 11 — Onboarding / First-Use Experience
- **`src/stores/onboarding-store.ts`** (novo): Zustand store — `welcomeOpen`, `tourActive`, `tourStep`; `setWelcomeOpen`, `startTour`, `nextTourStep`, `skipTour`; `TOUR_STEPS` array com 4 passos (sidebar/unit-switcher/calendar/notifications)
- **`src/hooks/use-onboarding.ts`** (novo):
  - `useOnboarding()`: verifica `profile.preferences.onboarding_completed` (DB) + `cachola-onboarding-done` (localStorage). Se falso → `setWelcomeOpen(true)` após 800ms delay
  - `useCompleteOnboarding()`: mutation que escreve no DB + localStorage imediatamente (sem race condition)
  - `useSetupChecklist()`: useQuery com 4 checks paralelos (ploomes_config pipeline_id, checklist_templates, equipment status, users count)
- **`src/components/features/onboarding/welcome-modal.tsx`** (novo): `createPortal(document.body)` — 3 slides carousel (Calendar/CheckSquare/Wrench), greeting personalizado "Olá, [nome]!", dots de progresso clicáveis, "Pular ×" / "← Voltar" / "Próximo →" / "Começar →"; ao clicar Começar → marca onboarding completo + inicia tour após 400ms
- **`src/components/features/onboarding/guided-tour.tsx`** (novo): `createPortal(document.body)` — spotlight via `box-shadow: 0 0 0 9999px rgba(0,0,0,0.65)` posicionado sobre `[data-tour="step-id"]`; tooltip card com `Arrow` (triângulo CSS), progresso dots, "Pular tour" / "Próximo →" / "Concluir"; posicionamento automático (above/below/right/left) baseado em `getBoundingClientRect()`; skip automático se elemento off-screen (sidebar fechada no mobile)
- **`src/components/features/onboarding/setup-checklist-card.tsx`** (novo): visível para super_admin/diretor/gerente; borda `border-primary/20 bg-brand-50`; progresso bar; 4 items com CheckCircle2/Circle + link para cada configuração; dismissível via localStorage; oculto quando todos completos
- **`src/types/database.types.ts`**: `User.preferences.onboarding_completed?: boolean` adicionado
- **`src/components/layout/app-layout.tsx`**: `OnboardingLayer` (renders WelcomeModal + GuidedTour + executa useOnboarding) adicionado ao início do JSX
- **`src/components/layout/sidebar.tsx`**: `data-tour="sidebar"` no `<aside>`
- **`src/components/layout/navbar.tsx`**: `<span data-tour="unit-switcher">` em volta de `<UnitSwitcher>`; `<span data-tour="notifications">` em volta de `<NotificationBell>`
- **`src/app/(auth)/dashboard/page.tsx`**: `<SetupChecklistCard />` após PageHeader; `<div data-tour="calendar">` em volta de `<CalendarView>`
- **`src/app/(auth)/checklists/page.tsx`**: empty state sem filtros → "Crie seu primeiro checklist" + "Criar modelo de checklist"
- **`src/app/(auth)/manutencao/page.tsx`**: empty state → "Registre sua primeira ordem de manutenção" + botão primary
- **`src/app/(auth)/eventos/page.tsx`**: empty state Ploomes → "Aguardando sincronização com Ploomes" + "Configurar Ploomes"

### Prompt 12 — Command Palette (Ctrl+K / ⌘K)
- **`src/stores/command-palette-store.ts`** (novo): Zustand store com `persist` (localStorage `cachola-cmd-palette`) — `isOpen`, `recentItems[]`; `open/close/toggle`; `addRecent` (dedup por id, max 5, mais recente primeiro)
- **`src/hooks/use-command-palette-search.ts`** (novo): `useCommandPaletteIndex(enabled)` — TanStack Query; 4 queries paralelas (events/checklists/maintenance_orders/equipment), filtradas por `activeUnitId`; `staleTime: 2min`; `gcTime: 5min`; ativado apenas quando palette está aberta
- **`src/components/features/command-palette/command-palette.tsx`** (novo):
  - `createPortal(document.body)` com overlay `bg-black/60 backdrop-blur-[6px]`
  - Mobile: bottom sheet `items-end rounded-t-2xl max-h-[85svh]`; Desktop: centered `sm:pt-[12vh] sm:rounded-2xl sm:max-w-[560px] sm:max-h-[68vh]`
  - `useDebounce(query, 200)` para debounce de busca; fuzzy search word-split
  - 6 grupos: Recentes, Páginas (9), Ações rápidas (5), Eventos, Checklists, Manutenções, Equipamentos
  - `flatResults` + `flatIdx` counter para mapeamento de `selectedIndex` cross-group
  - Keyboard: ↑↓ navegar, Enter selecionar, Esc fechar; Ctrl+K / ⌘K listener global
  - `handleSelect`: `addRecent` → `router.push` → `close()`; `ResultItem` com `scrollIntoView`
  - Loading skeleton, empty state "Nenhum resultado", footer com hints kbd
- **`src/components/layout/navbar.tsx`**: botão `<Search>` antes de `<UnitSwitcher>`; `openPalette` do store
- **`src/components/layout/app-layout.tsx`**: `<CommandPalette />` ao lado de `<OnboardingLayer />`
- **Fix**: `IndexChecklist.name → IndexChecklist.title` (campo real da tabela `checklists` é `title`)

### Prompt 13 — Dashboard KPIs com Sparklines e Tendências
- **`src/hooks/use-dashboard.ts`** — novos tipos `SparkPoint`, `KpiMetric`, `DashboardKpis` + hook `useDashboardKpis()`:
  - 4 queries paralelas: events (6m), maintenance_orders (all), checklists (all), next event
  - `buildMonths(now, 6)` → array `['yyyy-MM' × 6]` oldest first
  - `trendPct(curr, prev)` → % change rounded, `null` quando prev=0
  - Events: agrupados por mês — `count`, `confirmed`, `guests` (cap 9999 para dados corrompidos do Ploomes)
  - Conversion: `Math.round((confirmed / count) * 100)` por mês
  - Guests: soma de `guest_count` válidos (0 < gc ≤ 9999)
  - Maintenance: `value` = currently open (status != completed/cancelled); spark = created/month
  - Checklists: `value` = currently pending; spark = created/month
  - `nextEventDays`: `differenceInCalendarDays(parseISO(date + 'T12:00:00'), now)` — mínimo 0
  - `staleTime: 2min`; imports adicionados: `subMonths`, `differenceInCalendarDays`, `parseISO`
- **`src/components/features/dashboard/kpi-card.tsx`** (novo):
  - `TrendBadge`: pill verde (TrendingUp ↑), vermelho (TrendingDown ↓), cinza (Minus —)
  - `KpiCardSkeleton`: header + value + sparkline skeleton
  - `KpiCard`: Link clicável (`card-interactive` + `hover:border-primary/30`)
  - Layout: `icon + label` esquerda, `TrendBadge` direita; `text-3xl value`; sparkline 80px
  - Recharts `AreaChart` sem eixos, sem grid, sem tooltip — `type="monotone"` + `strokeWidth={2}`
  - `linearGradient` com `stopOpacity 0.25→0.02` para fill suave
  - `IntersectionObserver` → `isInView` → `isAnimationActive` — sparkline desenha ao entrar viewport
  - `animationDuration={800}` + `animationEasing="ease-out"`
  - `gradId = kpi-grad-${label}` único por card para evitar conflitos SVG
- **`src/app/(auth)/dashboard/page.tsx`** — substituição completa dos 2 grids de `StatsCard`:
  - Grid único `grid-cols-2 md:grid-cols-3 gap-3` com 6 `KpiCard`s
  - Cores de stroke hex (Recharts): `BRAND_GREEN[500]`, `#16A34A`, `#D97706`, `#DC2626`, `#EA580C`
  - Manutenção: `icon-red` + `STROKE.red` quando `value > 5`, senão `icon-orange` + `STROKE.orange`
  - "Próximo Evento": valor formatado "Hoje!" / "1 dia" / "N dias" / "—"; reusa events.spark
  - Imports: `useDashboardKpis`, `KpiCard`, `BRAND_GREEN`; removidos `StatsCard`, `useDashboardStats`, `useDashboardMaintenanceStats`
  - Stagger `animate-fade-up` com delays 0–250ms (50ms cada)

### Prompt 14 — Centro de Notificações Slide-Over
- **`src/app/globals.css`** — 3 novos `@keyframes`:
  - `bell-shake`: rotação amortecida 12°→-10°→… em 0.6s — `transform-origin: top center`
  - `slide-in-right`: `translateX(100%)→translateX(0)` para entrada do painel
  - `notification-in`: `opacity:0 translateY(-10px)→opacity:1 translateY(0)` para novos itens
  - Classes: `.animate-bell-shake`, `.animate-notification-in`
- **`src/hooks/use-notifications.ts`** — melhorias:
  - Limite aumentado `20 → 50`
  - Adicionado `deleteNotification` mutation (DELETE por id)
  - Exportados `isError`, `refetch`, `deleteNotification`
- **`src/components/layout/notification-bell.tsx`** — reescrita completa:
  - `createPortal(document.body)` slide-over — `translate-x-full → translate-x-0` (300ms transition)
  - Mobile: painel fullscreen; Desktop: 380px fixo à direita (`fixed inset-y-0 right-0 w-[380px]`)
  - Overlay `bg-black/40 backdrop-blur-sm` com `onClick` para fechar
  - **Filter chips** (`FilterChip`): Todas | Eventos | Manutenção | Checklists | Sistema — com badge de não-lidos por categoria
  - **`NotificationItem`**:
    - Ícone 40px `rounded-full` com cor semântica por tipo (Calendar=brand, Wrench=orange, etc.)
    - Dot azul absoluto (`left-1.5`) para não-lidas
    - Desktop hover: ações "Lida" + "Arquivar" aparecem (`opacity-0 → opacity-100 group-hover`)
    - Mobile swipe: `onTouchStart/End`, delta < -55px → `swiped=true` → `-translate-x-[120px]` revela botões absolutos
  - **Archive com undo** (padrão sonner): `archivedIds` Set + `archiveTimeouts` Map + 4s `setTimeout` antes do DELETE real; toast "Arquivada" com botão "Desfazer" cancela o timeout
  - **Bell shake + áudio**: `prevUnreadRef` compara contagem anterior — ao aumentar, adiciona `.animate-bell-shake` (remove após 700ms) + beep via Web Audio API (2 tons: 880Hz→440Hz)
  - **Auto-toast**: quando painel fechado e nova notificação chega (Realtime) → `toast(title, { description })`
  - **`animate-notification-in`**: itens novos detectados comparando `prevIdsRef` vs IDs atuais; `isInitialLoad` ref evita animação no mount
  - **Header**: título "Notificações" + contagem não-lidas + botão "Marcar todas lidas" (só quando há não-lidas) + botão fechar `×`
  - **Footer**: botão "Ver todas" (link `/admin/logs`) + "Limpar tudo" quando há notificações arquivadas
  - **Estados**: skeleton (5 items) no loading; empty state por filtro ativo; error state com retry

### Prompt 15 — Detalhe do Evento: Timeline Visual + Redesign
- **`src/components/features/events/event-timeline.tsx`** (novo):
  - `deriveTimeline(event, checklists)` — deriva marcos a partir de dados disponíveis:
    - "Evento criado / importado do Ploomes" (`event.created_at`)
    - "Checklist X atribuído" (por `checklist.created_at`, sorted ASC)
    - "Checklist X concluído" (quando `status==='completed'`, usa `updated_at`)
    - "Data do evento" / "Evento hoje!" / "Evento realizado" (`event.date + start_time`)
    - "Desmontagem / Pós-evento" (apenas após `eventStart` passar, usa `end_time`)
  - `TimelineDot`: círculo 32px, cores semânticas — `bg-green-500` (done), `bg-primary animate-pulse` (current), `bg-muted` (future); sombra ring `color-mix` no current
  - Linha vertical conectora (`absolute left-4 top-8 w-0.5`) — verde quando `done`, `bg-border` quando future
  - Itens com link: `<Link href={item.link}>` envolve o item (checklists linkam para `/checklists/[id]`)
  - `ExternalLink` mini inline no título quando o item tem link
  - Avatar responsável (mini, `size="sm"`) + nome (primeiro nome, hidden no mobile)
  - `isInitialMount` detectado por `status===current` — destaque visual com `shadow-[0_0_0_4px_…]`
- **`src/hooks/use-maintenance.ts`** — novo `useEventMaintenances(eventId)`:
  - Filtra `maintenance_orders` por `event_id`; usa `MAINTENANCE_LIST_SELECT`; `staleTime: 30s`
- **`src/app/(auth)/eventos/[id]/page.tsx`** — reescrita completa:
  - **Top nav**: `<ArrowLeft>` + action buttons à direita (status dropdown + Editar + Excluir)
  - **Hero Header** card: título grande + `client_name` subtítulo + badge strip (status | data | horário | salão | convidados) + botão "Ploomes" ghost com `<ExternalLink>` (condicionado a `ploomes_url`)
  - **Info Grid** 2 colunas: `InfoCard` "Dados do Cliente" + "Dados da Festa"; `InfoRow` helper (ícone + texto)
  - **Ploomes** seção: `<PloomesEventDetails>` mantido (condicionado a `ploomes_deal_id`)
  - **Linha do Tempo** seção: `<EventTimeline event checklists />`
  - **Checklists** seção: `<SectionHeader count action>` + `<ChecklistCard>` list + empty state
  - **Manutenções Relacionadas** seção: apenas se `maintenances.length > 0`; cards com `<MaintenanceStatusBadge>` + `<MaintenancePriorityBadge>` + link para `/manutencao/[id]`
  - **Equipe** seção: grid `sm:grid-cols-2` com avatares
  - `InfoCard` helper: `filled` prop → `bg-brand-50 border-primary/20` (dark mode incluso)
  - `SectionHeader` helper: título + count badge + action slot

### Prompt 16 — Keyboard Shortcuts + PWA Install Experience

#### Tarefa A — Keyboard Shortcuts
- **`src/stores/shortcuts-store.ts`** (novo): Zustand store — `isOpen`, `open/close/toggle` para o cheat sheet modal
- **`src/hooks/use-keyboard-shortcuts.ts`** (novo):
  - Escuta `keydown` global; skip quando `isEditable()` (INPUT/TEXTAREA/SELECT/contenteditable) ou Command Palette aberta
  - `Ctrl+/` / `⌘/` e `?` → `toggleShortcuts()`
  - `N` → click programático em `[aria-label="Notificações"]` (sem extrair para store)
  - `G` → inicia sequência; `seqRef.current = 'g'` + timeout 1s
  - `G + D/C/M/E/S` → `router.push` para dashboard/checklists/manutencao/equipamentos/configuracoes
- **`src/components/features/keyboard-shortcuts/shortcuts-modal.tsx`** (novo):
  - `createPortal(document.body)` com overlay `bg-black/60 backdrop-blur-[6px]`
  - Detecta Mac via `navigator.platform` → mostra `⌘` vs `Ctrl`
  - Grid 2 colunas `sm:grid-cols-2`; grupos "Navegação" e "Painéis"
  - `<Kbd>` component: `bg-muted border border-border rounded text-[0.65rem] font-mono shadow-[0_1px_0_0_…]`
  - Fechar com Esc ou clique no overlay
  - `animate-scale-in` na entrada

#### Tarefa B — PWA Install Experience
- **`src/hooks/use-pwa-install.ts`** (novo):
  - Captura `beforeinstallprompt`, previne o default nativo
  - Detecta standalone (`(display-mode: standalone)`) e não mostra se já instalado
  - Timing: visitas (localStorage `cachola-pwa-visits`) e tempo desde primeira visita (`cachola-pwa-first-visit`)
  - Banner aparece após ≥3 visitas OU ≥2min da primeira visita
  - Dismiss salva timestamp em `cachola-pwa-dismissed` (valida por 30 dias)
  - Expõe `showBanner`, `canInstall`, `install()`, `dismiss()`
- **`src/components/features/pwa/install-banner.tsx`** (novo):
  - Fixed bottom, `z-50`, `sm:w-80` no canto direito
  - Logo "C" 40×40 + textos + botão "Instalar" + `<X>` dismiss
  - `animate-scale-in` na entrada
- **`src/components/features/pwa/splash-screen.tsx`** (novo):
  - Aparece APENAS quando `display-mode: standalone` (PWA instalado)
  - `z-[9999]`, gradiente inline `#7C8D78 → #E3DAD1`
  - Logo "C" 80×80 `rounded-[1.5rem]` + nome + spinner `animate-spin`
  - `animate-scale-in` no conteúdo; fade-out via `opacity-0 transition-opacity` após 1.2s; remove-from-DOM após 1.6s
- **`public/manifest.json`** — atualizado: `background_color` `#FAFAF8` → `#E3DAD1`, `orientation` `portrait-primary` → `portrait`
- **`src/components/layout/app-layout.tsx`** — adicionado:
  - `<KeyboardLayer />` (chama `useKeyboardShortcuts()`, retorna `null`)
  - `<ShortcutsModal />`
  - `<SplashScreen />`
  - `<InstallBanner />`

### Prompt 17 — Personalização Visual por Unidade + PDF Templates (2026-03-28)

#### Tarefa A — Personalização Visual por Unidade
- **`src/types/database.types.ts`**: `UnitSettingsData` ganhou campo `brand?: { accent_color?, logo_url?, display_name? }` — sem nova migration (já é JSONB)
- **`src/hooks/use-unit-settings.ts`**: hook `useUnitBrand()` exportado — retorna `{ accentColor, logoPath, displayName }` com fallback para `#7C8D78`
- **`src/components/layout/unit-accent-wrapper.tsx`** (novo): aplica `style={{ '--primary': accentColor }}` como CSS custom property override; todas as utilities Tailwind `bg-primary / text-primary / border-primary` herdam via cascade; `transition-colors duration-300` na troca de unidade
- **`src/components/features/settings/brand-identity-tab.tsx`** (novo):
  - Seção "Logo da Unidade": upload (max 2MB, preview imediato, compressão para max 400px via `compressImage`), armazenado em `user-avatars/unit-logos/{unitId}/logo.jpg`, fallback letra inicial
  - Seção "Nome de Exibição": input text livre (max 30 chars)
  - Seção "Cor de Destaque": 8 presets (Verde Sálvia/Floresta/Azul Ardósia/Marinho/Terracota/Bordô/Âmbar/Cinza) + color picker `<input type="color">` + input hex manual; preview inline do botão com a cor selecionada
  - `hasChanges` guard — botão "Salvar" habilitado só quando há mudança vs. estado salvo
  - Salva via `useUpdateUnitSettings()` mergeando campo `brand` nos settings existentes
- **`src/components/layout/sidebar.tsx`**: `useSidebarLogo()` helper — lê `useUnitBrand()`, gera public URL via `getPublicUrl()`; logo `<Image>` quando disponível, fallback letra inicial de `displayName`; texto da sidebar usa `displayName || APP_NAME`
- **`src/app/(auth)/configuracoes/page.tsx`**: aba "Identidade Visual" adicionada com `<BrandIdentityTab />`
- **`src/components/layout/app-layout.tsx`**: toda a árvore envolvida em `<UnitAccentWrapper>` — accentColor ativo propagado para toda a UI

#### Tarefa B — PDF Templates Profissionais
- **`src/lib/utils/export.ts`** — 3 novas funções programáticas (sem html2canvas):
  - `hexToRgb(hex)`: helper interno converte hex → RGB tuple
  - `addPdfHeader(pdf, title, unitName, period, accentHex, pageW, margin)`: cabeçalho com barra colorida accent + "Cachola OS" + unidade + data + título; retorna Y após header
  - `addPdfFooter(pdf, pageW, margin, pageH)`: rodapé "Gerado por Cachola OS" + "Página N de M"
  - **`exportReportPDF(config: ReportPdfConfig)`**: PDF A4 landscape para relatórios; colunas configuráveis com `align` e `width`; header accent colorido; linhas alternadas (#F8F8F8); separador horizontal; paginação automática; tipos `ReportPdfColumn`, `ReportPdfConfig` exportados
  - **`exportChecklistPDF(config: ChecklistPdfConfig)`**: PDF A4 portrait para checklist concluído; box de dados do evento (cliente/salão/data); sumário (concluídos/pendentes/N/A/responsável); itens com símbolo ✓/○/— colorido (verde/cinza), notas indentadas "↳ nota", done_by + done_at à direita; separador por item; linha de assinatura + timestamp; paginação automática; tipo `ChecklistPdfItem`, `ChecklistPdfConfig` exportados

### Padrões Estabelecidos
| Item | Padrão |
|------|--------|
| Ícones em cards | `.icon-{cor}` — NUNCA `bg-*-50` |
| Badges/pills | `.badge-{cor} border` — NUNCA hex direto |
| Hover em cards | `.card-interactive` — NUNCA usar `hover:shadow-md hover:-translate-y-*` manual; classe tem cursor, lift, border, active e reduced-motion |
| Select "Todos" | `value={null}` + `<SelectItem value="all">` (base-ui renderiza placeholder) |
| Botão com link | `<Link className={cn(buttonVariants(...))}>` (base-ui Button não suporta `asChild`) |
| TooltipTrigger | Usar `render` prop para elemento custom; sem `asChild` |
| Page transition | `key={pathname}` no wrapper dentro de `<main>` + `animate-page-enter` |
| Skeleton | `<Skeleton>` usa `.skeleton-shimmer` — adapta a dark mode via `color-mix` |

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
| `syncDeals` aceita SupabaseClient como parâmetro | Evita dependência direta de `cookies()` (next/headers) no sync.ts. A API route cria o client e passa para a função. Reutilizável em cron, manual e webhook. |
| Ploomes IDs armazenados como TEXT | IDs do Ploomes são inteiros grandes. TEXT é mais seguro que bigint no TypeScript e evita problemas com IDs > MAX_INT32. Coluna `ploomes_deal_id TEXT` já existia desde migration 001. |
| `ploomes_deal_id` UNIQUE permite múltiplos NULLs | PostgreSQL permite múltiplas linhas com NULL em coluna UNIQUE. Eventos manuais (sem deal_id) coexistem sem conflito. Upsert usa `ON CONFLICT (ploomes_deal_id)`. |
| Auto-criação de venues no sync | Se `venueName` do Ploomes não existe na tabela `venues` da unidade, a venue é criada automaticamente e o contador `venues_created` é incrementado no log de sync. |
| `usePloomesIntegrationActive` baseado em histórico de sync | Considera integração ativa se houver pelo menos 1 sync com status 'success'. Não depende de config flag — detecta organicamente pelo histórico de uso. |
| Cron Ploomes separado de check-alerts | Sync do Ploomes faz chamadas externas que podem levar 10-30s. Rota dedicada `/api/cron/ploomes-sync` evita timeout que afetaria as notificações internas da `/api/cron/check-alerts`. |
| `ploomes_config` UNIQUE(unit_id) — 1 row por unidade | Config de pipeline/stage/status é por unidade. UNIQUE constraint garante upsert limpo. Fallback para env vars mantém retrocompatibilidade com deploys que ainda não rodaram migration 015. |
| Webhook validado por `X-Ploomes-Validation-Key` (não `x-webhook-secret`) | Header padrão documentado pela Ploomes. O campo é renomeado de `PLOOMES_WEBHOOK_SECRET` para `PLOOMES_VALIDATION_KEY` para alinhar com a nomenclatura da API. |
| Registro de webhook idempotente | `/api/ploomes/webhook-register` verifica se já existe webhook para a URL antes de criar. Evita duplicatas no Ploomes ao chamar o endpoint mais de uma vez. |
| Página de mapeamento lê do banco (não hardcoded) | `ploomes/mapeamento/page.tsx` usa `usePloomesConfig(unitId)` → `/api/ploomes/config`. Quando o admin atualizar os mapeamentos no banco, a tela reflete automaticamente sem deploy. |
| Notificação de falhas após 3 erros consecutivos | Cron verifica os últimos 3 logs de sync. Se todos falharam e não houve notificação similar nas últimas 2h, cria notificação interna para todos os super_admins via `create_notification` RPC. |
