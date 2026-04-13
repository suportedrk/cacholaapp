# CLAUDE.md — Memória Persistente do Cachola OS

> Leia SEMPRE antes de qualquer implementação.
> Para estado detalhado dos módulos: **`docs/MODULES.md`**
> Para decisões técnicas completas: **`docs/DECISIONS.md`**

---

## IDENTIDADE DO PROJETO

**Cachola OS** — SaaS/PWA para operação diária de Buffet Infantil: eventos, checklists, manutenção, comunicação interna, calendário e gestão de equipe.

- **Metodologia:** Vibe Coding — Claude planeja + implementa, Bruno testa + valida
- **Problema resolvido:** Informações espalhadas em WhatsApp, planilhas e cadernos

---

## STACK TECNOLÓGICA

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js | 16.2.1 |
| Language | TypeScript | 5.x strict |
| Styling | Tailwind CSS | 4.x (CSS-based config, sem tailwind.config.ts) |
| Components | shadcn/ui | 4.x (Tailwind v4 compatible) |
| Backend/DB | Supabase Self-Hosted | Community (Docker) |
| Auth | Supabase GoTrue | via @supabase/ssr |
| State server | TanStack Query | latest |
| State client | Zustand | latest |
| PWA | @ducanh2912/next-pwa | latest |
| Icons | Lucide React | latest |
| Toasts | Sonner | latest |
| Hosting dev | Docker Desktop (Windows 11) | — |
| Hosting prod | VPS Hostinger Ubuntu 24.04 + Nginx + PM2 | — |

> ⚠️ Tailwind v4: config via `@theme inline {}` em `globals.css`. Sem `tailwind.config.ts`.

---

## REPOSITÓRIO

- **GitHub:** `suportedrk/cacholaapp`
- **Branch produção:** `main` | **Branch dev:** `develop`
- **Credenciais:** Em `GITHUB_CREDENTIALS.MD` (NUNCA commitar)
- **VPS:** `ssh root@187.77.255.31` (ver `docs/SSH VPS.txt`)

---

## ESTRUTURA DE PASTAS

```
src/
├── app/
│   ├── (auth)/          # Rotas protegidas
│   ├── (public)/        # Login, recuperação de senha
│   └── api/             # Route handlers
├── components/
│   ├── ui/              # shadcn/ui customizados
│   ├── layout/          # Navbar, Sidebar, Breadcrumbs
│   ├── features/        # Componentes por módulo
│   └── shared/          # Componentes reutilizáveis
├── hooks/               # Custom hooks
├── lib/
│   ├── supabase/        # client.ts (singleton!), server.ts
│   ├── ploomes/         # client, field-mapping, sync
│   ├── utils/           # export.ts, checklist-report-pdf.ts, providers.ts
│   └── constants/       # brand-colors.ts, index.ts
├── stores/              # Zustand stores
└── types/               # database.types.ts, permissions.ts, providers.ts
```

---

## DESIGN SYSTEM

> Arquivo fonte completo: `DESIGN_SYSTEM_CLAUDE_CODE.md`

### Cores da Marca

| Token | Hex | Uso |
|-------|-----|-----|
| `--primary` | `#7C8D78` | Verde sálvia — botões primários, navbar ativa |
| `--secondary` | `#E3DAD1` | Bege quente — backgrounds, cards |
| `--background` | `#FAFAF8` | Fundo geral |
| `--card` | `#FFFFFF` | Cards, modais |

**Rampas:** `bg-brand-50…900` (verde sálvia) e `bg-beige-50…900` (bege)

### Convenções Visuais

| Item | Padrão | NÃO fazer |
|------|--------|-----------|
| Ícones em cards | `.icon-{cor}` | `bg-*-50` direto |
| Badges/pills | `.badge-{cor} border` | hex hardcoded |
| Hover em cards | `.card-interactive` | `hover:shadow-md` manual |
| Hex na UI | **Nunca** — só via tokens semânticos | — |
| Exceções (Recharts, jsPDF, e-mail) | `CHART_COLORS` / `BRAND_GREEN` de `brand-colors.ts` | — |
| Botão com link | `<Link className={cn(buttonVariants(...))}>` | `Button asChild` (não suportado) |
| Skeleton | `.skeleton-shimmer` (dark mode safe) | `animate-pulse` |
| Touch targets | wrapper `w-11 h-11` mínimo 44px | elemento pequeno sem wrapper |

