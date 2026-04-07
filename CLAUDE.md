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
| `/checklists/recorrencias` | `(auth)/checklists/recorrencias/page.tsx` | ✅ funcional (P7) |
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
| `/admin/unidades/setup` | `(auth)/admin/unidades/setup/page.tsx` | ✅ funcional (Wizard Setup) |
| `/admin/unidades/[id]/setup` | `(auth)/admin/unidades/[id]/setup/page.tsx` | ✅ funcional (Wizard Setup) |
| `/equipamentos` | `(auth)/equipamentos/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/novo` | `(auth)/equipamentos/novo/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/[id]` | `(auth)/equipamentos/[id]/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/equipamentos/[id]/editar` | `(auth)/equipamentos/[id]/editar/page.tsx` | ✅ funcional (Fase 3 Bloco 2) |
| `/relatorios` | `(auth)/relatorios/page.tsx` | ✅ funcional (Fase 3 Bloco 1) |
| `/admin/logs` | `(auth)/admin/logs/page.tsx` | ✅ funcional (Fase 3 Bloco 4) |
| `/configuracoes/integracoes/ploomes` | `(auth)/configuracoes/integracoes/ploomes/page.tsx` | ✅ funcional (Fase 4) |
| `/configuracoes/integracoes/ploomes/mapeamento` | `(auth)/configuracoes/integracoes/ploomes/mapeamento/page.tsx` | ✅ funcional (Fase 4) |
| `/configuracoes/regras` | `(auth)/configuracoes/regras/page.tsx` | ✅ funcional |
| `/checklists/minhas-tarefas` | `(auth)/checklists/minhas-tarefas/page.tsx` | ✅ funcional (P9) |
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

### Checklists — Schema Premium (Migration 018 + 018b — 2026-03-29)
Branch: `feat/checklist-premium-schema`

#### Tipos de checklist (`checklists.type`)
- `event`: vinculado a um evento/festa (comportamento original, default)
- `standalone`: checklist avulso sem evento vinculado
- `recurring`: gerado automaticamente por regra de recorrência

#### Prioridades (`Priority` type — compartilhado entre checklists e itens)
- `low`: baixa (verde)
- `medium`: média (amarelo) — default
- `high`: alta (laranja)
- `urgent`: urgente (vermelho pulsante)

#### Novas colunas em `checklists` (migration 018)
- `type`: event | standalone | recurring (default: 'event')
- `priority`: low | medium | high | urgent (default: 'medium')
- `description`: texto livre
- `created_by`: UUID → users
- `completed_at`: timestamp de finalização
- `completed_by`: UUID → users
- `duplicated_from`: UUID → checklists (auto-referência, Prompt 8)
- `recurrence_id`: UUID → checklist_recurrence

#### Novas colunas em `checklist_items` (migrations 018 + 018b)
- `assigned_to`: UUID → users (responsável individual do item)
- `priority`: low | medium | high | urgent (default: 'medium')
- `due_at`: prazo individual do item (≠ `checklists.due_date` que é prazo geral)
- `estimated_minutes`: tempo estimado em minutos
- `actual_minutes`: tempo real gasto (preenchido ao concluir)

#### Novas colunas em `checklist_templates` (migration 018)
- `description`: descrição do template
- `estimated_duration_minutes`: duração estimada total
- `default_priority`: prioridade padrão para checklists gerados
- `recurrence_rule`: JSONB com shape `ChecklistRecurrenceRule`

#### Novas colunas em `template_items` (migration 018)
- `default_priority`: prioridade padrão do item
- `default_estimated_minutes`: tempo estimado padrão
- `default_assigned_to`: JSONB `{ type: 'role'|'user', value: '<role>|<uuid>' }`
- `notes_template`: instrução padrão exibida como placeholder nas notas
- `requires_photo`: item obriga registro de foto ao concluir
- `is_required`: item é obrigatório para finalizar o checklist (default: true)

#### Nova tabela: `checklist_recurrence` (migration 018b)
Regras de recorrência com colunas explícitas (melhor para queries e índices):
- `template_id` FK, `unit_id` FK
- `frequency`: daily | weekly | biweekly | monthly
- `day_of_week`: int[] (0=dom…6=sáb, para weekly/biweekly)
- `day_of_month`: int 1-31 (para monthly)
- `time_of_day`: TIME default '08:00:00'
- `assigned_to`: UUID → users (responsável padrão dos checklists gerados)
- `is_active`, `last_generated_at`, `next_generation_at`
- `title_prefix`: prefixo do título gerado (ex: "Limpeza Semanal — ")
- RLS: view via `check_permission + get_user_unit_ids`, manage via `create`

#### Nova tabela: `checklist_item_comments` (migration 018b)
- `item_id` FK → checklist_items, `user_id` FK → users, `unit_id` FK → units
- `content TEXT NOT NULL`, `photo_url TEXT` (bucket `checklist-comment-photos`)
- RLS: view por unidade, create pelo próprio user, own (edit/delete próprio), manage (delete admin)
- Realtime habilitado via `ALTER PUBLICATION supabase_realtime ADD TABLE`

#### Storage bucket novo
- `checklist-comment-photos`: fotos em comentários (10 MB, JPEG/PNG/WebP/HEIC, privado)

#### Notification types novos (src/lib/notifications.ts)
- `checklist_item_assigned`: item atribuído a responsável
- `checklist_item_commented`: novo comentário em item do qual sou responsável
- `checklist_item_overdue`: item passou do prazo
- `checklist_recurring_generated`: checklist recorrente gerado automaticamente
- `checklist_duplicated`: checklist duplicado de evento anterior

#### TypeScript types novos (src/types/database.types.ts)
- `ChecklistType`: 'event' | 'standalone' | 'recurring'
- `Priority`: 'low' | 'medium' | 'high' | 'urgent'
- `ChecklistRecurrence`: type completo com joins opcionais
- `ChecklistItemComment`: type completo com join de user
- `ChecklistRecurrenceRule`: shape do JSONB em checklist_templates
- `DefaultAssignedTo`: shape do JSONB em template_items
- `ChecklistWithItems`, `ChecklistForList`, `TemplateWithItems`: atualizados
- `PRIORITY_LABELS`, `PRIORITY_COLORS`, `CHECKLIST_TYPE_LABELS`, `CHECKLIST_STATUS_LABELS`: constantes pt-BR exportadas
- `checklist_items.is_required`: adicionado (copiado de template_items na criação)
- `checklist_items.created_at`: adicionado ao type

### Checklists — Hooks Premium (Prompt 2 — 2026-03-29)

#### Select constants exportadas de use-checklists.ts
- `CHECKLIST_LIST_SELECT`: joins com assigned_user, created_by_user, completed_by_user, event, template, checklist_items(id, status, priority)
- `CHECKLIST_DETAIL_SELECT`: todos os joins + checklist_items completos + done_by_user + recurrence

#### Hooks refatorados em use-checklists.ts
- `useChecklists(filters)`: `ChecklistFilters` expandido com `type`, `priority`, `overdue`, `search`; ordenação urgência-first; RETRY não retenta 401/403; enabled com `isSessionReady`
- `useChecklist(id)`: enabled `!!id && isSessionReady`; usa `CHECKLIST_DETAIL_SELECT`
- `useChecklistItems(checklistId)`: novo — items separados para invalidação granular; join assigned_user + done_by_user
- `useEventChecklists(eventId)`: enabled `!!eventId && isSessionReady`
- `useCreateChecklist`: aceita `type`, `description`, `priority`, `createdBy`; copia `is_required` e `priority` dos template_items
- `useUpdateChecklist`: novo — patch parcial de todos os campos premium
- `useCompleteChecklist`: novo — valida items `is_required` antes de concluir; seta `completed_at/by`
- `useDuplicateChecklist`: novo — cópia limpa com `duplicated_from`; preserva priority/estimated_minutes/assigned_to
- `useCreateTemplate` / `useUpdateTemplate`: aceita campos premium (`description`, `defaultPriority`, `estimatedDurationMinutes`); items com `notesTemplate`, `requiresPhoto`, `isRequired`

#### Hooks novos

**use-checklist-comments.ts**
- `useChecklistItemComments(itemId)`: enabled `!!itemId && isSessionReady`; join user
- `useAddComment()`: upload para `checklist-comment-photos` (path privado); notifyChecklistItemCommented fire-and-forget
- `useDeleteComment()`: valida `user_id === userId`; remove storage best-effort

**use-checklist-recurrences.ts**
- `useChecklistRecurrences(onlyActive)`: join template + assigned_user
- `useCreateRecurrence()`: calcula `next_generation_at` via `calcNextGenerationAt()`
- `useUpdateRecurrence()`: suporta `isActive` toggle (recalcula next_generation_at ao retomar)
- `useDeleteRecurrence()`

**use-my-tasks.ts**
- `useMyTasks(userId, filters)`: cross-checklist, status='pending', join checklist+event; ordenação urgência→due_at→created_at; filtros `priority`, `overdue`, `eventId`

**use-checklist-stats.ts**
- `useChecklistStats()`: staleTime 5min; 4 queries paralelas (all, overdue, today, week); byPriority + byCategory via template join; avgCompletionHours calculado client-side

### Checklists — P4 Integration (2026-03-29)
- `src/app/(auth)/checklists/page.tsx`: botão "+ Novo" → abre `CreateChecklistModal`; `onCreated` redireciona para `/checklists/[id]`
- `src/app/(auth)/eventos/[id]/page.tsx`: `AddChecklistModal` substituído por `CreateChecklistModal` com `defaultEventId` + `defaultEventTitle`

### Checklists — P5 Premium Detail Page (Prompt 5 — 2026-03-29)

#### Componentes novos em `src/app/(auth)/checklists/[id]/components/`

