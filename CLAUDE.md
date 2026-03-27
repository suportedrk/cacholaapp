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
| `/dashboard` | `(auth)/dashboard/page.tsx` | ✅ funcional |
| `/perfil` | `(auth)/perfil/page.tsx` | ✅ funcional |
| `/admin/usuarios` | `(auth)/admin/usuarios/page.tsx` | ✅ funcional |
| `/admin/usuarios/novo` | `(auth)/admin/usuarios/novo/page.tsx` | ✅ funcional |
| `/admin/usuarios/[id]` | `(auth)/admin/usuarios/[id]/page.tsx` | ✅ funcional |
| `/admin/usuarios/[id]/permissoes` | `(auth)/admin/usuarios/[id]/permissoes/page.tsx` | ✅ funcional |
| `/eventos` | `(auth)/eventos/page.tsx` | 🚧 placeholder (Fase 1) |
| `/checklists` | `(auth)/checklists/page.tsx` | 🚧 placeholder (Fase 1) |
| `/manutencao` | `(auth)/manutencao/page.tsx` | 🚧 placeholder (Fase 1) |
| `/relatorios` | `(auth)/relatorios/page.tsx` | 🚧 placeholder (Fase 1) |
| `/configuracoes` | `(auth)/configuracoes/page.tsx` | 🚧 placeholder (Fase 1) |
| `/admin/logs` | `(auth)/admin/logs/page.tsx` | 🚧 placeholder (Fase 1) |
| `/login` | `(public)/login/page.tsx` | ✅ funcional |
| `/recuperar-senha` | `(public)/recuperar-senha/page.tsx` | ✅ funcional |

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
| Volume nomeado para PostgreSQL (não bind mount) | Bind mounts no Windows criam arquivos ocultos (`.s.PGSQL.5432.lock`, etc.) que impedem a inicialização do PostgreSQL. Named volumes resolvem isso. |
| NÃO montar migrations em `/docker-entrypoint-initdb.d` | A imagem `supabase/postgres` tem seus próprios init scripts nesse path (cria schema `auth`, roles, etc). Sobrescrever quebra tudo. Usar `/docker-entrypoint-migrations` e rodar manualmente. |
| JWTs hardcoded em `docker/kong.yml` (dev) | Kong 2.8.1 não faz substituição de env vars nativamente. A trick `eval "echo \"$(cat ...)\"` corrompe `_format_version: "1.1"` (YAML string vira número). Solução: valores literais no arquivo. |
| Senhas dos roles Supabase via `ALTER ROLE` | A imagem cria os roles `supabase_auth_admin`, `authenticator`, etc. SEM senha. Necessário rodar `ALTER ROLE ... WITH PASSWORD '...'` após o primeiro startup. |
| `_analytics` database criado manualmente | A imagem `supabase/postgres:15.8.1.084` NÃO cria o database `_analytics` automaticamente. Logflare exige esse database separado (não schema). Criar uma vez: `CREATE DATABASE _analytics`. |
| `_realtime` schema criado manualmente | Realtime v2.34.47 usa `DB_AFTER_CONNECT_QUERY: SET search_path TO _realtime`. Se o schema não existe ao conectar, o Ecto migrator falha com `invalid_schema_name`. Criar antes do startup. |
| `docker/gcloud.json` stub com RSA real | Logflare inicializa Goth (Google Auth) mesmo em modo postgres. `File.read!("gcloud.json")` é chamado em `runtime.exs:218`. Precisava de um JSON com RSA PKCS8 sintaticamente válido (gerado via `crypto.generateKeyPairSync`). Auth GCP falha graciosamente (Goth retry warnings), mas não crasha. |
| imgproxy desabilitado em dev Windows | `darthsim/imgproxy:v3.8.0` causa segfault (exit code 139) no WSL2/Windows. Provável incompatibilidade libvips/CPU. Desabilitado via `ENABLE_IMAGE_TRANSFORMATION: "false"`. Reabilitar em prod Linux nativo. |
| `RLIMIT_NOFILE` obrigatório no realtime | `run.sh` do realtime v2.34.47 usa `set -u` (unbound vars = error) e referencia `$RLIMIT_NOFILE`. Sem essa var, o script aborta imediatamente. Valor: `4096`. |
| `APP_NAME` obrigatório no realtime | `runtime.exs:78` do realtime exige `APP_NAME`. Sem ela, boot falha com `APP_NAME not available`. Valor: `realtime`. |
