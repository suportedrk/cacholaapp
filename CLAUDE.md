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

# Executar migration SQL manual
docker compose exec supabase-db psql -U postgres -d postgres -f /migrations/001_initial_schema.sql

# Aplicar seed
docker compose exec supabase-db psql -U postgres -d postgres -f /migrations/seed.sql

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

---

## PROXIMOS PASSOS — FASE 1

- [ ] Módulo de Eventos (CRUD completo + integração Ploomes)
- [ ] Módulo de Checklists (templates + instâncias + itens)
- [ ] Módulo de Manutenção (ordens + fotos before/after)
- [ ] Dashboard com métricas reais
- [ ] Notificações (in-app + email)
- [ ] Relatórios e exportação

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