**`item-assign-popover.tsx`**
- Dialog com busca de usuário, destaque do responsável atual (checkmark), opção "Remover atribuição"
- Exporta `AssignedUser = Pick<User, 'id' | 'name' | 'avatar_url'>`

**`item-deadline-popover.tsx`**
- Dialog com 4 presets rápidos (Hoje / Amanhã / Em 3 dias / 1 semana)
- Input de data customizado com mínimo = hoje
- Opção "Remover prazo" quando há prazo definido

**`checklist-item-row.tsx`** (nova versão só para a página de detalhe)
- `RichChecklistItem` type: `ChecklistItem & { assigned_user?, done_by_user? }`
- 3-state checkbox com `animate-check-draw` + haptic vibrate(10)
- Priority badge (exceto medium), `is_required` asterisco vermelho
- Assigned user + due date + estimated_minutes como metadata inline (apenas para pendentes)
- Atribuição: `ItemAssignPopover` com update otimista local + `useUpdateChecklistItem`
- Prazo: `ItemDeadlinePopover` com update otimista local + `useUpdateChecklistItem`
- Notes: debounce 1s auto-save (ref para evitar stale closure)
- Câmera via `capture="environment"` (desabilitada offline via `onPhotoChange=undefined`)
- Done by: exibe nome do responsável quando item concluído
- Desktop: botões User + Calendar inline; Mobile: ⋮ DropdownMenu manual (overlay + card)
- Border-left vermelho quando overdue, fundo vermelho sutil quando `priority=urgent`

**`checklist-detail-header.tsx`**
- `ProgressRing` SVG (56px, label=true): stroke animado, classe `stroke-primary`
- Quando concluído: banner verde com ProgressRing + Concluído + botão Duplicar
- Quando em andamento: card com type/priority badges, título, event link, assigned user, estimated remaining
- Collapsible description via `ChevronDown/Up`
- `⋮ DropdownMenu`: Duplicar → `useDuplicateChecklist` + redirect; Exportar PDF (placeholder); Excluir → ConfirmDialog → `useDeleteChecklist` + redirect
- Progress bar full-width no fundo do card

#### Página `src/app/(auth)/checklists/[id]/page.tsx` — Redesign completo
- **Header**: `ChecklistDetailHeader` (substituiu sticky sub-header inline)
- **Item Filter Bar**: local state `ItemFilter` — all/pending/done/na/overdue/my; pills com contagem; scroll horizontal
- **Item List**: novo `ChecklistItemRow` com `checklistId` + `currentUserId`
- **Footer sticky**: `FooterRing` (32px SVG ring) + contagem + botão "Concluir"
  - `paddingBottom: max(16px, env(safe-area-inset-bottom))` para safe area
- **Complete flow**: usa `useCompleteChecklist` (valida `is_required` no hook); ConfirmDialog mostra aviso se há itens obrigatórios pendentes
- Offline support mantido (banners offline/syncing, foto/finalizar desabilitados)

### Checklists — Comentários por Item (Prompt 6 — 2026-03-29)

**Componente:** `src/app/(auth)/checklists/[id]/components/item-comments-sheet.tsx`
- Desktop: slide-over direita (400px, overlay) — Mobile: bottom-sheet (max-h 85svh, drag handle, rounded-t-2xl)
- Usa `createPortal(document.body)` para posicionamento correto sobre tudo
- Thread cronológica com `useChecklistItemComments(itemId)` — ASC, staleTime 30s
- Foto nos comentários: `useSignedUrls('checklist-comment-photos', paths)` para signed URLs
- Upload: `compressImage(file, 1200, 0.8)` antes de passar para `useAddComment({ itemId, content, photoFile, userId })`
- Exclusão inline: clique uma vez → "Confirmar exclusão?" por 3s → segundo clique confirma (apenas autor via `user_id === currentUserId` + RLS)
- `Lightbox`: overlay fullscreen com `createPortal`, fecha com Esc ou clique no overlay
- Auto-scroll para fundo via `listRef.current.scrollTop = scrollHeight`
- Realtime: `supabase.channel('comments-{itemId}')` com `postgres_changes INSERT` → invalida query + scroll
- Textarea auto-resize: `style.height = 'auto'` depois `style.height = scrollHeight` (max 96px / 4 linhas)
- `Ctrl+Enter` envia, botão Send disabled se texto vazio e sem foto
- Empty state: `MessageCircle` + "Nenhum comentário ainda"

**Integração no `ChecklistItemRow`:**
- Botão `MessageCircle` sempre visível na coluna de ações direita
- Badge numérico vermelho quando `commentsCount > 0` (máx "9+")
- `commentsCount` state local (int) atualizado via `onCommentsCount` callback do sheet
- `commentsOpen` state abre/fecha `ItemCommentsSheet`

### Checklists — P6 Comment Threads (Prompt 6 — 2026-03-29)

#### Componentes novos em `src/app/(auth)/checklists/[id]/components/`

**`item-comments-sheet.tsx`**
- `createPortal(document.body)` para overlay + painel
- Mobile: bottom-sheet `inset-x-0 bottom-0 max-h-[85svh] rounded-t-2xl`
- Desktop: slide-over `sm:inset-y-0 sm:right-0 sm:w-[400px] sm:rounded-l-2xl`
- `useChecklistItemComments(open ? itemId : null)` — lazy load somente quando aberto
- `useSignedUrls('checklist-comment-photos', photoPaths)` para thumbnails
- `Lightbox` sub-component: createPortal + Escape key close
- `CommentItem`: avatar 24px, name, formatDistanceToNow ptBR, texto, thumbnail, delete inline (3s timer)
- Send: `compressImage(file, 1200, 0.8)` → `addComment(...)` com upload de foto opcional
- Realtime: `supabase.channel('comments-{itemId}')` `postgres_changes INSERT` → invalidate + scrollToBottom
- Auto-resize textarea (max 96px) + Ctrl+Enter para enviar

#### `checklist-item-row.tsx` — adicionado comentários
- Botão `MessageCircle` com badge (count real, máximo "9+")
- `commentsOpen` state abre `ItemCommentsSheet`

### Checklists — P7 Recorrências (Prompt 7 — 2026-03-29)

#### Nova rota: `/checklists/recorrencias`
- `src/app/(auth)/checklists/recorrencias/page.tsx`: lista todas as regras (ativas + pausadas)
  - `RecurrenceCard`: ícone roxo, título prefixo + template name, toggle Switch ON/OFF via `useUpdateRecurrence`, ⋮ menu (editar/ver checklists gerados/excluir), pill "Próxima geração: D de MMM às HH:mm"
  - Humanização: `humanizeFrequency()` → "Semanal · Seg, Ter" / "Mensal · dia 15" etc.
  - `RecurrenceSkeleton` + EmptyState + stats (total/ativas/pausadas)
- `src/app/(auth)/checklists/recorrencias/components/create-recurrence-modal.tsx`:
  - Template selector (auto-preenche prefixo com título do template)
  - Frequency pills: Diária / Semanal / Quinzenal / Mensal
  - Day-of-week multi-select: 7 botões D S T Q Q S S (toggles independentes)
  - Day-of-month input (1–28, condicional para Mensal)
  - Time picker `<input type="time">`
  - Assigned user select (filtrado `is_active=true`)
  - Title prefix + preview ao vivo "Prefixo — DD/MM/YYYY"
  - Suporta modo criar (useCreateRecurrence) e modo editar (useUpdateRecurrence)

#### Novo cron: `POST /api/cron/generate-recurring-checklists`
- Query `checklist_recurrence` onde `is_active=true AND next_generation_at <= now()`
- Para cada regra: cria checklist `type='recurring'` com título `{prefix} — DD/MM/YYYY`
- Copia itens do template (priority, estimated_minutes, notes, is_required, sort_order)
- Atualiza `last_generated_at` + recalcula `next_generation_at` (espelha lógica do hook)
- Protegido por `CRON_SECRET`; retorna `{ ok, generated, errors, timestamp }`

#### Integração em `/checklists/page.tsx`
- Botão "Recorrências" (ghost, RefreshCw icon) adicionado ao header da página, antes de Templates

### Checklists — P8 Duplicação (Prompt 8 — 2026-03-29)

#### Componentes novos em `src/app/(auth)/checklists/[id]/components/`
**`duplicate-checklist-modal.tsx`**: modal `createPortal(document.body)` com novo título, combobox de evento (busca debounce), assignee select, due date, 3 checkboxes (copiar prioridades ON / assignees OFF / prazos OFF); chama `useDuplicateChecklist`

#### Componente novo em `src/app/(auth)/checklists/components/`
**`duplicate-from-event-modal.tsx`**: event source combobox, multi-select de checklists com progresso, target event combobox OU standalone toggle, assignee override, copy options; `mutateAsync` em sequência com progress tracking

#### Integrações
- `checklist-detail-header.tsx` ⋮ menu: "Duplicar checklist" → `setDuplicateOpen(true)` (em vez de `handleDuplicate` inline)
- "Duplicado de..." indicator: `checklist.duplicated_from` UUID com link para checklist original
- `/checklists/page.tsx`: botão "Duplicar de evento" (Copy icon) abre `DuplicateFromEventModal`

#### Fix: self-referential FK join removido
- `CHECKLIST_DETAIL_SELECT` tinha `duplicated_from_checklist:checklists!checklists_duplicated_from_fkey(...)` que quebrava todos os fetches de detalhe (FK pode não existir na DB em dev)
- Removido o join; `checklist.duplicated_from` é UUID escalar suficiente para exibir o link

### Checklists — P9 Minhas Tarefas (Prompt 9 — 2026-03-29)