### Dark Mode
- Toggle Sol/Lua no navbar → `localStorage: cachola-theme` → `'light'|'dark'|'system'`
- Anti-FOUC: script inline no `<head>`
- `prefers-reduced-motion`: desabilita transições globalmente

### Tokens Semânticos Disponíveis
- **Superfícies:** `bg-surface-primary/secondary/tertiary/inverse`
- **Texto:** `text-text-primary/secondary/tertiary/inverse/link`
- **Bordas:** `border-border-default/strong/focus`
- **Status:** `bg-status-error-bg`, `text-status-error-text` (+ success/warning/info)
- **Z-index:** `z-dropdown`(10) `z-sticky`(20) `z-overlay`(30) `z-modal`(40) `z-toast`(50) `z-tooltip`(60)
- **Sombras:** `shadow-xs/sm/md/lg/xl`

---

## BANCO DE DADOS

> DDL completo: `supabase/migrations/001_initial_schema.sql`
> Ordem de migrations: ver `docs/MODULES.md#migrations`

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários (espelha auth.users) |
| `user_permissions` | Permissões granulares por usuário |
| `events` | Eventos/festas agendadas |
| `checklists` | Checklists (type: event/standalone/recurring) |
| `checklist_items` | Itens com priority, due_at, assigned_to |
| `checklist_item_comments` | Comentários por item com foto |
| `checklist_recurrence` | Regras de recorrência |
| `maintenance_orders` | Ordens de manutenção |
| `maintenance_suppliers` | Fornecedores de manutenção |
| `maintenance_costs` | Custos com workflow de aprovação |
| `equipment` | Equipamentos/ativos |
| `service_providers` | Prestadores de serviços |
| `event_providers` | Associação festa ↔ prestador |
| `units` | Unidades do negócio |
| `unit_settings` | Configurações por unidade (JSONB) |
| `notifications` | Notificações por usuário |
| `audit_logs` | Log de auditoria |
| `ploomes_config` | Configuração da integração Ploomes |
| `ploomes_unit_mapping` | Mapeamento valor Ploomes → unidade |

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
- RLS ativo em todas as tabelas sensíveis
- Verificação via `user_permissions` (não role direto)
- `get_user_unit_ids()` e `is_global_viewer()` — funções SQL reutilizadas nas policies

---

## VARIÁVEIS DE AMBIENTE

Ver `.env.example` para lista completa.

| Variável | Onde usar |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server apenas — nunca expor |
| `NEXT_PUBLIC_SITE_URL` | Redirects OAuth (NUNCA request.url) |
| `CRON_SECRET` | Proteção dos endpoints de cron |
| `PLOOMES_USER_KEY` | API Ploomes |
| `PLOOMES_VALIDATION_KEY` | Validação de webhooks Ploomes |
| `SMTP_HOST/USER/PASS` | E-mail (Hostinger SMTP) |

---

## GIT WORKFLOW — REGRAS OBRIGATÓRIAS

```bash
# Fluxo padrão
git checkout develop && git pull origin develop
# ... fazer o trabalho ...
npx tsc --noEmit 2>&1 | grep -v "\.next"   # obrigatório antes de commitar
git add <arquivos específicos>
git commit -m "tipo(escopo): descrição"
git push origin develop

# Merge para main (somente após CI verde)
git checkout main && git pull origin main
git merge --no-ff develop -m "tipo(escopo): descrição"
git push origin main
git checkout develop
```

### Regras absolutas
- NUNCA commitar diretamente em `main`
- NUNCA mergear develop → main com CI vermelho
- NUNCA `git pull origin develop` na VPS — VPS usa sempre `main`
- SEMPRE `--no-ff` no merge
- SEMPRE tsc antes de commitar

### Deploy VPS
```bash
cd /opt/cacholaapp
git pull origin main
NODE_OPTIONS=--max-old-space-size=4096 npm run build
pm2 restart cacholaos
```

### Migrations no deploy
```bash
# Aplicar ANTES do build (na VPS via Docker)
docker exec -i supabase-db psql -U postgres -d postgres \
  < supabase/migrations/[arquivo].sql
```

---