#### Rota nova: `/checklists/minhas-tarefas`
- `src/app/(auth)/checklists/minhas-tarefas/page.tsx`: visão pessoal cross-checklist
  — 4 KPIs: Pendentes / Atrasados / Vencem Hoje / Feitos (7 dias)
  — Search input + 4 filter pills: Todos / Urgentes / Atrasados / Hoje
  — 4 grupos colapsáveis: Atrasados (dot vermelho) / Hoje (âmbar) / Próximos (verde) / Sem Prazo (cinza)
  — `TaskCard`: checkbox → `animate-task-complete` (400ms slide-right + collapse) → mutation Supabase → invalidate queries
  — Prioridade badge (exceto medium), prazo relativo colorido, link para checklist, nome do evento
  — Empty state "Tudo em dia!" quando sem tarefas; empty state filtrado quando sem resultados
  — Mobile-first 375px, dark mode completo

#### Hooks atualizados em `src/hooks/use-my-tasks.ts`
- `useMyCompletedTasksCount(userId)`: conta items com `status='done'`, `done_by=userId`, `updated_at >= 7 dias atrás`; `staleTime: 5min`

#### Navegação
- `src/components/layout/nav-items.ts`: item "Minhas Tarefas" (ListTodo icon, `module: 'checklists'`) adicionado ao grupo raiz
- `src/app/(auth)/checklists/page.tsx`: botão "Minhas Tarefas" no header da página
- `ROUTES.myTasks = '/checklists/minhas-tarefas'` em `src/lib/constants/index.ts`

#### globals.css
- `@keyframes task-complete`: slide-right + max-height collapse 400ms; `.animate-task-complete`; `prefers-reduced-motion` guard

### Checklists — P10 Exportar PDF (Prompt 10 — 2026-03-29)

#### Arquivo novo: `src/lib/utils/checklist-report-pdf.ts`
Módulo standalone de geração de PDF (A4 portrait, jsPDF dinâmico):
- `ChecklistReportItem`, `ChecklistReportPhoto`, `ChecklistReportCommentGroup`, `ChecklistReportOptions` exportados
- `generateChecklistReportPDF(opts)` async — 4 seções:
  1. **INFORMACOES GERAIS**: box duas colunas com dados do checklist/evento
  2. **ITENS DO CHECKLIST**: tabela #/Descricao/Status/Responsavel/Tempo com linhas alternadas e notas indentadas
  3. **EVIDENCIAS FOTOGRAFICAS** (opcional): fotos full-width com legenda e metadados
  4. **OBSERVACOES E COMENTARIOS** (opcional): agrupados por item, autor+data em bold
  5. **ASSINATURAS** (opcional): linhas Responsavel + Supervisor + Data + timestamp
- `drawPageBar()`: barra superior 9mm com cor primária, nome da unidade e data
- `drawSection(y, label)`: título de seção com underline na cor accent
- `checkSpace(y, needed)`: auto page-break com footer + nova barra
- `drawFooter()`: "Gerado por Cachola OS" + "Pagina N de M"
- Imagens recebidas como `dataUrl` base64 JPEG já redimensionadas
- `pdf.save(filename + '.pdf')` auto-download

#### Componente novo: `src/app/(auth)/checklists/[id]/components/export-pdf-modal.tsx`
Modal `createPortal(document.body)` com overlay + painel centrado:
- 3 toggles: Evidências fotográficas / Observações e comentários / Área de assinaturas
- Opção de fotos desabilitada automaticamente quando não há fotos registradas
- `handleGenerate()` async com 4 etapas:
  1. Monta `ChecklistReportItem[]` dos `checklist_items` (com `RichChecklistItem` cast)
  2. Busca signed URLs do bucket `checklist-photos` → `resizeImageForPdf(url, 1200, 900)` via Canvas API
  3. Batch-fetch comentários via `.in('item_id', itemIds)` com join `users!checklist_item_comments_user_id_fkey`
  4. Chama `generateChecklistReportPDF(opts)`
- Progress indicator: "Processando foto N de M…" / "Carregando comentários…" / "Gerando PDF…"
- `resizeImageForPdf(url, maxW, maxH)` helper: `globalThis.Image()` (evita conflito com lucide `Image`)
- Usa `useUnitStore((s) => s.activeUnit)` para nome da unidade no cabeçalho
- Botão "Gerar PDF" desabilitado durante geração + spinner `Loader2`

#### Integração em `checklist-detail-header.tsx`
- Importa `ExportPdfModal`
- `exportPdfOpen` state adicionado
- Menu item "Exportar PDF" → `setExportPdfOpen(true)` (substituiu placeholder)
- `<ExportPdfModal>` renderizado no final do JSX (normal header + completed banner)

### Checklists — P11 Templates 2.0 (Prompt 11 — 2026-03-29)

#### `src/components/features/checklists/sortable-template-items.tsx` — Reescrita completa
- `TemplateItemDraft` expandido: `defaultPriority`, `defaultEstimatedMinutes`, `defaultAssignedToUserId`, `notesTemplate`, `requiresPhoto`, `isRequired`
- `TemplateUserOption = { id, name }` exportado para seletor de responsável padrão
- `SortableItem` colapsável:
  - Linha colapsada: drag handle + description input + badges compactos (priority pill se ≠ medium, tempo, câmera, estrela) + chevron expand + delete
  - Painel expandido (3 rows): Row1: priority select + tempo number + isRequired Switch; Row2: requiresPhoto Switch + assignee select (condicional a `users.length > 0`); Row3: textarea auto-resize para `notesTemplate`
  - `autoFocus` via `descRef.current?.focus()` em `useEffect`
  - Enter → `onAddAfter()` (chain); Escape (se vazio) → `onRemove()`
- Total de minutos exibido no header da seção via `useMemo`

#### `src/app/(auth)/checklists/templates/page.tsx` — Reescrita completa
- `TemplateCard`: priority badge, subtitle (categoria · N itens · ~Xmin), indicadores foto/obrigatório/tempo, usage count, ⋮ menu (Editar/Duplicar/Desativar/Reativar), description snippet
- Usage count: `useQuery` separado que agrupa `checklists.template_id` por ID client-side
- `useChecklistTemplates(false)` — carrega todos (ativos + inativos)
- Filtros: busca por nome, select categoria, botão "Mostrar inativos"
- Grid 2 colunas em sm+; counter de ativos/inativos no rodapé

#### Novos hooks em `src/hooks/use-checklists.ts`
- `useReactivateTemplate()`: update `is_active=true` + invalidate + toast
- `useDuplicateTemplate()`: copia template + itens com todos os campos premium → retorna `newId`

#### `templates/novo/page.tsx` — Melhorias
- Campos novos: description textarea, defaultPriority select
- Total time auto-calculado via `useMemo` exibido no header dos itens
- `useUsers()` → `userOptions` passado para `<SortableTemplateItems users={userOptions}>`
- `handleSave` mapeia todos os campos premium dos itens

#### `templates/[id]/editar/page.tsx` — Melhorias
- Inicialização do `useEffect` popula todos os campos premium dos itens:
  - `default_assigned_to` JSONB `{ type: 'user', value }` → `defaultAssignedToUserId`
  - `default_priority`, `default_estimated_minutes`, `notes_template`, `requires_photo`, `is_required`
- Campos de cabeçalho: description, defaultPriority (mesmos do novo)
- Total time auto-calculado

### Checklists — P12 Polish Final (Prompt 12 — 2026-03-29)

#### Code audit (zero issues found)
- Sem cores hex hardcoded nas telas de checklist
- Sem strings em inglês na UI
- Sem uso de `asChild` (base-ui)
- Sem `console.log` de debug

#### Fixes cirúrgicos
- `minhas-tarefas/page.tsx` `TaskCard`: checkbox touch target corrigido de `w-5 h-5` (20px) para wrapper `w-11 h-11` (-m-2) — atinge 44px mínimo
- `checklist-detail-header.tsx`: `ExportPdfModal` convertido para `dynamic(() => import(...), { ssr: false })` — lazy load evita carregar jsPDF/Canvas até o usuário abrir o modal
- `sortable-template-items.tsx`: painel expandido ganha `animate-fade-up` (150ms) para transição suave

#### Offline mode — estado atual e decisão técnica
- `checklists` store: `{ id, data: AnyJson, cachedAt }` — snapshot completo do Supabase inclui todos os campos premium automaticamente
- `checklist_items` store: armazena apenas `{ status, notes }` editados offline — campos como `priority` e `assigned_to` não são editáveis offline, portanto não precisam estar no schema
- **Decisão:** schema offline está correto como está — a migração de versão do IDB só seria necessária se adicionarmos edição de priority/assignee offline no futuro
- Sync manager envia apenas `status` + `notes` para Supabase ao voltar online (correto)

#### safe-area — cobertura verificada
- `checklists/[id]/page.tsx`: footer sticky com `max(16px, env(safe-area-inset-bottom))`
- `create-checklist-modal.tsx`: `max(0.75rem, env(safe-area-inset-bottom))`
- `item-comments-sheet.tsx`: `max(12px, env(safe-area-inset-bottom))`

#### card-interactive — cobertura verificada
- `checklist-card.tsx` (listagem): ✅
- `templates/page.tsx` (TemplateCard): ✅
- `checklist-kpis.tsx`: KPI cards não são clicáveis → sem card-interactive (correto)
- `TaskCard` (minhas-tarefas): não é clicável como um todo → sem card-interactive (correto)

### Checklists Premium — Resumo Consolidado (12 prompts — 2026-03-29)

**Migration:** 018 + 018b (schema expandido)
**Branch:** feat/checklist-premium-schema → merged para develop

**Features entregues:**
1. Schema expandido: prioridade, prazo por item, responsável por item, type, comments, recurrence
2. Hooks refatorados: 15+ hooks com expanded joins e optimistic updates
3. Listagem premium: KPIs + sparklines, filtros, cards com progresso
4. Criação avulsa: CreateChecklistModal com 3 tipos (event/standalone/recurring)
5. Detalhe premium: item assign/deadline popovers, 3-state checkbox, footer sticky, SaveIndicator
6. Comentários: thread por item com fotos, realtime, lightbox
7. Recorrência: UI + endpoint cron, geração automática
8. Duplicação: individual + batch de evento anterior
9. Minhas Tarefas: visão pessoal cross-checklist com agrupamento por urgência
10. Export PDF: relatório com fotos, comentários, assinaturas (lazy loaded)
11. Templates 2.0: config avançada por item, expandable, badges, usage count
12. Polish: touch targets 44px, lazy loading, dark mode, offline schema doc

**Decisões técnicas estabelecidas:**
- `ExportPdfModal` lazy via `next/dynamic` (evita carregar jsPDF até usar)
- Offline: snapshot `AnyJson` captura campos premium; sync envia só status+notes
- `card-interactive` só em cards inteiramente clicáveis (não em cards com botões internos)
- Touch targets: wrapper `w-11 h-11 -m-[valor]` para elementos pequenos

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

### Fase 2 — Bloco 3: E-mails com Nodemailer + Hostinger SMTP (2026-04-06)
> **Migrado de Resend → nodemailer** (Resend nunca foi configurado em produção)

#### SMTP Supabase GoTrue (VPS — /opt/supabase/supabase/docker/.env)
- [x] `supabase-auth` configurado com Hostinger SMTP (smtp.hostinger.com:465 SSL)
- [x] Credenciais: `noreply@cachola.cloud` / remetente "Cachola OS"
- [x] Testado: `user_recovery_requested` com duration ~2.2s (SMTP real, não Noop)
- [x] Conta real do admin: `bruno.casaletti@grupodrk.com.br` confirmada + role `super_admin`

#### Next.js app (nodemailer)
- [x] `nodemailer@6.9.0` instalado (v6 — v8 sem types); `resend` removido
- [x] `src/types/nodemailer.d.ts`: declarações TypeScript manuais (sem @types/nodemailer)
- [x] `src/lib/email.ts`: reescrito — singleton `_transporter`, lazy init, graceful fallback sem SMTP vars
- [x] `src/lib/email-templates/base.ts`: `wrapInLayout()` — layout HTML responsivo com #7C8D78/#E3DAD1
- [x] `src/lib/email-templates/maintenance-emergency.ts`: template com parâmetros nomeados `{ orderTitle, orderId, description?, sector? }`
- [x] `src/lib/email-templates/maintenance-overdue.ts`: template com `{ orderTitle, orderId, assignedTo?, daysOverdue? }`
- [x] `src/lib/email-templates/event-tomorrow.ts`: template com `{ eventTitle, eventId, eventDate, startTime?, clientName? }`
- [x] `src/lib/email-templates/checklist-overdue.ts`: template com `{ checklistTitle, checklistId, eventTitle?, pendingItems? }`
- [x] `src/lib/email-templates/generic-notification.ts`: template genérico `{ title, message, link?, linkLabel?, preheader? }`
- [x] `src/app/api/email/maintenance-emergency/route.ts`: atualizado para API nomeada
- [x] `src/app/api/cron/check-alerts/route.ts`: atualizado para API nomeada
- [x] `next.config.ts`: `@next/bundle-analyzer` via `require()` condicional (evita erro v16 não publicado)
- [x] `.env.example`: documentação SMTP (substituiu Resend)
- [x] **Deploy VPS**: `npm install` + build OK + pm2 restart + SMTP vars no `.env.local`
- [x] **Testes E2E**: nodemailer VERIFY OK + EMAIL_SENT (`<9b94add6...@cachola.cloud>`) + GoTrue recovery 200 OK

### Fase 2.5 — Multi-Unidade (2026-03-27)
- [x] `supabase/migrations/010_fase25_units.sql`: tabelas `units` (slug UNIQUE) + `user_units` (role por unidade, is_default), `unit_id` nullable→NOT NULL em events/checklists/checklist_templates/maintenance_orders, nullable em audit_logs + config tables (event_types, packages, venues, checklist_categories, sectors, user_permissions), RLS completo com `get_user_unit_ids()` + `is_global_viewer()`, seed Pinheiros
- [x] `src/types/database.types.ts`: Unit, UserUnit, UserUnitWithUnit types; `unit_id` em todas entidades
- [x] `src/stores/unit-store.ts`: Zustand com persist — activeUnitId (localStorage), activeUnit, userUnits; reset no sign out
- [x] `src/hooks/use-units.ts`: useUnits, useUnit, useMyUnits, useUserUnits, useUnitUsers, useCreateUnit, useUpdateUnit, useDeactivateUnit, useAddUserToUnit, useUpdateUserUnitRole, useRemoveUserFromUnit, useSetDefaultUnit
- [x] `src/hooks/use-auth.ts`: loadUserUnits() — carrega user_units, restaura unidade persistida ou usa default; retorna activeUnitId + userUnits
- [x] `src/components/layout/unit-switcher.tsx`: dropdown navbar — "Todas as unidades" (super_admin/diretor), lista de unidades do usuário com check mark, invalida todas queries ao trocar
- [x] `src/components/layout/navbar.tsx`: UnitSwitcher integrado antes de NotificationBell
- [x] `src/components/layout/nav-items.ts`: item "Unidades" → `/admin/unidades` com ícone Building2
- [x] `src/lib/constants/index.ts`: `ROUTES.units = '/admin/unidades'`, `ROUTES.unitSetup = '/admin/unidades/setup'`
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

### Manutenção — Kanban Board + Detalhe Polido (Prompt 7 — 2026-03-28)

#### Kanban Board
- `src/components/features/maintenance/kanban-board.tsx` (novo): DnD com `@dnd-kit/core`
  — `DndContext` + `DragOverlay` + `PointerSensor`(8px) + `TouchSensor`(delay 250ms)
  — 4 colunas: open(brand) / in_progress(amber) / waiting_parts(purple) / completed(green)
  — `KanbanColumn`: `useDroppable({ id: status })`, coluna tintada em hover via `group-data-[over=true]`
  — `onDragEnd`: dropping em `completed` → `useCompleteMaintenanceOrder`; outros → `useChangeMaintenanceStatus`
  — Optimistic update via `queryClient.setQueryData` + rollback em `onError`
  — Fetch com `pageSize: 300` incluindo todos os status (sem paginação no kanban)
  — `DragOverlay` renderiza `KanbanCardContent` com `shadow` flag (rotate-1 scale-1.02)
- `src/components/features/maintenance/kanban-card.tsx` (novo): `KanbanCardContent` + `KanbanCard`
  — `KanbanCardContent` puro (visual only — reusado no DragOverlay sem hooks)
  — `KanbanCard` com `useDraggable` + click → navigate + DropdownMenu de ações
  — `onPointerDown` stop propagation no menu para não ativar DnD
  — Pill de tipo + PriorityBadge + título 2-line + assignee first name + due date + SLA bar

#### View Toggle (maintenance-tabs.tsx)
- `ViewToggle` component: `[☰ Lista] [▦ Kanban]`, `hidden md:flex` (mobile always list)
- `viewMode` persistido em localStorage (`maintenance-view-mode`)
- Em modo Kanban: status filter oculto (`hideStatus` prop em `MaintenanceFilters`)
- Kanban recebe apenas `search/type/priority/sectorId` (status gerenciado pelas colunas)

#### Detalhe da Ordem Polido (manutencao/[id]/page.tsx)
- `MAINTENANCE_DETAIL_SELECT` expandido: `supplier:maintenance_suppliers!supplier_id(id, company_name, category)`
- Card "Localização & Contexto": link fornecedor (`/manutencao/fornecedores/[id]`) + link evento (`/eventos/[id]`) com ícone `ExternalLink`
- Card "Responsável & Datas": `completed_at` com data/hora + `formatResolutionTime()` (< 1h/Xh/X dias)
- Select de status inclui `completed` (além de open/in_progress/waiting_parts)
- Seção "Plano de Manutenção Preventiva": frequência, intervalo, próxima data, aviso, last performed, checklist técnico

#### Timeline Combinada (maintenance-timeline.tsx)
- 3 queries paralelas via `Promise.all`: audit_logs (com user join) + maintenance_costs + maintenance_photos
- `TimelineEvent` union type com `kind: 'audit' | 'cost' | 'photo'`
- `TimelineDot` semântico por tipo: DollarSign(verde)/Image(azul)/Plus(brand)/AlertCircle(red)/RefreshCw(muted)
- Renderização contextual: status change → "Status alterado para X" / "Ordem concluída" com CheckCircle2
- Custo: valor BRL + status colorido (approved=verde/rejected=vermelho/pending=âmbar) + tipo
- Foto: label do tipo (Antes/Depois/Durante)
- Actor avatar + nome (quando disponível via audit_logs.user join)
- Ordenado DESC por `createdAt`; deduplicado por `id`

---

### Manutenção — Mobile UX, Preventivas e SLA (Prompt 8 — 2026-03-28)

#### Quick Actions Bar (mobile-only)
- `src/components/features/maintenance/quick-actions-bar.tsx` (novo): barra fixa `md:hidden` com 3 botões (Foto / Status / Custo)
  — Foto: input `capture="environment"` → `compressImage(file, 1200, 0.8)` → upload `maintenance-photos/{orderId}/quick-{ts}.jpg` → `useAddMaintenancePhoto`
  — Status: abre `StatusBottomSheet`; "completed" delega a `useCompleteMaintenanceOrder`
  — Custo: abre `QuickCostSheet`
  — `paddingBottom: max(12px, env(safe-area-inset-bottom))` — safe area iOS/Android