## COMANDOS ÚTEIS

```bash
npm run dev          # Inicia app (Turbopack)
npm run build        # Build produção (webpack — necessário para PWA)
npm run lint
npx tsc --noEmit     # Type check

# Docker — Supabase local
docker compose up -d
docker compose logs -f supabase-auth
docker compose restart supabase-auth  # NÃO relê .env — usar --force-recreate para vars
docker compose up -d --force-recreate auth

# PostgreSQL local
docker compose exec supabase-db psql -U postgres -d postgres
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

1. NUNCA codificar sem planejar — gere plano e aguarde aprovação do Bruno
2. NUNCA alterar visual sem documentar — atualizar `DESIGN_SYSTEM_CLAUDE_CODE.md`
3. NUNCA quebrar o que funciona — lint + type check antes de commitar
4. NUNCA hardcode credenciais — sempre variáveis de ambiente
5. NUNCA ignore erros — trate com mensagens amigáveis em PT-BR
6. NUNCA crie componentes sem responsividade mobile-first
7. SEMPRE loading states, empty states e error states em TODA tela
8. SEMPRE transições suaves e feedback visual
9. NÃO adicionar features/refatorações além do pedido
10. NÃO criar helpers/abstrações para uso único

---

## DATA FETCHING — PADRÕES OBRIGATÓRIOS

> Evitam o bug "Skeleton Loading Infinito" (race condition session × Zustand × React Query)

| Regra | Como aplicar |
|-------|-------------|
| `enabled` em toda `useQuery` | `enabled: isSessionReady` (+ `!!id` quando depende de ID) |
| **NUNCA** `enabled: !!activeUnitId && isSessionReady` | `activeUnitId=null` é legítimo → query nunca dispara → skeleton infinito |
| `isSessionReady` | `const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)` |
| Retry | `retry: (count, err) => count < 3 && err?.status !== 401 && err?.status !== 403` |
| Páginas DEVEM tratar `isError` | Nunca só `isLoading` — sempre banner "Tentar novamente" |
| `useLoadingTimeout(isLoading)` | Safety net 12s → exibe retry em vez de skeleton eterno |
| `createClient()` é singleton | Uma instância = um lock. Múltiplas instâncias → timeouts de 5s |
| NUNCA `getUser()` em `useEffect` | Strict Mode roda 2× → 2 lock acquisitions concorrentes |
| `AppReadyGate` em `(auth)/layout.tsx` | Renderiza filhos só quando `isSessionReady && _hasHydrated` |

---

## ROTAS FUNCIONAIS

| Rota | Status |
|------|--------|
| `/dashboard` | ✅ label "Início" na sidebar (ícone Home) |
| `/bi` | 🚧 Placeholder "Em breve" — item disabled na sidebar |
| `/eventos` | ✅ |
| `/eventos/[id]` | ✅ |
| `/checklists` | ✅ |
| `/checklists/[id]` | ✅ |
| `/checklists/templates` | ✅ |
| `/checklists/recorrencias` | ✅ |
| `/checklists/minhas-tarefas` | ✅ |
| `/manutencao` | ✅ |
| `/manutencao/[id]` | ✅ |
| `/manutencao/fornecedores/[id]` | ✅ |
| `/equipamentos` | ✅ |
| `/equipamentos/[id]` | ✅ |
| `/prestadores` | ✅ |
| `/prestadores/[id]` | ✅ |
| `/relatorios` | ✅ |
| `/admin/usuarios` | ✅ |
| `/admin/unidades` | ✅ |
| `/admin/unidades/setup` | ✅ |
| `/admin/logs` | ✅ |
| `/configuracoes` | ✅ |
| `/configuracoes/integracoes/ploomes` | ✅ |
| `/configuracoes/regras` | ✅ |
| `/perfil` | ✅ |
| `/login` | ✅ |

---

## SERVIÇOS (DEV LOCAL)

| Serviço | URL |
|---------|-----|
| App Next.js | http://localhost:3000 |
| Supabase API (Kong) | http://localhost:8000 |
| Supabase Studio | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> Studio aparece como "unhealthy" no Docker — falso negativo, funciona normalmente.

---

## MÓDULOS — REFERÊNCIA RÁPIDA

> Detalhes completos: **`docs/MODULES.md`**

| Módulo | Hook principal | Componentes em |
|--------|---------------|----------------|
| Eventos | `use-events.ts` | `components/features/events/` |
| Checklists | `use-checklists.ts` | `app/(auth)/checklists/components/` ⚠️ |
| Manutenção | `use-maintenance.ts` | `components/features/maintenance/` |
| Equipamentos | `use-equipment.ts` | `components/features/equipment/` |
| Prestadores | `use-providers.ts` | `app/(auth)/prestadores/components/` |
| Ploomes | `use-ploomes-sync.ts` | `lib/ploomes/` |
| Multi-unidade | `use-units.ts` | `stores/unit-store.ts` |
| Notificações | `use-notifications.ts` | `components/layout/notification-bell.tsx` |
| Início (ex-Dashboard) | `use-dashboard.ts` | `components/features/dashboard/` |

**Tabela ploomes_deals — Dados para BI (Migration 040):**
- Tabela: `ploomes_deals` — todos os deals do pipeline (all stages, sem filtro StageId)
- Campos-chave: `ploomes_deal_id`, `ploomes_create_date`, `stage_id`, `status_id`, `unit_id`, `event_date`, `event_id`
- Status real Ploomes: 1=Em aberto, 2=Ganho, 3=Perdido
- Sync paralelo: `syncDealsForBI()` em `src/lib/ploomes/sync-deals.ts`
- Cron: executa após sync de eventos no mesmo `/api/cron/ploomes-sync`
- Paginação OData: `$skip` loop, `$top=100`, sem filtro de StageId
- RLS: `unit_id = ANY(get_user_unit_ids())` (retorna `uuid[]`, não `SETOF`)
- FieldKey data da festa: `deal_7CE92372-4576-498E-B8F6-E7A863348288`
- FieldKey unidade: `deal_A583075F-D19C-4034-A479-36625C621660`

**Módulo Início (ex-Dashboard) — Fase 1 BI:**
- Rota: `/dashboard` (label "Início" na sidebar, ícone `Home`)
- KPIs mantidos: Eventos do Mês, Leads do Mês, Checklists Pendentes
- KPIs comentados (→ BI): Taxa de Conversão, Manutenções Abertas
- Grid: `grid-cols-1 sm:grid-cols-3` (era 5 colunas)
- `NavItem` ganhou `disabled?: boolean` e `badgeText?: string`

**Módulo BI — `/bi` (Migrations 041 + 042):**
- Sidebar: item BI ativo, restrito a `REPORT_ROLES` (super_admin, diretor, gerente, financeiro)
- 4 KPI cards (grid 2×2 desktop / 1-col mobile): Taxa de Conversão, Tempo de Fechamento, Ticket Médio, Receita do Mês
- Card insight: Antecedência Média de Reserva (dias entre criação do lead e data da festa)
- Banner compacto: manutenções abertas (link → /manutencao)
- Tabela mensal expandida: Leads, Ganhos, Conversão, Receita, Ticket Médio, Fechamento, Antecedência
- RPC `get_bi_conversion_data(p_unit_id, p_months)` — Migration 041
- RPC `get_bi_sales_metrics(p_unit_id, p_months)` — Migration 042 (receita, ticket, fechamento, antecedência)
- Hook `useBIConversionData` em `src/hooks/use-bi-conversion.ts`
- Hook `useBISalesMetrics` em `src/hooks/use-bi-sales-metrics.ts`
- Ganho = status_id=2 OU stage_id=60004787 (Festa Fechada) — consistente em todos os RPCs
- avg_closing_days = ploomes_last_update − ploomes_create_date (proxy aproximado, não data exata do fechamento)
- avg_booking_advance_days = event_date − ploomes_create_date (dias antes da festa)

⚠️ **ChecklistCard da listagem:** `app/(auth)/checklists/components/checklist-card.tsx` (PREMIUM) — não confundir com `components/features/checklists/checklist-card.tsx` (legado, não usado na listagem).

---

## CREDENCIAIS DEV LOCAL

```
Admin: admin@cacholaos.com.br / Admin2026cacholaos / super_admin
VPS:   ssh root@187.77.255.31 / C@ch0l@1553#0S (ver docs/SSH VPS.txt)
```

> ⚠️ NUNCA usar em produção.