- `src/components/features/maintenance/status-bottom-sheet.tsx` (novo): Sheet `side="bottom"` rounded-t-2xl; grid 2×2 de status com ícones e cores semânticas; status atual desabilitado com checkmark
- `src/components/features/maintenance/quick-cost-sheet.tsx` (novo): formulário simplificado inline; `text-base` (evita zoom iOS); máscara R$; upload de comprovante por câmera; usa `useSubmitCost` + `useUploadReceipt`
- `src/app/(auth)/manutencao/[id]/page.tsx`: `<QuickActionsBar>` integrado + `pb-24 md:pb-0` no container

#### Overdue Banner
- `src/components/features/maintenance/overdue-banner.tsx` (novo): banner não-dismissível com `status-error-*` tokens; `border-l-4 border-red-500`; mostra count + maxDaysOverdue; botão "Ver atrasadas" chama `onViewOverdue`
- `src/hooks/use-maintenance.ts`: `useOverdueOrders()` adicionado — conta ordens com `due_date < today` e `status` não concluído/cancelado

#### Preventive Schedule
- `src/components/features/maintenance/preventive-schedule.tsx` (novo): seção colapsável "Próximas Preventivas"; auto-expande se item vence em ≤14 dias; `formatFrequency()` human-labels; `countdownInfo()` — verde >14d / âmbar 7-14d / vermelho ≤7d/atrasado; oculto se sem itens
- `src/hooks/use-maintenance.ts`: `useUpcomingPreventives()` adicionado — tipo `preventive`, status não concluído, sort client-side por `preventive_plan?.next_due_date`
- `src/components/features/maintenance/maintenance-tabs.tsx`: `<OverdueBanner>` + `<PreventiveSchedule>` acima dos filtros em modo lista

#### SLA Card
- `src/components/features/maintenance/sla-card.tsx` (novo): `SlaBar` colorida (verde/âmbar/vermelho) + `animate-pulse-sla` quando atrasada; grid 2×2 com Criada/Prazo/Decorrido/Restante; banner vermelho interno quando atrasada; `formatDuration(ms)` helper
- `src/app/(auth)/manutencao/[id]/page.tsx`: `<SlaCard>` entre info grid e seção preventiva, condicional a `due_date && status !== 'cancelled'`

#### globals.css
- `@keyframes pulse-sla` (1.5s ease-in-out) + `.animate-pulse-sla` + `prefers-reduced-motion` guard

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

### Fase 4 — Mapeamento de Unidade Configurável (2026-04-02)

#### Bug corrigido
`resolveUnitId` em `sync.ts` tinha um early return `if (unitId) return unitId` que, ao receber `options.unitId`, ignorava completamente o `parsed.unitName` do deal. Resultado: todos os deals eram atribuídos à mesma unidade (Pinheiros) independente do valor do campo "Unidade Escolhida" no Ploomes.

#### Solução implementada
- [x] `supabase/migrations/022_ploomes_unit_mapping.sql`: tabela `ploomes_unit_mapping` (ploomes_value TEXT UNIQUE → unit_id UUID FK), trigger updated_at, índice parcial em ploomes_value (is_active=true), RLS (settings:view/edit), seed Pinheiros ("Cachola PINHEIROS" → ObjectId 609551206) + Moema ("Cachola MOEMA")
- [x] `src/lib/ploomes/sync.ts`: `resolveUnitId(supabase, unitName?)` refatorado com prioridade:
  1. Lookup exato em `ploomes_unit_mapping` (maybeSingle, sem erro se não encontrar)
  2. Fallback ilike em `units.name` (compatibilidade legada)
  3. Fallback final: primeira unidade ativa
- [x] `src/lib/ploomes/sync.ts`: deal loop agora resolve `dealUnitId` primeiro, depois faz filter por `options.unitId` (sem early return)
- [x] `src/types/database.types.ts`: `PloomesUnitMapping` type + entrada em `Database['public']['Tables']`
- [x] `src/app/(auth)/configuracoes/regras/page.tsx`: módulo `settings` + regra "Associação de Unidade por Deal" com lógica de prioridade documentada

#### Campo do Ploomes
- **FieldKey:** `deal_A583075F-D19C-4034-A479-36625C621660` (campo customizado "Unidade Escolhida")
- **ValueKey:** `ObjectValueName` (texto do item selecionado, ex: "Cachola PINHEIROS")
- **ObjectId:** `ploomes_object_id` armazenado como backup (ex: 609551206), não usado no lookup primário

#### Como adicionar nova unidade
1. Criar a unidade em `/admin/unidades`
2. Inserir no banco: `INSERT INTO ploomes_unit_mapping (ploomes_value, unit_id) VALUES ('Cachola NOVA_UNIDADE', '<uuid>');`
3. Disparar re-sync manual em `/configuracoes/integracoes/ploomes`

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

### Eventos — Redesign Listagem P1 + P2 (2026-03-29)

#### P1 — Abas Temporais + Agrupamento por Dia
- `supabase/migrations/019_events_extra_fields.sql`: ADD `client_phone`, `client_email`, `theme` a `events`
- `src/types/database.types.ts`: `Event` + `EventInsert` com novos campos; `EventForList` type (Event + joins com checklists)
- `src/hooks/use-events.ts`:
  - `TabKey` = `'today' | 'week' | 'month' | 'all'`; `getTabDateRange()` exportado
  - `EVENT_FOR_LIST_SELECT` com join de checklists + checklist_items
  - `useEventsTabCounts()`: 4 queries COUNT paralelas (staleTime 2min)
  - `useEventsInfinite(filters)`: `useInfiniteQuery` offset-based, page 20
  - `useEventsKpis()`: % médio de checklists da semana + count próximos 7 dias sem checklist
- `src/components/features/events/event-temporal-tabs.tsx` (NOVO): pills com scroll horizontal, badge de contagem, scroll ativo para a aba selecionada
- `src/components/features/events/event-day-group.tsx` (NOVO): separador com "Hoje", "Amanhã" ou data completa pt-BR
- `src/app/(auth)/eventos/page.tsx`: reescrita completa — `EventosContent` wrappado em `<Suspense>`, abas temporais + chips de status + busca com debounce + agrupamento por data + load more + 3 empty states

#### P2 — Cards Enriquecidos + KPI Cards
- `src/lib/ploomes/sync.ts`: `eventPayload` agora inclui `client_phone`, `client_email`, `theme` do ParsedDeal
- `src/components/features/events/events-kpi-cards.tsx` (NOVO): grid 2×2→4 colunas; cards: Festas hoje / Esta semana / Checklists % (success/warning) / Sem checklist (warning se >0); clicáveis → muda aba; skeleton loading
- `src/components/features/events/event-card.tsx`: reescrita completa:
  - Avatar 48px com iniciais, cor hash-based (`getAvatarColor()`)
  - Badge "Hoje" (pulsando) quando `isToday(event.date)`
  - Badge "Sem checklist" (âmbar) para eventos futuros sem checklists vinculados
  - Tema da festa (`event.theme`) com ícone Tag
  - Contato (phone/email) sempre visível mobile, expande em hover no desktop (`sm:max-h-0 sm:group-hover:max-h-14`)
  - Barra de progresso com `animate-progress-fill` (scaleX 0→1)
  - Skeleton atualizado com avatar circle
- `src/app/globals.css`: `@keyframes progress-fill` (scaleX 0→1, 600ms ease-out) + `.animate-progress-fill` + `prefers-reduced-motion` guard
- `src/app/(auth)/eventos/page.tsx`: `EventsKpiCards` renderizado entre PageHeader e abas temporais
- Fix: `src/hooks/use-auth.ts` — `signIn()` retorna `error.message` raw (inglês) para `classifyError()` funcionar corretamente na página de login

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
- [x] Eventos Redesign P1: Lista com abas temporais, agrupamento e load more
- [x] Eventos Redesign P2: Cards enriquecidos + KPI cards + campos client_phone/email/theme
- [x] Eventos Redesign P3: Detalhe do evento com accordion sections + quick actions bar
- [x] Eventos Redesign P4: Enriquecimento Ploomes — 22 novos campos sincronizados, migration 020, UI com Serviços/Briefing/Financeiro

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
  - `buildMonths(now, 6)` → array `['yyyy-MM' × 6]` oldest first
  - `trendPct(curr, prev)` → % change rounded, `null` quando prev=0
  - `staleTime: 2min`; retry não retenta 401/403
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
  - `invertTrend?: boolean` — inverte semântica de cores (menos = melhor); usado em Manutenções e Checklists

### fix(dashboard): KPIs corrigidos + remoção Próximo Evento (2026-04-01)

#### Regras de negócio dos 5 KPIs

| KPI | Valor | Período | Regra |
|-----|-------|---------|-------|
| Eventos do Mês | COUNT | data da festa no mês atual | `status = 'confirmed'` |
| Taxa de Conversão | % | data da festa no mês atual | `confirmed / (confirmed + lost)` × 100 |
| Leads do Mês | COUNT | data da festa no mês atual | todos os status (confirmed + lost) |
| Manutenções Abertas | COUNT | snapshot atual | `status NOT IN (completed, cancelled)` |
| Checklists Pendentes | COUNT | snapshot atual | `status NOT IN (completed, cancelled)` |

#### StatusId Ploomes → status DB
- `StatusId=1` (Em aberto) → `confirmed` (já estava no stage "Festa Fechada")
- `StatusId=2` (Ganho) → `confirmed`
- `StatusId=3` (Perdido) → `lost`
- **NÃO usar `created_at`** para agrupar por mês — todos os eventos têm `created_at` igual à data do sync Ploomes (batch), não à data de criação do deal. Usar sempre o campo `date` (data da festa).

#### Tendências de Manutenções e Checklists
- Comparação: count aberto **agora** vs count aberto **há 30 dias** (via `completed_at`)
- Cores **invertidas** (`invertTrend=true`): queda = verde (melhora), alta = vermelho (piora)
- Sparkline: novas ordens/checklists criados por mês (proxy de atividade)

#### Layout
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` (5 cards); 5º com `col-span-2 md:col-span-1`
- Card "Próximo Evento" (6º KPI) removido
- `NextEventCard` sidebar e hook `useNextEvent` removidos — calendário ocupa largura total (`grid-cols-1`)

### feat(regras): Página de Regras de Negócio (2026-04-01)

**Rota:** `/configuracoes/regras`
**Arquivo:** `src/app/(auth)/configuracoes/regras/page.tsx`

#### Estrutura
- Página estática somente leitura — sem banco, sem hooks, sem formulários
- `BUSINESS_RULES: BusinessRule[]` — array hardcoded com todas as regras
- `BusinessRule` interface: `id, module, name, description, calculation[], comparison?, note?, updatedAt`
- `MODULE_CONFIG`: mapeamento `Module → { label, Icon, badgeClass }` para rendering genérico

#### Componentes
- `RuleCard`: card `outlined` com seções "O que mede" / "Como calcula" / "Comparação" / Nota (callout azul `bg-blue-50 border-l-4`)
- `ModuleSection`: acordeão CSS grid (`0fr→1fr`), `defaultOpen` prop; badge "Em breve" para módulos sem regras
- Busca local: `useState(search)` → `useMemo` filtra `name + description + calculation + note`; empty state com botão "Limpar busca"

#### Módulos com regras
- **Dashboard** (5 regras): Eventos do Mês, Taxa de Conversão, Leads do Mês, Manutenções Abertas, Checklists Pendentes

#### Módulos planejados (em breve)
- Eventos, Checklists, Manutenção, Prestadores

#### Navegação
- `ROUTES.businessRules = '/configuracoes/regras'` em `src/lib/constants/index.ts`
- Item "Regras de Negócio" (`BookOpen`) no grupo "Administração" em `nav-items.ts`
- `'regras': 'Regras de Negócio'` em `SEGMENT_LABELS` do breadcrumb

#### Como adicionar novas regras
Basta adicionar um objeto `BusinessRule` ao array `BUSINESS_RULES` no topo da página. Não requer migration, hook ou API.

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

## Eventos Redesign — P1 Lista com Abas Temporais (2026-03-29)

### Novos tipos em `src/types/database.types.ts`
- `EventForList`: Event + staff + event_type + package + venue + checklists (com checklist_items para progresso)

### Novos hooks em `src/hooks/use-events.ts`
- `TabKey`: `'today' | 'week' | 'month' | 'all'`
- `getTabDateRange(tab, now)`: calcula `{ start, end }` ISO por aba (exportado para reutilização)
- `useEventsTabCounts()`: 4 COUNT queries paralelas (`head: true`) — staleTime 2min, retry sem 401/403
- `useEventsInfinite(filters)`: `useInfiniteQuery`, page size 20, cursor por offset; inclui join `checklists(id,status,checklist_items(id,status))`; filtros `tab + status[] + search`; `enabled: isSessionReady`

### Novos componentes
- `src/components/features/events/event-temporal-tabs.tsx`: abas pills com counters (scroll horizontal mobile, aria-selected, auto-scroll aba ativa)
- `src/components/features/events/event-day-group.tsx`: separador de agrupamento por dia com labels inteligentes (Hoje/Amanhã/data longa ptBR)

### Componentes atualizados
- `src/components/features/events/event-card.tsx`: aceita `EventWithDetails | EventForList`; barra de progresso de checklists (verde ≥80%, âmbar ≥50%, vermelho <50%); skeleton usa `.skeleton-shimmer`
- `src/app/(auth)/eventos/page.tsx`: redesign completo — abas + busca + chips + agrupamento por dia + load more; inner component `EventosContent` dentro de `<Suspense>` para `useSearchParams`; stagger `animate-fade-up` nos cards

### Decisões técnicas
- `useEventsInfinite` separado de `useEvents` (mantém retrocompat com modais de checklist)
- Tab counts via `head: true` (apenas COUNT, zero dados transferidos)
- Checklist progress calculado client-side dos items já retornados no join (sem query N+1)
- Aba ativa em URL search params (`?tab=`) — persiste no refresh
- Status filters em `useState` local — reset ao trocar de aba

---

## Eventos Redesign — P2 Cards Enriquecidos + KPI Cards (2026-03-29)

### Migration: `019_events_extra_fields.sql`
- ADD COLUMN `client_phone TEXT`, `client_email TEXT`, `theme TEXT` em `events`

### Novos componentes
- `src/components/features/events/events-kpi-cards.tsx`: grid 2×2→4 colunas; cards Festas hoje / Esta semana / Checklists % / Sem checklist; clicáveis → muda aba; skeleton loading

### Componentes atualizados
- `src/components/features/events/event-card.tsx`: avatar 48px com iniciais + cor hash-based; badge "Hoje" pulsando; badge "Sem checklist" âmbar; tema com Tag icon; contato sempre visível mobile / expande hover desktop; barra de progresso com `animate-progress-fill`
- `src/lib/ploomes/sync.ts`: `eventPayload` inclui `client_phone`, `client_email`, `theme`
- `src/app/(auth)/eventos/page.tsx`: `EventsKpiCards` entre PageHeader e abas temporais
- `src/app/globals.css`: `@keyframes progress-fill` (scaleX 0→1, 600ms) + `.animate-progress-fill`

---

## Eventos Redesign — P3 Detalhe com Accordion + Quick Actions (2026-03-29)

### `src/app/(auth)/eventos/[id]/page.tsx` — Reescrita completa
- **`AccordionSection`** (scratch, sem lib): `useState(isOpen)` + CSS grid `grid-template-rows: 0fr→1fr` + `transition-[grid-template-rows] duration-200`; `ChevronDown rotate-180` quando aberto
- **`LogisticsTimeline`**: linha horizontal conectora (`absolute top-[13px] left-[18px] right-[18px] h-0.5 bg-border`); 2 pontos circulares verdes com label Início/Término e horário
- **`EventChecklistRow`**: link compacto com progresso inline (done/total + mini barra) + `ExternalLink` icon
- **`QuickActionsBar`**: `fixed bottom-0 inset-x-0 md:hidden z-[25]`; 4 botões: Ligar (`tel:`), WhatsApp (`wa.me/55{phone}`), Checklists (scroll via `useRef`), Ploomes (link externo)
- **`EventDetailSkeleton`**: avatar circle + accordion stubs
- **Header hero**: avatar 64px com iniciais + cor hash-based; birthday_person como H1; badge status; client_name; data/hora/convidados (grid 2-col desktop); botão Ploomes ghost quando `ploomes_url`
- **Breadcrumb desktop**: `Eventos / {birthday_person || title}` (hidden mobile)
- **Accordion card** com `divide-y divide-border`; 7 seções:
  - Logística (`defaultOpen`): mini-timeline + pacote
  - Informações da Festa: tipo de evento + notas
  - Cliente e Contato: nome, phone, email com links
  - Equipe: avatares grid
  - Checklists (`defaultOpen`): `EventChecklistRow` list + "Criar Checklist" button + `CreateChecklistModal`
  - Histórico: `EventTimeline` component
- **Manutenções Relacionadas**: seção extra fora do accordion quando há manutenções vinculadas
- `pb-20 md:pb-0` no container para não cobrir a barra mobile

### Decisões técnicas
- `PloomesEventDetails` removido — dados do Ploomes agora no header hero
- Seções sem dados não renderizam (hide empty via conditional render)
- `divide-y divide-border` no pai garante divisores corretos mesmo com seções condicionais
- `checklistsSectionRef` em wrapper `<div>` ao redor do AccordionSection para scroll target mobile
- Acordeão de scratch: sem Radix, sem shadcn — CSS grid animation puro

---

## Eventos — Ajustes UI/UX (2026-04-07)

**Eventos (UI):** Banner de aviso Ploomes removido. Listagem default filtra `date >= hoje` (aba Todos, sem filtros manuais ativos). Filtros de status: apenas Confirmado e Perdido. Botão Editar e menu 3 pontos removidos dos detalhes. Link Ploomes: `https://app10.ploomes.com/deal/{id}` (derivado de `ploomes_deal_id` para compatibilidade com registros antigos).

---

## Eventos Redesign — P4 Enriquecimento Ploomes (2026-03-29)

### Novos campos sincronizados (22 OtherProperties + deal.Amount)

**Logística:** setup_time, teardown_time, show_time, event_location, duration
**Serviços:** has_show, photo_video, decoration_aligned, has_decorated_sweets, party_favors, outside_drinks
**Família:** father_name, school, birthday_date
**Financeiro:** payment_method, briefing, event_category, cake_flavor, music, adult_count, kids_under4, kids_over5, deal_amount (Deal.Amount)

### `supabase/migrations/020_ploomes_enrichment_fields.sql`
- 23 colunas adicionadas via `ALTER TABLE events ADD COLUMN IF NOT EXISTS`
- Todos nullable (nem todos os deals têm todos os campos)
- Booleanos com `DEFAULT FALSE`; decimais como `DECIMAL(12,2)`

### `src/lib/ploomes/types.ts`
- `PloomesOtherProperty`: adicionado `BoolValue?: boolean` e `BigStringValue?: string`
- `ParsedDeal`: 22+ novos campos (setupTime, hasShow, briefing, fatherName, etc.)
- `FieldMappingDef`: tipos expandidos com `BoolValue`, `BigStringValue`, parser `bool`

### `src/lib/ploomes/field-mapping.ts`
- `DEAL_FIELD_MAP`: expandido de 9 para 32 entradas (22 novos FieldKeys)
- `ValueKey`: adicionado `BoolValue` e `BigStringValue`
- `Parser`: adicionado `bool`
- `parseRawValue`: handler para `bool` (`BoolValue`) e bigstring (via `StringValue`/`BigStringValue`)
- Seções: Essenciais (10), Logística (5), Serviços (6), Família (3), Financeiro (8)

### `src/lib/ploomes/sync.ts` — `eventPayload` expandido
- Todos os 22 novos campos do `parsed` mapeados para colunas do banco
- `deal_amount: parsed.amount ?? null` (Deal.Amount standard field)
- `notes: parsed.notes ?? null` (Observações BigString — antes não era salvo)

### `src/app/(auth)/eventos/[id]/page.tsx` — Novas seções accordion
- `LogisticsTimeline`: expandida com pontos setup/show/teardown (amber=montagem, violet=show)
- **S3 "Cliente e Família"**: adicionados father_name, school, birthday_date
- **S3b "Serviços Contratados"** (novo): `BoolIndicator` grid 2 colunas + photo_video
- **S3c "Briefing"** (novo): texto longo whitespace-pre-wrap
- **S3d "Financeiro"** (novo): deal_amount formatado BRL + payment_method
- **S1 "Informações da Festa"**: adicionados event_category, cake_flavor, music, breakdown adultos/crianças
- Todos condicionais (`hasServices`, `hasBriefing`, `hasFinancial`) — não renderizam se vazio

### Decisões técnicas
- `event_category` (não `event_type`) para evitar conflito com FK `event_type_id`
- `BigStringValue` e `BoolValue` adicionados a `PloomesOtherProperty` conforme API Ploomes
- `notes` agora salvo no sync (campo `deal_6DD261DD...` antes ignorado)
- `deal_amount` mapeado de `Deal.Amount` (standard field, não OtherProperty)
- Migration `IF NOT EXISTS` — segura para re-executar

---

## Módulo Prestadores de Serviços (8 prompts, completo — 2026-03-30)

**Migration 021:** 7 tabelas (`service_categories`, `service_providers`, `provider_contacts`, `provider_services`, `provider_documents`, `event_providers`, `provider_ratings`), triggers `update_provider_stats` + `update_updated_at`, bucket `provider-documents` (20MB), seed 13 categorias Pinheiros, RLS módulo `'providers'` (28 policies, 4 ações).

### Arquivos de dados

**`src/types/providers.ts`**: `ServiceProvider`, `ServiceProviderListItem` (com `expiring_docs?: [{id, expires_at}]`), `ServiceProviderWithDetails`, `EventProvider`, `ProviderRating`, `ProviderContact`, `ProviderService`, `ProviderDocument`, `PROVIDER_STATUS_LABELS/COLORS`, `PRICE_TYPE_LABELS`, `CreateEventProviderInput`

**`src/hooks/use-providers.ts`**: `useProviders(filters)` (PROVIDER_LIST_SELECT com join docs para contagem+vencimento, cálculo de `expiring_docs`/`has_expiring_docs` client-side), `useProvider(id)`, `useProviderKpis()` (KPIs: total/active/pending_docs/expiringDocs/pendingRatings), `useCreateProvider`, `useUpdateProvider`, `useDeleteProvider`, `useProviderScheduleConflicts(providerId, eventDate, excludeEventId)`

**`src/hooks/use-event-providers.ts`**: `useEventProviders(eventId)`, `useAddProviderToEvent` (notifica + sugere conflito), `useUpdateEventProvider` (notifica mudança de status), `useRemoveProviderFromEvent`

**`src/hooks/use-provider-ratings.ts`**: `useProviderRatings(providerId)`, `useEventRatings(eventId)` → `Record<string, ProviderRating>` O(1) lookup, `useCreateRating`, `usePendingRatings()`

**`src/hooks/use-service-categories.ts`**: `useServiceCategories()`

**`src/lib/utils/providers.ts`**: `formatPhone`, `formatCPF`, `formatCNPJ`, `formatCurrency`, `parseCurrency`, `formatInputCurrency`, `maskDocument`, `getAvatarColor`, `parseAddressFromZip`

### Páginas e componentes de listagem

**`src/app/(auth)/prestadores/page.tsx`**: KPI cards + `PendingRatingsAlert` + banner âmbar docs vencendo + `ProviderFiltersBar` + grid de cards

**`src/app/(auth)/prestadores/components/`**:
- `ProviderCard.tsx`: status badge, rating, categorias, contato, métricas, `AlertTriangle` vermelho/âmbar quando docs vencidos/vencendo, WhatsApp + e-mail quick actions
- `ProviderAvatar.tsx`: iniciais + cor hash-based
- `StarRating.tsx`: 5 estrelas interativas ou display; `size` prop
- `ProviderFilters.tsx`: busca debounce + pills status + select categoria + filtro `has_expiring_docs`
- `ProviderKPICards.tsx`: grid 2×2→3 colunas (Total/Ativos/Pendentes docs/Avaliações pendentes/Docs vencendo)
- `ProviderCardSkeleton.tsx`, `ProviderEmptyState.tsx`
- `PendingRatingsAlert.tsx`: sessionStorage dismiss, expandível, lista até 5, abre `RatingFormCard`
- `RatingFormCard.tsx`: createPortal, 4 critérios (geral obrigatório + 3 opcionais), comentário
- `EventProviderRatingSection.tsx`: abaixo de `EventProviderCard`, verde (avaliado) ou âmbar tracejado (avaliar agora)

### Formulário multi-step criação/edição

**`src/app/(auth)/prestadores/components/`**:
- `ProviderFormStepper.tsx`: 4 passos (Dados/Contatos/Serviços/Docs), estados complete/current/error/pending
- `ContactInlineForm.tsx`, `ServiceInlineForm.tsx`, `DocumentUploadCard.tsx`
- `steps/BasicDataStep.tsx`: CPF/CNPJ mask, tags dropdown, ZIP auto-formatado
- `steps/ContactsStep.tsx`: mín 1 contato; edição inline
- `steps/ServicesStep.tsx`: mín 1 serviço; categorias únicas; máscara BRL
- `steps/DocumentsStep.tsx`: opcional; badge vencimento
- `ProviderForm.tsx`: `saveCreateMode()` (Promise.allSettled) + `saveEditMode()` (mutations imediatas)

**Rotas**: `/prestadores/novo`, `/prestadores/[id]/editar`

### Detalhe do prestador

**`src/app/(auth)/prestadores/[id]/page.tsx`**: accordion sections (Contatos, Serviços, Documentos, Histórico de Eventos, Avaliações)

**`src/app/(auth)/prestadores/[id]/components/`**:
- `ProviderDetailHeader.tsx`: avatar, rating, categorias, localização, ações (Editar/WhatsApp/E-mail/⋯), ⋯ menu com "Exportar PDF" (lazy `exportProviderPDF`), toggle status, bloquear, excluir
- `ProviderDocumentSection.tsx`: upload com progresso, badges vencimento, signed URLs
- `ContactList.tsx`: add/edit/delete inline, badge "Principal"
- `ProviderServicesSection.tsx`, `EventHistorySection.tsx`, `RatingsSection.tsx`

### Associação Festa ↔ Prestador

**`src/app/(auth)/eventos/[id]/components/`**:
- `AccordionSection.tsx` (extraído, reutilizável)
- `ProviderConflictAlert.tsx`: banner amber não-bloqueador
- `EventProviderCard.tsx`: status badge, preço, horário chegada, dropdown ações
- `AddProviderModal.tsx`: combobox com `useDebounce`, fix blur/click race, verificação conflito, auto-seleção categoria única
- `sections/ProvidersSection.tsx`: lista, totalizador por evento, "+ Adicionar Prestador", `useEventRatings` + `EventProviderRatingSection` por card

### Notificações e cron

**`src/lib/notifications.ts`**: `notifyProviderDocExpiring`, `notifyProviderDocExpired`, `notifyProviderRatingPending`, `notifyProviderAddedToEvent`, `notifyProviderStatusChanged`

**`src/app/api/cron/check-provider-alerts/route.ts`**: 3 checks (docs vencendo / vencidos / ratings pendentes 24–48h), `expiry_alert_sent = true` após notificar, retorna `{ok, docsExpiring, docsExpired, ratingsPending, errors[], timestamp}`

### Command Palette + Breadcrumbs + PDF (P8 — polish)

- `breadcrumbs.tsx`: `'prestadores': 'Prestadores'` adicionado a `SEGMENT_LABELS`
- `use-command-palette-search.ts`: `IndexProvider {id, name, avg_rating}`, query `service_providers` (active, limit 150)
- `command-palette.tsx`: `'provider'` em `ResultGroup` + `GROUP_META`, página `p-prestadores` (Handshake icon), ação `a-new-prestador`, bloco de busca dinâmica com rating sublabel
- `export.ts`: `exportProviderPDF(ProviderPdfConfig)` — PDF A4 portrait, seções Dados Gerais / Contatos / Serviços / Documentos / Avaliações, `addPdfHeader` + `addPdfFooter` reutilizados

### Decisões técnicas
- `PROVIDER_LIST_SELECT` usa `docs:provider_documents(id,expires_at)` (não aggregate count) — calcula `documents_count` + `expiring_docs` client-side sem query dupla
- `useEventRatings` separado de `useProviderRatings` — queryKey por evento para invalidação granular
- `expiry_alert_sent = true` garante idempotência do cron; novo documento começa com `false`
- Cast `rawEp as unknown as EventProvider` em `PendingRatingsAlert` — join Supabase não infere tipo corretamente; dado validado por RLS
- `createClient` inline nos crons de providers (não `createAdminClient()` que é async)
- `exportProviderPDF` lazy import no header — jsPDF não carrega até clicar "Exportar PDF"

---

---

## Wizard de Setup de Unidade (Prompt 1 de 4 — 2026-04-02)

### Rotas
| Rota | Tipo | Descrição |
|------|------|-----------|
| `/admin/unidades/setup` | Client Component | Cria nova unidade e redireciona para `/[id]/setup` |
| `/admin/unidades/[id]/setup` | Server Component | Wizard de 5 etapas para configurar unidade existente |

**Permissão:** apenas `super_admin` e `diretor`.

### API Routes (em `src/app/api/units/`)
| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/units/setup` | POST | Atualiza dados da unidade + upsert ploomes_unit_mapping + sync opcional |
| `/api/units/copy-templates` | POST | Copia templates, categorias, setores e categorias de equipamento/serviço entre unidades |
| `/api/units/link-team` | POST | Vincula colaboradores (upsert em user_units) |
| `/api/units/link-providers` | POST | Copia prestadores de uma unidade para outra (registros independentes) |
| `/api/units/[id]/setup-status` | GET | Retorna `UnitSetupStatus` com contagens para exibir progresso |
| `/api/units/[id]/copyable-data` | GET | Retorna listas de templates/setores copiáveis de uma unidade fonte |

### Hook (`src/hooks/use-unit-setup.ts`)
- **Queries:** `useUnitSetupStatus`, `useCopyableData`, `useSystemUsers`, `useUnitTeam`, `useSourceProviders`, `useAllUnits`
- **Mutations:** `useCopyTemplates`, `useLinkTeam`, `useLinkProviders`, `useFinalizeSetup`

### Componentes do Wizard (`src/app/(auth)/admin/unidades/setup/components/`)
- `UnitSetupStepper.tsx` — indicador de progresso estilo ProviderFormStepper (5 steps com ícones Building2/Link2/Copy/Users/Handshake)
- `UnitSetupWizard.tsx` — orquestrador client com todos os estados; `handleFinish()` roda 4 mutations em sequência
- `steps/Step1Dados.tsx` — nome, slug (auto-gerado), endereço, telefone
- `steps/Step2Ploomes.tsx` — mapeamento Ploomes com "Testar conexão"
- `steps/Step3Templates.tsx` — copiar templates de outra unidade com preview por categoria
- `steps/Step4Equipe.tsx` — selecionar colaboradores com role por unidade
- `steps/Step5Prestadores.tsx` — copiar prestadores de outra unidade com checkbox multi-select

### Comportamento de cópia de templates (`copy-templates`)
- Pula entidades com mesmo nome (case-insensitive) na unidade destino — contador `skipped`
- `category_id` é definido como `null` nos templates copiados (IDs de categoria diferem por unidade)
- `default_assigned_to` não é copiado (referência a usuários específicos da unidade origem)
- Service categories com slug conflitante ganham sufixo timestamp

### Comportamento de cópia de prestadores (`link-providers`)
- Cria registro **independente** na unidade destino (não vinculação N:N)
- Duplicate check via `document_number` na unidade destino
- Copia `provider_contacts` e `provider_services` (category_id mapeado via slug)
- **Log obrigatório:** `console.info('[link-providers] Copiado: {nome} ({doc}) → unidade {targetId} (novo ID: {newId})')`
- Cada provider pulado também é logado com `console.info`

### Fluxo completo
1. `/admin/unidades/setup` → usuário preenche Step1 → cria unidade no Supabase → redireciona para `/admin/unidades/[id]/setup`
2. `/admin/unidades/[id]/setup` → Server Component carrega `UnitSetupStatus` SSR (sem flash) → renderiza `UnitSetupWizard`
3. Ao clicar "Concluir Setup" → `finalizeSetup` → `copyTemplates` → `linkTeam` → `linkProviders` → `setActiveUnit(unitId)` → redirect `/dashboard`

---

## DATA FETCHING PATTERNS (Obrigatório)

Estas regras resolvem o bug "Skeleton Loading Infinito" causado por race condition entre session, Zustand hydration e TanStack Query. **Toda nova query deve seguir estes padrões.**

### Proteção Global (2026-03-31)
1. **`AppReadyGate`** (`src/components/app-ready-gate.tsx`) — renderiza filhos SOMENTE quando `isSessionReady && _hasHydrated`. Resolve a race condition entre `AuthGuard.getSession()` e `onRehydrateStorage` do Zustand persist. Adicionado em `(auth)/layout.tsx` logo após `<AuthGuard>`.
2. **`useLoadingTimeout`** (`src/hooks/use-loading-timeout.ts`) — safety net: se `isLoading` durar >12s, retorna `isTimedOut=true` → página exibe "Tentar novamente" em vez de skeleton infinito. Aplicado em Dashboard, Eventos, Checklists, Manutenção, Equipamentos, Prestadores.
3. **`!!activeUnitId` NUNCA deve ser obrigatório em `enabled`** — `activeUnitId=null` é estado legítimo para super_admin/diretor (visão consolidada). Usar filtro condicional no queryFn: `if (activeUnitId) query = query.eq('unit_id', activeUnitId)`.

| Regra | Como aplicar |
|-------|-------------|
| `enabled` obrigatório em toda `useQuery` | `enabled: isSessionReady` (adicionar `!!id` quando a query depende de um ID) |
| NUNCA `enabled: !!activeUnitId && isSessionReady` | `activeUnitId=null` é legítimo para super_admin → query nunca dispara → skeleton infinito |
| `isSessionReady` vem de `useAuthReadyStore` | `const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)` |
| Retry nunca retentar 401/403 | `retry: (count, err) => count < 3 && err?.status !== 401 && err?.status !== 403` |
| Páginas DEVEM tratar `isError` | Nunca só `isLoading` — sempre `isError` também com banner "Tentar novamente" |
| Páginas DEVEM usar `useLoadingTimeout` | `const isTimedOut = useLoadingTimeout(isLoading)` — exibe retry após 12s |
| Zustand com persist precisa de `_hasHydrated` | Ver `unit-store.ts` como referência — `onRehydrateStorage` seta flag |
| Não fazer `getUser()` interno em hooks | Usar `isSessionReady` como gate; `getUser()` antes de ready retorna null |
| Sub-queries herdam `enabled` do hook pai | Todos os `useQuery` dentro de um hook composto recebem o mesmo `enabled` guard |
| AuthGuard é self-contained | Faz próprio `getSession()` — não depende de provider pai |
| `onAuthStateChange SIGNED_IN` invalida cache | `AuthCacheSync` em `providers.tsx` já cuida disso — não duplicar |
| `AuthCacheSync` ignora o primeiro `SIGNED_IN` | Supabase v2 dispara `SIGNED_IN` imediatamente ao subscrever quando já há sessão. Invalidar nesse momento reseta queries em-flight de volta a `isPending`, causando skeleton infinito. Solução: `isInitialEvent = true` flag — pula o primeiro evento por mount |
| `createClient()` é singleton | `createBrowserClient` gera uma instância nova a cada chamada. Múltiplas instâncias competem pelo mesmo localStorage lock (`lock:sb-localhost-auth-token`), causando timeouts de 5s que travam TODAS as chamadas autenticadas (skeleton infinito). `src/lib/supabase/client.ts` mantém um singleton `_client` — uma instância = um lock |
| NUNCA chamar `getUser()`/`getSession()` fora de queryFn/mutationFn | Em `useEffect` com Strict Mode (`reactStrictMode: true`), efeitos rodam 2× no mount. `getUser()` em efeito = 2 lock acquisitions concorrentes. Usar `useAuth().profile.id` quando precisar do userId em hooks — já está disponível sem lock extra |
| Supabase Realtime (local Docker) | WebSocket via Kong não funciona no Docker local. O singleton chama `_client.realtime.disconnect()` no init para evitar loop infinito de reconexão. Channels com `.subscribe()` devem ter callback `(status) => { if (status === 'CHANNEL_ERROR' \|\| status === 'TIMED_OUT') supabase.removeChannel(channel) }`. O polling `refetchInterval` serve de fallback. **TODO:** remover `realtime.disconnect()` de `client.ts` quando Realtime estiver configurado em produção (VPS) |

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
| E-mail emergency via API route (não hook) | `SMTP_*` vars são server-only. Hook client-side chama `POST /api/email/maintenance-emergency` fire-and-forget. Cron chama `sendEmail()` diretamente (já server-side). |
| nodemailer graceful fallback | `sendEmail()` nunca lança exceção — erros são `console.error`. Se `SMTP_HOST/USER/PASS` ausentes, apenas avisa no log e segue. Fluxo principal nunca é interrompido por falha de e-mail. |
| nodemailer v6 (não v8) | nodemailer v8 não tem `@types/nodemailer`. v6.9.x tem tipos via `@types/nodemailer@6.4.x`. Porém `@types/nodemailer` não instala limpo neste projeto — solução: `src/types/nodemailer.d.ts` manual. |
| `@next/bundle-analyzer` via require() condicional | `@next/bundle-analyzer` v16.2.x não existe no npm (Next.js 16 muito novo). Static import falha no build. Solução: `process.env.ANALYZE === 'true' ? require('@next/bundle-analyzer')({...}) : null`. |
| GoTrue SMTP deve usar `--force-recreate` | `docker compose restart auth` NÃO relê o `.env` — o container continua com as vars antigas. Usar `docker compose up -d --force-recreate auth` para aplicar novas vars de ambiente. |
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
| `ploomes_unit_mapping` separado de `ploomes_config` | `ploomes_config` é por unidade (1 row por unidade — UNIQUE unit_id). O mapeamento de valor Ploomes → unidade é global (mapeia qualquer valor do campo "Unidade Escolhida" para qualquer unidade do sistema). Tabela separada evita ambiguidade e é escalável para N unidades. |
| `resolveUnitId` sem early return por `unitId` | O bug original: `if (unitId) return unitId` ignorava `parsed.unitName` quando o sync era scoped a uma unidade. A nova lógica sempre prioriza o mapeamento do deal (campo "Unidade Escolhida"), e só usa `options.unitId` como filtro pós-resolução para descartar deals de outras unidades. |
