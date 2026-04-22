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
pos_vendas  → Módulo Vendas (Upsell/Recompra), Eventos (read), Atas — visão global (todas as unidades)
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

> **CI DEPLOY CONCORRENTE RESOLVIDO (20/04/2026):** a hipótese original (SSH timeout) estava errada — `command_timeout: 12m` e `timeout-minutes: 15` já estavam corretos. Causa raiz real: dois commits quase simultâneos em `main` disparavam runs paralelos; ambos tentavam rodar `next build` na VPS e o segundo falhava em `.next/cache/.lock` com `"Another next build process is already running"`. Fix: `concurrency` group `deploy-production` com `cancel-in-progress: false` no workflow — segundo run fica enfileirado até o primeiro terminar. Bruno não precisa mais fazer deploy manual após merges rápidos.

### Migrations no deploy
```bash
# Aplicar APÓS o deploy do código (na VPS via Docker)
docker exec -i supabase-db psql -U postgres -d postgres \
  < /opt/cacholaapp/supabase/migrations/[arquivo].sql
```

> ⚠️ **REGRA PERMANENTE:** Migrations NUNCA devem ser aplicadas manualmente na VPS antes de
> estarem commitadas e merged em `main`. Fluxo correto:
> 1. Criar migration em `develop`
> 2. Commit + push em `develop`, aguardar CI verde
> 3. Merge `develop → main` via `--no-ff`
> 4. GitHub Actions deploya o código (incluindo o arquivo .sql)
> 5. **Após deploy verde**, SSH na VPS e aplicar:
>    `docker exec -i supabase-db psql -U postgres -d postgres < /opt/cacholaapp/supabase/migrations/XXX.sql`
>
> Quebrar essa ordem causa `untracked working tree files would be overwritten by merge`
> (incidente Sub-etapas A+B da tabela `sellers`, abr/2026).

### Sync VPS → Banco Local (com anonimização LGPD)

```bash
npm run db:sync-local
# equivalente a: bash scripts/sync-db-local.sh
```

**O que faz (3 etapas):**
1. `pg_dump --schema=public` na VPS via SSH, excluindo `audit_logs` (1.3 GB) + `ploomes_webhook_log` + `ploomes_sync_log` (apenas dados) e `ploomes_order_products_backup_20260417` (tabela inteira). Dump resultante: ~35–45 MB.
2. Restore no container Docker local (`docker compose exec supabase-db psql`).
3. Executa `scripts/anonymize-local.sql` com `-v LOCAL_TOKEN=1` — anonimiza PII de clientes (nomes, e-mails, telefones, datas de nascimento) e trunca tabelas de texto livre.

**Scripts:**
- `scripts/sync-db-local.sh` — orquestrador (bash, rodar da raiz do projeto)
- `scripts/anonymize-local.sql` — SQL de anonimização com guard `\if :{?LOCAL_TOKEN}` (aborta sem a variável → protege produção se executado por engano)

**O que é preservado no banco local:**
- `owner_name` (vendedoras) — necessário para debug do BI
- `users.name`, `sellers.name` — staff interno, não são clientes
- Valores financeiros (`amount`, `deal_amount`, `discount`) — necessários para BI realista

> ⚠️ **BANCO LOCAL — REGRA DE CONFIDENCIALIDADE:** valores financeiros são mantidos **reais** para permitir debug realista do BI. Isso torna o banco local "confidencial comercial" mesmo após anonimização LGPD. **NÃO compartilhar dump**, **NÃO screenshotar BI em contextos públicos**, **NÃO expor via tunnel público**. Tratar o banco local com o mesmo cuidado de um backup de produção.

**Pré-requisito:** containers Docker locais rodando (`docker compose up -d`).

### Backup Offsite — Cloudflare R2

Backups locais (`/backup/daily|weekly|monthly`) são enviados diariamente para o bucket `cacholaos-backups` no Cloudflare R2 (storage S3-compatível, tier free 10GB, sem custo de egress).

**Script:** `/opt/scripts/backup/upload-to-r2.sh`  
**Cron:** `45 3 * * *` (3h45 — 45 min após `backup-full.sh` às 3h00)  
**Config rclone:** `/root/.config/rclone/rclone.conf` (chmod 600 — **NUNCA no repo**)  
**Log:** `/var/log/cachola-r2-upload.log`

**Retenção no R2** (lifecycle rules configuradas no bucket):
- `daily/` → 30 dias
- `weekly/` → 90 dias
- `monthly/` → 365 dias

**Disaster Recovery — Procedimento** (em caso de perda total da VPS):
1. Subir nova VPS e instalar Supabase via `docker compose` padrão
2. Instalar rclone: `curl -fsSL https://rclone.org/install.sh | bash`
3. Recriar `/root/.config/rclone/rclone.conf` com credenciais R2 (guardadas em cofre separado — **NÃO na VPS**)
4. Baixar último backup daily: `rclone copy r2:cacholaos-backups/daily/ /backup/restore/ --max-age 48h`
5. Restaurar: `gunzip -c /backup/restore/*_db.sql.gz | docker exec -i supabase-db psql -U postgres`
6. Validar counts: `SELECT COUNT(*) FROM public.events;` e `SELECT COUNT(*) FROM public.ploomes_deals;`
7. Apontar DNS de `cachola.cloud` para nova VPS

> **Testado em 20/04/2026:** restore do backup daily em container descartável (`postgres:15`) devolveu 719 events e 7.278 deals — compatível com produção.

### Dashboard de Backups — `/admin/backups` (Migration 067)

Página de observabilidade de backups, restrita a `super_admin` + `diretor`.

**Arquitetura:**
- Migration 067: tabela `backup_log` (kind × source × filename, UNIQUE INDEX para idempotência)
- `BACKUP_VIEW_ROLES = ['super_admin', 'diretor']` em `src/config/roles.ts`
- Layout guard: `src/app/(auth)/admin/backups/layout.tsx`
- API `GET /api/admin/backups` — lista todos os registros
- API `POST /api/admin/backups/[id]/download-url` — gera presigned URL R2 (15 min, via `@aws-sdk/client-s3`). Retorna 503 se `R2_ENDPOINT` não configurado (ex: ambiente local).
- Hook: `src/hooks/use-backups.ts` — `useBackups()` + `requestDownloadUrl()`
- Sidebar: item "Backups" (ícone `HardDrive`) no grupo Administração

**Variáveis de ambiente na VPS** (em `/opt/cacholaapp/.env`, **nunca no repo**):
```
R2_ENDPOINT=https://6208eacdf92f16868ea59a71cac15941.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=ec98c6fff66e92918186c162e784dcc9
R2_SECRET_ACCESS_KEY=<scoped key — ver rclone.conf na VPS>
R2_BUCKET=cacholaos-backups
```

**Scripts VPS atualizados:**
- `backup-full.sh` — chama `log_backup_row()` ao fim (sucesso) e via trap ERR (falha)
- `upload-to-r2.sh` — chama `log_r2_rows()` após cada `rclone copy` por folder
- `backfill-backup-log.sh` — popula dados históricos (executado uma vez em 20/04/2026; 16 rows inseridas)

**Workflow deploy:** `.github/workflows/deploy.yml` agora inclui `npm install` após `git pull` para garantir que novas dependências sejam instaladas na VPS antes do build.

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
| **PITFALL `useLoadingTimeout`** | Retorna `{ isTimedOut, retry }` — **NUNCA** usar sem desestruturar. `const isTimeout = useLoadingTimeout(...)` é sempre truthy (objeto) → página entra em estado de erro imediatamente. Correto: `const { isTimedOut: isTimeout } = useLoadingTimeout(isLoading)` |
| `createClient()` é singleton | Uma instância = um lock. Múltiplas instâncias → timeouts de 5s |
| NUNCA `getUser()` em `useEffect` | Strict Mode roda 2× → 2 lock acquisitions concorrentes |
| `AppReadyGate` em `(auth)/layout.tsx` | Renderiza filhos só quando `isSessionReady && _hasHydrated` |

---

## UNIT STORE — `user_units.is_default`

**Regra invariante:** cada usuário deve ter exatamente **1** linha em `user_units` com `is_default = true`. A ausência de qualquer linha com `is_default = true` causa comportamento indeterminado no boot.

### Lógica de boot (`providers.tsx`)

```
localStorage ('cachola-active-unit')
  → is_default = true
  → units[0]  (ordem indeterminada no PostgreSQL — evitar depender disso)
  → null
```

Se nenhuma das linhas tem `is_default = true`, o fallback é `units[0]` com **ordem arbitrária do banco** — o usuário pode ver uma unidade errada a cada login.

### Sintoma clínico

Usuário com múltiplas unidades reporta "não vejo eventos / vejo eventos errados" mas RLS está correto — a query de eventos filtra por `activeUnitId` client-side (`if (activeUnitId) query.eq('unit_id', activeUnitId)`). O bug é silencioso porque o erro não aparece no console.

### Diagnóstico SQL

```sql
-- Verifica se o usuário tem exatamente 1 unidade padrão
SELECT uu.user_id, u.name, uu.unit_id, un.slug, uu.is_default
FROM user_units uu
JOIN users u ON u.id = uu.user_id
JOIN units un ON un.id = uu.unit_id
WHERE uu.user_id = '<uuid>'
ORDER BY uu.is_default DESC;
```

### Fix SQL

```sql
-- Seta a primeira unidade como padrão (garante exatamente 1 true)
UPDATE user_units
SET is_default = (unit_id = (
  SELECT unit_id FROM user_units WHERE user_id = '<uuid>' ORDER BY created_at LIMIT 1
))
WHERE user_id = '<uuid>';
```

### `GLOBAL_VIEWER_ROLES`

Roles que podem selecionar "Todas as unidades" no UnitSwitcher (`activeUnitId = null`):
```ts
// src/config/roles.ts — fonte única de verdade
export const GLOBAL_VIEWER_ROLES = ['super_admin', 'diretor'] as const satisfies readonly Role[]
```
**Nunca duplicar** como array local em componentes — importar de `@/config/roles`.

---

## ROTAS FUNCIONAIS

| Rota | Status |
|------|--------|
| `/dashboard` | ✅ label "Início" na sidebar (ícone Home) |
| `/bi` | 🚧 Placeholder "Em breve" — item disabled na sidebar |
| `/vendas` | 🚧 Meu Painel ativo — Fases C/D pendentes |
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

**Módulo BI — Drill-down no Funil:**
- Clicar em qualquer stage do funil abre slide-over com lista de deals
- Hook: `useStageDrilldownDeals` — query direta em `ploomes_deals`, paginação server-side (20/pág via `.range()`), busca ilike em title+contact_name, filtro por status_id, `placeholderData: keepPreviousData`
- Componente: `StageDrilldown` (Sheet, lado direito, 512px) em `src/components/features/bi/stage-drilldown.tsx`
- Componente: `DrilldownDealCard` com badge de status, valor, data criação, event_date, link externo Ploomes
- Filtros: pills Todos/Em aberto/Ganhos/Perdidos + busca por nome (debounce 300ms)
- Link externo: `https://app10.ploomes.com/deal/{ploomes_deal_id}`
- Estado no `BIFunnel`: `selectedStage` controla qual stage está aberto no slide-over

**Módulo BI — Filtro de Período + Gráficos de Tendência:**
- Filtro de período: pills [3M] [6M] [12M] [Tudo] no header, `selectedMonths` state (default 6)
- Hooks passam `selectedMonths + 1` para conversão/vendas (+1 para mês anterior calcular variação)
- Funil NÃO é afetado (snapshot total) — apenas conversão, vendas, comparativo e tabela
- `BITrendCharts` em `src/components/features/bi/bi-trend-charts.tsx`: AreaChart (conversão) + BarChart (receita)
- Recharts: usa `useChartWidth` (ResizeObserver) + explicit `width=` (não `ResponsiveContainer`)
- Cores: hex only (`#22c55e` conversão, `#f59e0b` receita, `#94A3B8` eixos)
- Tooltip usa `var(--card)` e `var(--border)` para dark mode
- Exportação Excel respeita o período selecionado (dados já filtrados nos hooks)

**Módulo BI — Exportação Excel (Visão Geral):**
- Botão "Exportar Excel" dentro da aba "Visão Geral" em `/bi`
- Gera `.xlsx` 100% client-side via SheetJS (`xlsx` já instalado) com dynamic import
- 4 abas: Resumo (KPIs do mês atual), Desempenho Mensal, Funil do Pipeline, Comparativo Unidades
- Valores numéricos (não formatados) para cálculos no Excel; conversão como decimal com `z: '0.00%'`
- Comparativo transposto: métricas = linhas, unidades = colunas
- Nome do arquivo: `BI_Cachola_{unidade}_{YYYY-MM-DD}.xlsx`
- Utility em `src/lib/bi/export-bi-report.ts`; estado `isExporting` com spinner no botão

**Módulo BI — Dashboard de Vendedoras (Migration 051) — COMPLETO:**
- Tab "Vendedoras" em `/bi`, restrita a `super_admin` + `diretor` (`SELLERS_ROLES` check via `useAuth().profile?.role`)
- Tabs com `variant="line"` (underline); só exibida quando `canSeeSellers`; aba "Visão Geral" continua para todos
- RPC `get_bi_sellers_ranking(p_unit_id, p_period_months)` — por vendedora: leads_count, won_count, lost_count, open_count, conversion_rate, avg_ticket, total_revenue
- RPC `get_bi_seller_history(p_owner_name, p_unit_id, p_period_months)` — série mensal: leads_count, won_count, revenue, avg_days_to_close
- RPC `get_bi_seller_funnel(p_owner_name, p_unit_id, p_period_months)` — 3 buckets: em_aberto, ganhos, perdidos
- Guards: `FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'diretor')` — sem user_profiles
- Índice: `idx_ploomes_deals_owner_create_date ON ploomes_deals (owner_name, ploomes_create_date, status_id) WHERE owner_name IS NOT NULL`
- `SellersRankingTable`: sortável por qualquer coluna, avatar com iniciais + hash de cor, estrela amarela para melhor em Conversão/Ticket/Receita; colunas responsivas (Ganhos hidden sm, Ticket hidden md, Em Aberto hidden lg)
- `SellersCharts`: 2 BarCharts horizontais — Receita (`#7C8D78`) e Conversão (`#22c55e`), top 8, `useChartWidth` + ResizeObserver
- `SellerDrilldownSheet`: Sheet lateral com 4 abas pill (`variant="default"`): Histórico (AreaChart + tabela mensal), Funil (3 cards coloridos), Deals (busca + filtro + paginação server-side), Eventos (lista com link para `/eventos/{id}`)
- `SellersTab`: filtros período (3M/6M/12M/Tudo, default 6M) + toggle de unidade + botão Exportar Excel (2 abas: Ranking + Histórico Mensal via `export-sellers-report.ts`)
- Hooks: `useBISellersRanking`, `useBISellerHistory`, `useBISellerFunnel`, `useBISellerDeals` (paginação + busca + filtro), `useBISellerEvents`
- `avg_days_to_close` = `ploomes_last_update − ploomes_create_date` (proxy, consistente com BI geral)

**Módulo Atas de Reunião — `/atas` (Migration 044) — COMPLETO:**
- Tabelas: `meeting_minutes`, `meeting_participants`, `meeting_action_items`
- RLS especial: visibilidade por criador + participantes + roles elevadas (super_admin, diretor, gerente)
- `can_view_meeting(p_meeting_id UUID)` — função SECURITY DEFINER que evita dependência circular de RLS entre tabelas filhas e `meeting_minutes`
- `is_global_viewer()` cobre super_admin + diretor; gerente verificado via `user_units.role = 'gerente'` explicitamente
- Permissões: `minutes.view/create/edit/delete` — gestão completa para super_admin/diretor/gerente; somente `view` para demais roles
- Status da ata: `draft` (rascunho) | `published` (publicada)
- Roles dos participantes: `organizer` | `participant` | `absent`
- Status dos itens de ação: `pending` | `in_progress` | `done`
- Sidebar: grupo Operações, após Prestadores, ícone `FileText`, module `'minutes'`, sem `allowedRoles` (todos veem; RLS controla acesso real)
- FTS: índice GIN em `title || notes` com `portuguese` dictionary
- Notificação: e-mail ao publicar via `POST /api/minutes/notify` (fire-and-forget, só em `draft → published`)
- Export: PDF download via jsPDF client-side — `src/lib/utils/meeting-minute-pdf.ts`
- Duplicar: cria cópia como rascunho (mesmos participantes, data=hoje, sem resumo/notas/action items)
- Rotas: `/atas` (listagem), `/atas/nova`, `/atas/[id]` (detalhe), `/atas/[id]/editar`
- Hooks: `useMeetingMinutes`, `useMeetingMinuteDetail`, `useCreateMeetingMinute`, `useUpdateMeetingMinute`, `useDeleteMeetingMinute`, `useToggleActionItemStatus`, `useDuplicateMeetingMinute`
- Menu de ações (detalhe): Editar (canEdit) | Exportar PDF (sempre) | Duplicar (canCreate=isElevated) | Excluir (canDelete)

⚠️ **ChecklistCard da listagem:** `app/(auth)/checklists/components/checklist-card.tsx` (PREMIUM) — não confundir com `components/features/checklists/checklist-card.tsx` (legado, não usado na listagem).

**Pré-reserva Ploomes — Migrations 046/048/049 — COMPLETO:**
- VIEW `pre_reservas_ploomes_view` derivada de `ploomes_deals`: `status_id=1` + `stage_id IN (60004416 Fechamento, 60056754 Assinando Contrato)` + `event_date IS NOT NULL` (migration 048)
- `ploomes_deals` ganhou colunas `start_time TIME` + `end_time TIME` (migration 046 parte da PR Diretoria, depois migration 048 parte 1)
- `sync-deals.ts` extrai horários via `parseDeal()` (FieldKeys 30E82221... start / FD135180... end)
- Cor pink (`bg-pink-50/100`, `border-pink-200`, `text-pink-700`), ícone `Sparkles`
- Read-only — click abre `app10.ploomes.com/deal/{id}` em nova aba (sem modal interno)
- Fallback visual "Horário a definir no Ploomes" quando `start_time` ausente
- Hook: `usePreReservasPloomes(startDate, endDate)` em `src/hooks/use-pre-reservas-ploomes.ts`
- Card: `PreReservaPloomesCard` em `src/components/features/events/pre-reserva-ploomes-card.tsx`
- `/eventos`: chip pink exclusivo (não toggle) + filtro `activeFilter === 'ploomes'` que oculta eventos regulares
- Calendário `/inicio`: pills/dots pink + toggle "Pré-reserva Ploomes" (localStorage `prePloomes`)
- `CalendarPreReserva.source`: `'diretoria'|'ploomes'`; `created_by` agora opcional; campos extras: `ploomes_url`, `deal_amount`, `stage_name`
- Backfill executado em produção: 17/17 deals com start_time/end_time preenchidos via `scripts/backfill-deal-times.ts`

**Detecção de conflitos PR — Migration 049 — COMPLETO:**
- RPC `get_pre_reserva_conflicts(p_unit_id UUID)` — detecta conflitos server-side (sem limitação de paginação client-side)
- 4 UNIONs: PR Diretoria×Evento, PR Ploomes×Evento, PR Diretoria×PR Ploomes, PR Ploomes×PR Ploomes
- Retorna: `pr_id TEXT`, `pr_source TEXT`, `conflict_with_id TEXT`, `conflict_with_type TEXT`, `conflict_date DATE`, `gap_minutes INTEGER` (negativo=sobreposição, 0..119=intervalo<2h)
- Hook: `usePreReservaConflicts()` + `usePreReservaConflictSets()` em `src/hooks/use-pre-reserva-conflicts.ts`
- `usePreReservaConflictSets` retorna mesma forma `PRConflictResult` — substitui `computePreReservaConflicts` (client-side)
- `/eventos`: chips "Conflito de horário" e "Intervalo < 2h" agora contam PRs de TODAS as páginas (não só a carregada)
- Filtro de conflitos: apenas `conflict_date >= hoje` (passados ignorados nos hooks `useOverlappingEventIds`, `useShortGapEventIds`, `usePreReservaConflictSets`)
- `/eventos`: chip "Pré-venda" emerald exclusivo filtra só Diretoria pre-reservas (`activeFilter === 'diretoria'`)
- Produção validada: 7 conflitos em Pinheiros (6 Ploomes + 1 Diretoria), 1 em Moema — todos sobreposição

**Responsável/Vendedora (owner) — Migration 050 — COMPLETO:**
- Tabelas: `ploomes_deals.owner_id INTEGER`, `ploomes_deals.owner_name TEXT`, `events.owner_id INTEGER`, `events.owner_name TEXT` com índices parciais
- `sync.ts` + `sync-deals.ts`: `$expand=Owner($select=Id,Name,Email)` — extrai `deal.Owner?.Name` e `deal.OwnerId`
- VIEW `pre_reservas_ploomes_view` recriada com coluna `owner_name` (DROP + CREATE na migration)
- `CalendarEvent`, `EventForList`, `CalendarPreReserva`: tipagem `owner_name: string | null`
- `EventCard`: exibe vendedora com ícone `User` abaixo do `client_name`
- `PreReservaPloomesCard`: exibe `owner_name` no bloco de metadados
- `CalendarView`: `title` do pill inclui owner; expanded day view exibe owner abaixo do nome
- `/eventos`: dropdown "Vendedora" (sem persistência) extrai nomes dos eventos carregados + PRs
- `/inicio` (calendar): dropdown "Vendedora" acima do calendário, filtra `calEvents` e `calPreReservas`
- Backfill executado em produção: 7218 ploomes_deals com owner_name + 13 events propagados via `scripts/backfill-owner.ts`

**Tabela `sellers` — Migrations 053 + 054 — COMPLETO:**
- Tabela: `sellers` — cadastro mestre de vendedoras; fonte da verdade para filtros ativo/inativo no BI
- Campos-chave: `owner_id INT UNIQUE` (FK Ploomes), `name`, `status` (`active`|`inactive`), `hire_date`, `termination_date`, `primary_unit_id`, `notes`, `photo_url`, `is_system_account`
- Seed auto-populado de `ploomes_orders.owner_id` distintos; `hire_date = MIN(ploomes_create_date)` como proxy
- Bruno Motta marcado `inactive`, `termination_date='2025-12-31'` (ex-gerente Pinheiros, desligado dez/2025)
- RLS: SELECT todos autenticados; INSERT/UPDATE `super_admin`+`diretor`; DELETE apenas `super_admin`
- Campo `is_system_account BOOLEAN` (default false): marca contas Ploomes que não são vendedoras reais (bots/automações). `Contador de negócios` (owner_id=10045234) seedado com `is_system_account=true`. BI filtra `is_system_account=false` no ranking.
- Types em `src/types/seller.ts`: `Seller`, `SellerFormInput`, `SellerStatus`
- Trigger `trg_auto_insert_seller` (Migration 054): AFTER INSERT em `ploomes_orders` → chama `auto_insert_seller_from_order()` SECURITY DEFINER (owner: `supabase_admin`) → ON CONFLICT DO NOTHING
- Tela `/configuracoes/vendedoras`: CRUD de edição (sem criação manual); sidebar grupo Administração, restrita a `ADMIN_ROLES`; filtros Todas/Ativas/Inativas/Sistema; sheet lateral com `termination_date` condicional (só quando inativo) e `is_system_account` só para `super_admin`
- Hooks: `useSellers()` + `useUpdateSeller()` em `src/hooks/use-sellers.ts`
- Migration 055 + aba **"Vendas Realizadas (Orders)"** no BI: 3 RPCs guardados (super_admin+diretor+gerente+financeiro): `get_bi_sales_kpi`, `get_bi_sales_ranking` (avg_monthly_revenue normalizado por meses trabalhados respeitando hire_date/termination_date), `get_bi_seller_orders` (drill-down). Aba "Responsáveis por Deal" renomeada para **"Atendimento (Deals)"** — conteúdo intocado. Período default 12M, pills 3M/6M/12M/Tudo. Default filtra `status=active AND is_system_account=false`; toggle "Incluir histórico" expõe todas. Rodapé "Dados a partir de outubro/2024" apenas quando período=Tudo. Drill-down via sheet (sem página dedicada). `canSeeVendas = BI_VENDAS_ROLES` (inclui gerente + financeiro).

**Débito 1 (roles BI consolidadas) — Migration sem número, commit separado:**
- `src/config/roles.ts`: fonte única de verdade para constantes BI e vendedoras
- Exporta: `BI_ACCESS_ROLES`, `BI_ATENDIMENTO_ROLES`, `BI_VENDAS_ROLES`, `SELLERS_MANAGE_ROLES` (`as const satisfies readonly Role[]`) + helper `hasRole<T>(role, allowed): role is T[number]`
- `nav-items.ts`: remove `REPORT_ROLES` local → usa `[...BI_ACCESS_ROLES]` em BI e Relatórios
- `bi/page.tsx`: remove `SELLERS_ROLES`/`VENDAS_ROLES` → `hasRole(profile?.role, BI_ATENDIMENTO_ROLES/BI_VENDAS_ROLES)`
- Outras constantes (atas, admin, manutenção) ficam locais → **Débito 3** (PR futuro)

**Migration 056 + painel "Vendas por Categoria de Produto" — Sub-etapa D:**
- 3 RPCs SECURITY DEFINER (super_admin+diretor+gerente+financeiro): `get_bi_category_kpi`, `get_bi_category_ranking`, `get_bi_category_drilldown`
- Fonte: `ploomes_order_products`; FK local = `order_id`; campo valor = `total`; campo categoria = `group_name`; campo produto = `product_name`
- Joins diretamente por `pop.owner_id = s.owner_id` (sem passar por `ploomes_orders`) — usa colunas desnormalizadas `pop.unit_id`, `pop.order_date`
- 6 categorias distintas (3 × PINHEIROS, 3 × MOEMA); 0 NULL; cobertura 100% (1538/1538 orders) — rodapé de cobertura não implementado
- KPI retorna: `total_categories`, `top_category_name`, `top_category_revenue`, `total_items`
- Drilldown: UNION ALL de produtos (kind='product') + top 5 vendedoras (kind='seller'); `rank_position` dentro de cada kind
- Componentes em `src/components/features/bi/`: `vendas-por-categoria-section.tsx` (KPIs + chart horizontal + tabela + toggle + alerta cross-unit), `category-drilldown-sheet.tsx` (produtos paginados + top 5 sellers)
- Hooks: `useBiCategoryKpi`, `useBiCategoryRanking`, `useBiCategoryDrilldown` em `src/hooks/use-bi-category.ts`
- Seção renderizada ABAIXO do ranking de vendedoras, dentro da aba "Vendas Realizadas (Orders)"
- Toggle "Incluir histórico completo" da aba afeta o painel de categorias (mesmas props `includeInactive`)

**Migration 057 — Sub-etapa D.1 — Normalização de categorias + cross-unit:**
- `normalize_product_category(TEXT) IMMUTABLE`: strips ` Cachola PINHEIROS/MOEMA` → "Pacotes", "Adicionais", "Upgrades"
- `family_name` 100% populado (3096/3096), sem ALTER TABLE / sync / backfill necessários
- `get_bi_category_ranking` ganhou `p_group_by_unit BOOLEAN DEFAULT FALSE` e `unit_family TEXT` no RETURNS TABLE
- Toggle pill "por unidade" no header da seção (session state): quando ON, 6 linhas com `unit_family`; composite React key `category|unit_family` evita duplicatas
- `get_bi_category_cross_unit(start, end, include_inactive)`: 50 itens / R$571k cross-unit (49 Pinheiros×MOEMA + 1 Moema×PINHEIROS)
- Card amber de alerta aparece quando cross-unit > 0; botão "Ver detalhes" abre sheet inline com tabela (unidade do pedido × família × itens × receita)
- Nota metodológica no rodapé da aba: diferença faturamento negociado vs preço de tabela dos produtos
- DROP FUNCTION IF EXISTS necessário antes de CREATE (RETURNS TABLE schema changes)
- Índice: `idx_ploomes_order_products_family ON ploomes_order_products(family_name)`
- Hook: `useBiCategoryCrossUnit` adicionado em `src/hooks/use-bi-category.ts`

**Sync-Fix: ploomes_order_products — ghost rows (commit 8b8c589, 2026-04-17) — COMPLETO:**
- **Problema:** Ploomes reatribui `ploomes_product_id` ao editar uma Order → upsert por `ploomes_product_id` acumulava linhas-fantasma sem deletar as antigas → `SUM(products.total)` excedia `orders.amount`
- **Impacto:** 3 orders Type B (601462305, 601463229, 601463321), 6 linhas-fantasma, R$70.2k duplicados; 8 orders Type A (Taxa de Rolha × 2, `sum = amount` exato) são intencionais e preservados
- **Fix em `src/lib/ploomes/sync-orders.ts`:** `DELETE FROM ploomes_order_products WHERE order_id = X` antes do loop de upsert de produtos; `continue` em caso de erro no DELETE para evitar estado parcial
- **Cleanup manual:** backup `ploomes_order_products_backup_20260417` (3113 linhas); DELETE 6 linhas em transação; pós-commit diff = R$0,00 nas 3 orders; tabela ficou com 3107 linhas
- **Investigação (read-only):** R$843k excesso total = R$767k descontos legítimos (419 orders, `amount < sum`) + R$75k duplicação real; timestamps confirmaram 2 runs de cron em intervalos de 30–883 min como causa do Type B
- **Backup:** `ploomes_order_products_backup_20260417` pode ser dropada após validação do primeiro cron pós-deploy

**Módulo Vendas — Fase A (Migration 058) — FUNDAÇÃO COMPLETA:**
- Rota: `/vendas`, restrita a `VENDAS_MODULE_ROLES` (super_admin, diretor, gerente, vendedora)
- Sidebar: item "Vendas" com ícone `TrendingUp`, grupo principal (após BI)
- `users.seller_id UUID FK → sellers(id) ON DELETE SET NULL` — vínculo entre usuário e vendedora
- Índices: `idx_users_seller_id` + `uniq_users_seller_id_not_null` (partial, onde NOT NULL)
- Roles: `VENDEDORA_ROLES`, `VENDAS_MODULE_ROLES`, `VENDAS_MANAGE_ROLES` em `src/config/roles.ts`
- `User` type em `database.types.ts` inclui `seller_id: string | null`
- `ROUTES.vendas = '/vendas'` em `src/lib/constants/index.ts`
- Página `/vendas`: 3 tabs; alerta quando vendedora sem seller_id
- Convite de usuário (`/admin/usuarios/novo`): campo "Vincular à vendedora" obrigatório quando role=vendedora; hook `useAvailableSellersForInvite()` filtra sellers ativas + não-sistema + sem usuário vinculado
- API `POST /api/admin/users`: valida `seller_id` obrigatório + servidor valida seller existe, ativa, não-sistema, sem usuário já vinculado; persiste via `UPDATE users SET seller_id`
- `AuthBootstrap`: `console.warn` quando vendedora logada não tem `seller_id`
- TODO em `/configuracoes/vendedoras/vendedoras-client.tsx` para coluna "Usuário vinculado" (Fase futura)
- Próximas fases: C (Upsell), D (Recompra)

**Módulo Vendas — Fase B (Migration 059) — MEU PAINEL COMPLETO:**
- Migration 059: 3 RPCs `get_vendas_my_kpis`, `get_vendas_daily_revenue`, `get_vendas_ranking` — guarda `super_admin, diretor, gerente, vendedora`
- `get_vendas_my_kpis`: período atual + anterior em uma chamada (p_prev_start/p_prev_end); vendedora → força próprio seller_id; gestor → NULL agrega todas
- `get_vendas_daily_revenue`: série diária com `cumulative_revenue` via window function `SUM(SUM(...)) OVER (ORDER BY date)`
- `get_vendas_ranking`: apenas sellers ativas + não-sistema; acessível por vendedoras (sem drill-down no UI)
- 5 pills de período: Mês atual, Mês anterior, 3M, 6M, 12M — `buildVendasPeriods()` em `_components/shared/period-types.ts`
- 5 KPI cards com delta badge vs período anterior: Faturamento, Deals ganhos, Orders, Ticket médio, Conversão
- Gráfico de receita acumulada: Recharts AreaChart com `useChartWidth` local + ResizeObserver
- RankingTable: sortável; linha da vendedora logada destacada (`bg-brand-50`); drill-down via `SellerOrdersDrilldownSheet` existente (apenas gestores)
- `SellerSelector` dropdown (gestores): "Todas (agregada)" = NULL; selecionar vendedora filtra KPIs + gráfico
- `MetaPlaceholder`: card estático "Em breve — aguardando integração Ploomes"
- `MeuPainelClient`: orquestrador com `useLoadingTimeout` 12s + error state com botão retry
- `useVendasMyKpis`, `useVendasDailyRevenue`, `useVendasRanking` em `src/hooks/use-vendas.ts`
- Fase B hotfix (Migration 060): `get_vendas_ranking` estendido com `deals_won` + `conversion_rate` via LEFT JOIN em `ploomes_deals`; ranking com 7 colunas sortáveis; seller-selector label fix (span data-slot — pitfall @base-ui)

**Módulo Vendas — Fase C.1 (Migration 061) — INFRA UPSELL COMPLETA:**
- Migration 061: `ploomes_contacts` (espelho Ploomes), `upsell_contact_log` (log de contatos), extend `ploomes_config` com `cliente_cachola_field_key` + `cliente_cachola_sim_option_id`
- `ploomes_contacts`: `ploomes_contact_id BIGINT UNIQUE`, `name`, `email`, `phones JSONB`, `birthday`, `next_anniversary`, `previous_anniversary` (campos diretos da API), `owner_id/name`, `cliente_cachola BOOLEAN`; RLS SELECT para `VENDAS_MODULE_ROLES`; trigger `update_updated_at`
- `upsell_contact_log`: `event_id FK events`, `seller_id FK sellers`, `contacted_by FK users`, `outcome CHECK (tentou|recusou|vendeu_adicional|vendeu_upgrade|outro)`, `reopened_at`; `UNIQUE INDEX uniq_upsell_log_active_per_event ON (event_id) WHERE reopened_at IS NULL`; RLS SELECT/INSERT/UPDATE com políticas granulares
- **API Ploomes OtherProperties:** retorna 403 com a user_key disponível — impossível filtrar por "Cliente Cachola ?" campo custom diretamente
- **Estratégia de sync:** busca e-mails únicos de `ploomes_deals` e faz lookup individual por `Email eq 'xxx'` na API Ploomes (fallback por nome); `NextAnniversary`/`PreviousAnniversary` são campos diretos do Contact
- `scripts/ploomes-sync-contacts.ts`: `--mode=full` (todos os deals), `--mode=incremental` (deals desde MAX(synced_at)), `--mode=retry` (emails ainda não sincronizados); retry automático em 429 com wait 65s; rate limit 600ms (Ploomes limita 120 req/min)
- `scripts/discover-cliente-cachola-fieldkey.ts`: script de descoberta — FieldKey=`contact_E2B745FB-3675-4C1D-9A14-7EBE88815C10`, TypeId=10 (checkbox), `BigIntegerValue eq 1` para Sim
- **Backfill produção:** 703/704 contatos sincronizados (704 e-mails únicos em ploomes_deals; 1 duplicado detectado); 14 com birthday; breakdown por owner: Bruno Motta 322, Raphaela 171, Carolina 104, Bruna 82
- **ploomes_config:** `cliente_cachola_field_key` e `cliente_cachola_sim_option_id=1` configurados em produção
- **Cron:** `*/30 * * * *` → `npx tsx scripts/ploomes-sync-contacts.ts --mode=incremental` → log `/var/log/cachola/sync-contacts.log`
- **sync incremental:** usa `ploomes_update_date` (não create_date) para capturar deals com contato atualizado

**Módulo Vendas — Fase C.2 (Migration 062) — UI UPSELL COMPLETO:**
- Migration 062: `ALTER upsell_contact_log ADD COLUMN captured_from_carteira_livre BOOLEAN DEFAULT false`; `email_sent_log` (dedup diário: UNIQUE ON email_type + recipient_user_id + sent_date); 3 RPCs SECURITY DEFINER (super_admin+diretor+gerente+vendedora)
- RPC `get_upsell_opportunities(p_seller_id, p_show_contacted, p_source)`: janela 30–40 dias, status='confirmed', filtro option B (NOT (tem_adicional AND tem_upgrade)), join via LOWER(TRIM(contact_email))=pc.email; suporte Carteira Livre (owner não em sellers ativos); retorna `missing_categories TEXT[]`
- RPC `get_upsell_count_for_user()`: usa auth.uid(), retorna {my_count, carteira_livre_count, total}; filtra só não contatados para badge
- RPC `get_upsell_popular_addons(p_package_name)`: co-ocorrência de Adicionais/Upgrades com um pacote, top 10
- **Carteira Livre:** contatos cujo owner_id não está em sellers ativos (inclui Bruno Motta 325 contatos + orphans Vitória/Vinícius). INSERT usa capturer's seller_id + `captured_from_carteira_livre=true`
- 8 componentes em `src/app/(auth)/vendas/_components/upsell/`: `index.tsx` (UpsellTab), `upsell-source-tabs.tsx` (pills Minhas/Carteira Livre/Todas + contagens), `upsell-filters.tsx` (toggle incluir contatadas + count), `upsell-card.tsx` (evento+contato+chips categoria+ações), `carteira-livre-banner.tsx`, `contact-dialog.tsx` (outcome select + notes), `reopen-dialog.tsx`, `popular-addons-hint.tsx`
- Hook `src/hooks/use-upsell.ts`: `useUpsellOpportunities`, `useUpsellCount`, `useUpsellPopularAddons`, `useLogUpsellContact`, `useReopenUpsellContact`; invalidate `['upsell-opportunities']` + `['upsell-count']` após mutações
- `vendas/page.tsx`: `useSearchParams()` em `<Suspense>` — suporte a `?tab=upsell` (link do e-mail)
- `sidebar.tsx`: `useUpsellCount().total` injetado no badge do item `/vendas`
- `scripts/email-upsell-daily.ts`: `--dry-run` flag; `--sample` flag (gera HTML de amostra sem DB/SMTP); dedup via `email_sent_log`; cron `0 11 * * *` (08h BRT) — **comentado na VPS aguardando cadastro das vendedoras**; e-mail com tabela de oportunidades + CTA `/vendas?tab=upsell`
- **Dados produção (18/04/2026):** 7 oportunidades ativas — 4 Bruna Jana, 2 Carolina Warzée, 1 Carteira Livre (Maria 2 anos — Bruno Motta inativo)
- **Próxima fase: C.3** — oportunidades de recompra (deals ganhos há 6–18 meses)

**Módulo Vendas — Fase D.1 (Migration 063) — INFRA RECOMPRA COMPLETA — AGUARDA APROVAÇÃO CHECKPOINT:**
- Migration 063: `ALTER ploomes_deals ADD aniversariante_birthday DATE + synced_at`; `ALTER ploomes_config ADD aniversariante_birthday_field_key` (setado para `deal_13506031-C53E-48A0-A92B-686F76AC77ED`); `CREATE TABLE recompra_contact_log` (chave lógica: email+birthday+recompra_type, UNIQUE WHERE reopened_at IS NULL, RLS select/insert/update)
- 3 RPCs SECURITY DEFINER (super_admin+diretor+gerente+vendedora): `get_recompra_aniversario_proximo(seller_id, show_contacted, source, days_ahead=90)` — Ajuste 2 (precedência por ref_date DESC), Ajuste 3 (group por email+birthday), Feb-29→Feb-28; `get_recompra_festa_passada(seller_id, show_contacted, source)` — Ajuste 4 (exclui email com qualquer deal status=1/2 nos últimos 10 meses); `get_recompra_count_for_user()`
- `sync-deals.ts`: `extractDealDateTimes` → `extractDealFields` (add `aniversariante_birthday: parsed.birthdayDate ?? null`); ambos `syncDealsForBI` e `syncSingleDealToBI` atualizados
- `database.types.ts`: `aniversariante_birthday` + `aniversariante_birthday_synced_at` adicionados em `PloomesDealsRow`
- **Backfill produção (18/04/2026):** 7249 deals upsertados; 490/698 deals ganhos com birthday (70.2%)
- **Checkpoint dados produção:** 131 aniversários nos próximos 90 dias; 52 festas passadas prontas para recontato; data real validada (ex.: Cristiane Sakumoto Cotait — aniversário HOJE)
- **Próxima fase: D.2** — UI Recompra (cards, badge, e-mail) — BLOQUEADA até aprovação do checkpoint

**Módulo Vendas — Fase D.2 (sem migration) — UI RECOMPRA — COMPLETO:**
- `src/hooks/use-recompra.ts`: `useRecompraAniversario`, `useRecompraFestaPassada`, `useRecompraCount`, `useLogRecompraContact`, `useReopenRecompraContact`
- 7 componentes em `src/app/(auth)/vendas/_components/recompra/`: `index.tsx` (RecompraTab), `recompra-type-tabs.tsx` (pills Aniversário/Festa Passada + counts), `recompra-card-aniversario.tsx` (chips 🔥0-7d/⚡8-30d/🎂31-60d/📅61-90d), `recompra-card-festa.tsx` (chip "Há N meses"), `carteira-livre-recompra-banner.tsx` (texto extra sobre clientes de vendedoras inativas), `recompra-contact-dialog.tsx`, `recompra-reopen-dialog.tsx`
- `vendas/page.tsx`: substituído PlaceholderTab por RecompraTab; `?tab=recompra` suportado
- `sidebar.tsx`: badge = `upsellCount.total + recompraCount.total` (consolidado)
- `scripts/email-vendas-daily.ts`: e-mail consolidado (Upsell + Aniversários + Festas Passadas); `--dry-run` e `--sample` flags; `email_type='vendas_daily'`; cron **comentado** aguardando cadastro das vendedoras
- RPC já correto (0-90 dias sem lower bound) — sem nova migration necessária

**Checklist Comercial — Fase 1 / Fundação (Migration 064) — COMPLETO:**
- Migration 064: 4 tabelas (`commercial_task_templates`, `commercial_template_items`, `commercial_tasks`, `commercial_task_completions`) + triggers + `can_view_commercial_template` + `can_view_commercial_task` + `apply_commercial_template` SECURITY DEFINER + dedup index atualizado para incluir `commercial_task_overdue`; 14 RLS policies
- Hooks em `src/hooks/commercial-checklist/`: `use-commercial-templates.ts`, `use-commercial-template-items.ts`, `use-commercial-tasks.ts`, `use-apply-template.ts`
- Rotas: `/vendas/checklist` (Minhas Tarefas), `/vendas/checklist/equipe` (Equipe Comercial), `/vendas/checklist/templates`, `/vendas/checklist/templates/[id]`
- Todas as 4 páginas têm guard `hasRole` com `COMMERCIAL_CHECKLIST_ACCESS_ROLES` (Minhas Tarefas) ou `COMMERCIAL_CHECKLIST_MANAGE_ROLES` (demais)
- Sidebar: "Checklist Comercial" com 4 sub-itens via `children` em `nav-items.ts`; badge sidebar consolidado Upsell+Recompra (não alterado)
- Cron `check-alerts`: seção 4 notifica `commercial_task_overdue` para tarefas em atraso
- `src/config/roles.ts`: `COMMERCIAL_CHECKLIST_MANAGE_ROLES` + `COMMERCIAL_CHECKLIST_ACCESS_ROLES` (super_admin, diretor, gerente [+ vendedora para Access])
- Débitos técnicos resolvidos na Fase 1.5 (commits ca29c0e + 2b18336): (a) archive/reactivate UI — `COMMERCIAL_CHECKLIST_ARCHIVE_ROLES` em `roles.ts`, botão Archive/ArchiveRestore na lista e na detalhe, banner amber quando inativo, "Aplicar" desabilitado; (b) key counter-based `new-${formInstance}` corrige estado residual do form; (c) sidebar `hasActiveChild` usa `pathname.startsWith(c.href + '/')` para robustez em sub-rotas

**Checklist Comercial — Fase 2 (Migration 065) — Jornada do Negócio via Ploomes — COMPLETO:**
- Migration 065: tabela `commercial_stage_automations` (unit_id nullable, stage_id BIGINT, template_id FK, active); ALTER `commercial_tasks` ADD `automation_deal_id BIGINT`, `automation_stage_id BIGINT`, `automation_source_id UUID`; 4 RLS policies; trigger function `trg_stage_automation_fn()` SECURITY DEFINER + 2 triggers em `ploomes_deals`; RPC `trigger_stage_automation(p_ploomes_deal_id BIGINT)` para disparo manual; RPC `get_ploomes_stages()` para UI
- **Trigger pattern (Postgres, não TS):** AFTER INSERT + AFTER UPDATE OF stage_id em `ploomes_deals`; WHEN (NEW.stage_id IS DISTINCT FROM OLD.stage_id); EXCEPTION WHEN OTHERS isola falhas por automação
- **Idempotência:** `IF EXISTS (automation_source_id=X AND automation_deal_id=Y AND status NOT IN ('completed','cancelled'))` — pula se task ativa já existe para o par (automação, deal)
- **Resolve vendedora:** `sellers.owner_id = ploomes_deals.owner_id → users.seller_id = sellers.id`; skip se owner_id IS NULL ou sem usuário vinculado
- **AVISO DE MASSA:** ao fazer carga massiva em `ploomes_deals` (backfill, re-sync), desativar triggers temporariamente: `ALTER TABLE ploomes_deals DISABLE TRIGGER trg_stage_automation_update, trg_stage_automation_insert;` ... `ENABLE TRIGGER ...`
- **Decisão arquitetural (Fase 2.5):** Idempotência mantida como `IF EXISTS` batch-level (automação+deal), NÃO via UNIQUE INDEX por row. Motivo: templates multi-item criam N tasks com mesmos `(automation_deal_id, automation_stage_id, template_id)` — UNIQUE INDEX bloquearia inserção a partir do 2º item (ON CONFLICT DO NOTHING silencioso). Trade-off aceito: IF EXISTS pode ter race condition teórica em cargas paralelas massivas (improvável no padrão de uso). UNIQUE INDEX por row descartado; Migration 066 foi usada para filtro status_id (Fase 2.6).
- **Bloqueio para happy path em produção:** `trigger_stage_automation` e trigger Postgres exigem `users.seller_id` vinculado a um seller ativo. Enquanto as vendedoras não tiverem usuários vinculados via `/admin/usuarios/novo`, a automação cria 0 tasks para qualquer deal.
- **Fase 2.6 — filtro status_id (Migration 066) — COMPLETO:** `trg_stage_automation_fn` e `trigger_stage_automation` agora fazem early-exit com `RAISE NOTICE` quando `status_id IN (2, 3)` (Ganho/Perdido). Filtro posicionado após guards de NULL, antes do loop de automações. Testado em produção: deal aberto → 1 task criada ✅; deal ganho → 0 tasks + NOTICE ✅; deal perdido → 0 tasks + NOTICE ✅.
- **Débito arquitetural — lógica duplicada:** `trg_stage_automation_fn` (trigger) e `trigger_stage_automation` (RPC) compartilham lógica idêntica. Futuro refactor: trigger chama `PERFORM trigger_stage_automation(NEW.ploomes_deal_id)` internamente, concentrando a lógica no RPC. Não urgente após 066 ter sincronizado ambas.
- Hooks: `use-commercial-automations.ts` (CRUD), `use-ploomes-stages.ts` (RPC `get_ploomes_stages`)
- `CommercialTask` type ganhou `automation_deal_id`, `automation_stage_id`, `automation_source_id`; SELECT queries de ambas as funções incluem os novos campos
- `task-card.tsx`: badge "Automática" (ícone Zap, badge-amber) + link ExternalLink para `app10.ploomes.com/deal/{automation_deal_id}` quando `source === 'automation'`
- Rota `/vendas/checklist/automacoes`: CRUD de regras; guard `COMMERCIAL_CHECKLIST_MANAGE_ROLES`; delete restrito a `COMMERCIAL_CHECKLIST_ARCHIVE_ROLES`
- Sidebar: 4º filho "Automações" com ícone `Zap`, `allowedRoles: [...COMMERCIAL_CHECKLIST_MANAGE_ROLES]`

---

## REGRA DE PROCESSO (aprendizado Fase C.2)

Antes de reportar fase concluída, Claude Code deve pedir screenshot visual
ao Bruno e aguardar confirmação. Reportar "screenshot confirmou" sem
screenshot real no chat = violação de processo. 3 bugs passaram em C.2
por pular essa validação.

---

## REGRA DE VALIDAÇÃO PÓS-DEPLOY (aprendizado sessão backup/bi)

**TypeScript limpo + curl 200 NÃO é validação suficiente para bugs de estado de UI.**

Ao fazer fix de loading/error state em qualquer página (ex.: `useLoadingTimeout`,
`isError`, skeleton, error banner), a validação obrigatória é:

1. Após deploy, abrir a rota em **janela anônima** logada como super_admin
2. Confirmar que a tela renderiza o conteúdo esperado (KPIs, tabela, gráficos)
3. Só então reportar o fix como resolvido

Motivação: `/admin/backups` e `/bi` tinham o mesmo bug (`useLoadingTimeout` sem
desestruturar). O fix do `/admin/backups` foi validado visualmente e funcionou. O `/bi`
ficou quebrado por semanas porque não houve validação — a suposição "o código está
correto" não substituiu o olho humano na tela.

**Corolário:** se após deploy a tela ainda mostrar erro, reportar ao Bruno antes de
assumir que o fix resolveu.

---

## REGRA SUPABASE SSR — storageKey NO MIDDLEWARE

**Nunca usar o hostname completo no `storageKey` do `createServerClient`.**

`@supabase/supabase-js` deriva a chave do cookie como:
```ts
`sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
// 'api.cachola.cloud' → 'sb-api-auth-token'
```

O middleware e o `server.ts` **DEVEM** usar o mesmo formato. Usar o hostname completo causa mismatch silencioso:
- Browser armazena: `sb-api-auth-token`
- Middleware busca: `sb-api.cachola.cloud-auth-token` ← não acha → redirect loop

**Padrão correto em `proxy.ts` e `server.ts`:**
```ts
// ✅ CORRETO — split para coincidir com o client
const browserHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
auth: { storageKey: `sb-${browserHostname}-auth-token` }

// ❌ ERRADO — causa loop de login em produção com domínio multi-parte
const browserHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
```

Este bug só aparece em produção quando `NEXT_PUBLIC_SUPABASE_URL` tem domínio multi-parte (ex: `https://api.cachola.cloud`). Em dev com `http://localhost:8000`, `hostname = 'localhost'` e o split não muda nada — por isso o bug fica invisível no ambiente local.

Sintoma: login via email/senha retorna 200 no GoTrue mas imediatamente redireciona de volta ao `/login` (GET `/?_rsc=...` → 307 → `/login`).

---

## REGRA NEXT.JS APP ROUTER — GUARD DE ROLE EM LAYOUT

Ao testar se um layout guard (`requireRoleServer`) está funcionando:

- O redirect de um Server Component nested dentro de Client Component wrappers
  chega ao browser como payload `NEXT_REDIRECT`, **não** como HTTP 307
- Isso significa que `curl -I /rota-protegida` pode retornar 200 mesmo com o guard ativo
- A única validação real é **abrir no browser logado com a role errada** e confirmar /403

Padrão correto de guard em layout (Server Component):
```ts
// src/app/(auth)/modulo/layout.tsx
import { requireRoleServer } from '@/lib/auth/require-role'
import { MODULO_ROLES } from '@/config/roles'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRoleServer(MODULO_ROLES)  // redirect('/403') se insuficiente
  return <>{children}</>
}
```

---

## DÉBITOS TÉCNICOS

- **Sellers órfãos:** sync de sellers deve garantir que todo `owner_id` que aparece em
  `ploomes_deals`, `ploomes_contacts` ou `events` tem entrada em `sellers` (mesmo que `inactive`).
  Hoje há ~16 contatos com `owner_id` sem entrada (Vitória Menezes, Vinícius Lupi, etc.) — caem na
  Carteira Livre (comportamento ok por ora). Impacta corretamente o módulo Recompra (Fase D) quando
  puxar clientes de 10–13 meses atrás com owners antigos.
- **`ploomes_order_products_backup_20260417`** pode ser dropada após validação do primeiro cron
  pós-deploy do fix de ghost rows (commit 8b8c589).
- **Backup hardening — On the horizon (não urgente):**
  - `backup_log` só registra `_db.sql.gz`. `_storage.tar.gz` e `_config.tar.gz` não têm
    registro → a página `/admin/backups` e o cron `backup-check` não detectam falha nesses dois.
    Solução futura: `backup-full.sh` chamar `log_backup_row()` para os 3 artefatos (ou 4 com checksum).
  - Backup diário verifica ausência apenas após 04:00 local (backup roda às 03:00). Se o servidor
    mudar de timezone ou o cron rodar antes das 04:00, a detecção falha silenciosamente.
    Solução futura: usar `now AT TIME ZONE 'America/Sao_Paulo'` explicitamente no route handler.
  - `email_sent_log` dedup exige `recipient_user_id` (FK em `users`). Se `BACKUP_ALERT_EMAIL` não
    existir em `users`, o e-mail é enviado mas não há registro → pode disparar múltiplos alertas
    no mesmo dia. Solução futura: dedup por `recipient_email TEXT` diretamente.

---

## CONTROLE DE ACESSO — ARQUITETURA (Fases 2.8a + 2.8b)

**Commits 2.8a:** `7c463f8` → `316f316` | **Commits 2.8b:** `8099e79` → `80222d6` (develop/main)

### Camadas de segurança (defense-in-depth)

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Edge (proxy) | `src/proxy.ts` | Session refresh + redirect unauthenticated → /login + is_active check |
| Layout Server | `src/app/(auth)/**/layout.tsx` | Role check por rota — redirect to `/403` |
| API handler | `src/app/api/**` | `requireRoleApi()` — retorna 401/403 |

> ⚠️ **NUNCA** usar `next/headers` em `proxy.ts` (middleware). O proxy usa `@supabase/ssr` com `request.cookies` diretamente.

### Helper `requireRoleServer` / `requireRoleApi`

```ts
// Layout (Server Component):
await requireRoleServer(ADMIN_ACCESS_ROLES)   // redirect('/403') se role insuficiente

// API Route Handler:
const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
if (!guard.ok) return guard.response          // NextResponse 401/403
```

Arquivo: `src/lib/auth/require-role.ts`

### Constantes de role (src/config/roles.ts) — completas

| Constante | Roles | Rota |
|-----------|-------|------|
| `ADMIN_ACCESS_ROLES` | super_admin, diretor, rh | `/admin/**` (pai) |
| `ADMIN_USERS_MANAGE_ROLES` | super_admin, rh | `/admin/usuarios` |
| `ADMIN_UNITS_MANAGE_ROLES` | super_admin, diretor | `/admin/unidades` |
| `ADMIN_LOGS_VIEW_ROLES` | super_admin, diretor | `/admin/logs` |
| `MAINTENANCE_MODULE_ROLES` | super_admin, diretor, gerente, **manutencao** | `/manutencao`, `/equipamentos` |
| `PRESTADORES_ACCESS_ROLES` | super_admin, diretor, gerente | `/prestadores` (sem manutencao — intencional) |
| `BI_ACCESS_ROLES` _(existente)_ | super_admin, diretor, gerente, financeiro | `/bi`, `/relatorios` |

> `OPS_ROLES` e `PROVIDER_ROLES` que viviam em `nav-items.ts` foram promovidos para `roles.ts` na Fase 2.8b.

### Layouts de guarda — todos os módulos protegidos

| Arquivo | Constante | Bugs corrigidos |
|---------|-----------|-----------------|
| `src/app/(auth)/admin/layout.tsx` | `ADMIN_ACCESS_ROLES` | BUG2 |
| `src/app/(auth)/admin/usuarios/layout.tsx` | `ADMIN_USERS_MANAGE_ROLES` | BUG2 (sub-rota) |
| `src/app/(auth)/admin/unidades/layout.tsx` | `ADMIN_UNITS_MANAGE_ROLES` | — |
| `src/app/(auth)/admin/logs/layout.tsx` | `ADMIN_LOGS_VIEW_ROLES` | — |
| `src/app/(auth)/bi/layout.tsx` | `BI_ACCESS_ROLES` | BUG4 |
| `src/app/(auth)/vendas/layout.tsx` | `VENDAS_MODULE_ROLES` | BUG3 |
| `src/app/(auth)/configuracoes/vendedoras/layout.tsx` | `SELLERS_MANAGE_ROLES` | BUG1+BUG5+BUG11 |
| `src/app/(auth)/manutencao/layout.tsx` | `MAINTENANCE_MODULE_ROLES` | BUG6+BUG9 |
| `src/app/(auth)/equipamentos/layout.tsx` | `MAINTENANCE_MODULE_ROLES` | BUG7+BUG10 |
| `src/app/(auth)/prestadores/layout.tsx` | `PRESTADORES_ACCESS_ROLES` | BUG8 |
| `src/app/(auth)/relatorios/layout.tsx` | `BI_ACCESS_ROLES` | — |

### Página `/403`

`src/app/403/page.tsx` — Server Component, acessível sem auth (em `PUBLIC_ROUTES` do `proxy.ts`).

### APIs com role check adicionado na Fase 2.8b

| Endpoint | Constante | Antes |
|----------|-----------|-------|
| `POST /api/email/maintenance-emergency` | `MAINTENANCE_MODULE_ROLES` | ❌ sem auth |
| `POST /api/minutes/notify` | super_admin, diretor, gerente | ❌ sem auth |
| `GET /api/maintenance/stats` | `MAINTENANCE_MODULE_ROLES` | ✅ auth, sem role |
| `GET /api/maintenance/history-summary` | `MAINTENANCE_MODULE_ROLES` | ✅ auth, sem role |

### Bugs corrigidos (11 total — 5 na 2.8a, 6 na 2.8b)

| Bug | Role | Rota | Fase |
|-----|------|------|------|
| BUG1 | gerente | `/configuracoes/vendedoras` | 2.8a ✅ |
| BUG2 | gerente | `/admin/usuarios` (+ escalação API) | 2.8a ✅ |
| BUG3 | financeiro | `/vendas` | 2.8a ✅ |
| BUG4 | vendedora | `/bi` | 2.8a ✅ |
| BUG5 | vendedora | `/configuracoes/vendedoras` | 2.8a ✅ |
| BUG6 | vendedora | `/manutencao` | 2.8b ✅ |
| BUG7 | vendedora | `/equipamentos` | 2.8b ✅ |
| BUG8 | vendedora | `/prestadores` | 2.8b ✅ |
| BUG9 | financeiro | `/manutencao` | 2.8b ✅ |
| BUG10 | financeiro | `/equipamentos` | 2.8b ✅ |
| BUG11 | financeiro | `/configuracoes/vendedoras` | 2.8a ✅ |

### Validação Chrome MCP — Matriz 7 roles × 5 rotas (Fase 2.8b)

| User | /manutencao | /equipamentos | /prestadores | /relatorios | /bi |
|------|-------------|---------------|--------------|-------------|-----|
| superadmin | ✅ | ✅ | ✅ | ✅ | ✅ |
| diretor | ✅ | ✅ | ✅ | ✅ | ✅ |
| gerente | ✅ | ✅ | ✅ | ✅ | ✅ |
| financeiro | 🚫/403 | 🚫/403 | 🚫/403 | ✅ | ✅ |
| vendedora | 🚫/403 | 🚫/403 | 🚫/403 | 🚫/403 | 🚫/403 |
| rh | 🚫/403 | — | — | — | 🚫/403 |
| **manutencao** | ✅ | ✅ | **🚫/403** | — | 🚫/403 |

> Assimetria manutencao: acessa /manutencao e /equipamentos mas NÃO /prestadores — comportamento intencional (gestão de terceiros é responsabilidade de gestão, não de técnicos).

### Débito: Fase 2.8c (futura)

- Verificar se `rh` e `manutencao` precisam de guard em outras rotas (eventos, checklists, atas)
- Consolidar constantes de atas/manutenção ainda locais nos handlers — Débito 3

---

## ROLE `pos_vendas` — Migration 068

Role transversal para equipe de pós-venda: acessa Vendas (Upsell + Recompra) + Eventos + Atas.
Não é vendedora (sem seller_id), não é gestor — sempre recebe visão agregada de todas as vendedoras.

### Comportamento no sistema

| Aspecto | Comportamento |
|---------|--------------|
| Módulo Vendas (`/vendas`) | ✅ Acesso completo via `VENDAS_MODULE_ROLES` |
| `isVendedora` | `false` → `effectiveSellerId = null` → agrega todas as vendedoras |
| `isManager` | `false` → `SellerSelector` oculto (não precisa escolher vendedora) |
| Upsell + Recompra | ✅ RPCs guardam `pos_vendas` desde Migration 068 |
| UnitSwitcher "Todas as unidades" | ✅ via `GLOBAL_VIEWER_ROLES` |
| `/bi` | 🚫 Não tem acesso (não está em `BI_ACCESS_ROLES`) |
| `/configuracoes/vendedoras` | 🚫 Não tem acesso (não está em `SELLERS_MANAGE_ROLES`) |
| Atas (`/atas`) | ✅ Sem `allowedRoles` — todos os roles veem; RLS controla acesso real |
| Eventos (`/eventos`) | ✅ Sem `allowedRoles` — todos os roles veem |
| `/manutencao`, `/equipamentos`, `/prestadores` | 🚫 Guards de layout ativas |
| `role_default_perms` | events(view+export), minutes(view+create+edit), notifications(view) |

### Arquivos modificados (Migration 068)

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/068_role_pos_vendas.sql` | CHECK constraints (3 tabelas), `is_global_viewer()`, `role_default_perms`, 9 RPCs |
| `src/types/database.types.ts` | `UserRole` union + `'pos_vendas'` |
| `src/types/permissions.ts` | `Role` union + `'pos_vendas'` |
| `src/lib/constants/index.ts` | `ROLE_LABELS.pos_vendas = 'Pós-Vendas'` |
| `src/config/roles.ts` | `GLOBAL_VIEWER_ROLES` + `VENDAS_MODULE_ROLES` incluem `'pos_vendas'` |
| `scripts/seed-test-users.ts` | `teste-posvendas@cachola.cloud` adicionado |

### RPCs atualizadas (9 total)
`get_vendas_my_kpis`, `get_vendas_daily_revenue`, `get_vendas_ranking`, `get_upsell_opportunities`, `get_upsell_count_for_user`, `get_upsell_popular_addons`, `get_recompra_aniversario_proximo`, `get_recompra_festa_passada`, `get_recompra_count_for_user`

---

## LABORATÓRIO DE USUÁRIOS DE TESTE

Scripts em `scripts/seed-test-users.ts` e `scripts/cleanup-test-users.ts`.
Executar na VPS via `npx tsx scripts/seed-test-users.ts`.

| Email | Role | Senha | Obs |
|-------|------|-------|-----|
| `teste-superadmin@cachola.cloud` | super_admin | `Teste@2026cacholaos!` | — |
| `teste-diretor@cachola.cloud` | diretor | `Teste@2026cacholaos!` | — |
| `teste-gerente@cachola.cloud` | gerente | `Teste@2026cacholaos!` | user_units → Pinheiros |
| `teste-financeiro@cachola.cloud` | financeiro | `Teste@2026cacholaos!` | — |
| `teste-vendedora@cachola.cloud` | vendedora | `Teste@2026cacholaos!` | seller_id → Raphaela Melo |
| `teste-rh@cachola.cloud` | rh | `Teste@2026cacholaos!` | adicionado Fase 2.8b |
| `teste-manutencao@cachola.cloud` | manutencao | `Teste@2026cacholaos!` | adicionado Fase 2.8b — valida assimetria /prestadores |
| `teste-posvendas@cachola.cloud` | pos_vendas | `Teste@2026cacholaos!` | adicionado Migration 068 — valida acesso transversal |

- Seed é idempotente (skip se já existe) e recriável a qualquer momento
- Cleanup deleta via `auth.admin.deleteUser` → CASCADE limpa `user_units` e `user_permissions`
- `sellers` NÃO são afetados (ON DELETE SET NULL)
- Total: 8 usuários — cobertura completa das 8 roles operacionais do sistema

---

## PWA — ATUALIZAÇÃO AUTOMÁTICA (ServiceWorkerUpdater)

**Problema resolvido:** Com `skipWaiting: true` + `clientsClaim: true`, o novo SW ativa
imediatamente, mas o usuário continua vendo a versão anterior até recarregar manualmente.

### Componente `ServiceWorkerUpdater`

`src/components/pwa/service-worker-updater.tsx` — `'use client'`, renderiza `null`.

**Dois mecanismos de detecção:**

1. **`controllerchange`** — Dispara quando o novo SW assume controle de todas as abas.
   Guard de `sessionStorage` previne loop infinito (ver regra 3 abaixo).

2. **Polling `/api/build-info`** — A cada 5 minutos e no `window.focus`.
   Compara `NEXT_PUBLIC_BUILD_ID` da resposta com o da build atual.
   Cobre casos onde `controllerchange` chega antes do componente montar (múltiplas abas).

**Ao detectar nova versão:**
- Toast Sonner infinito com botão "Atualizar agora"
- Auto-reload após 30 s
- Guard de formulário: se o usuário estiver digitando (`activeElement` com valor), adia o reload em 5 s
- Antes do reload: `caches.delete()` (fire-and-forget) + `sessionStorage.setItem(SW_RELOAD_KEY, '1')`

**Endpoint:** `GET /api/build-info` — público, `Cache-Control: no-store`, retorna `{ buildId }`.

### 3 Regras arquiteturais descobertas (NÃO violar)

**Regra 1 — Toaster e componentes que dependem do Sonner:**
`ServiceWorkerUpdater` (e qualquer componente que chame `toast()`) DEVE ser montado DENTRO
de `<Providers>` em `(auth)/layout.tsx`. O `<Toaster>` do Sonner só existe nessa árvore.
Componentes fora de `<Providers>` podem chamar `toast()` sem erro mas o toast nunca aparece.

**Regra 2 — `generateBuildId` e `env` são opções do `nextConfig` base:**
```ts
// ✅ CORRETO — em nextConfig
const nextConfig: NextConfig = {
  generateBuildId: async () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
}
export default withBundleAnalyzer(withPWA({ ... })(nextConfig))

// ❌ ERRADO — dentro de withPWA({...}) — silenciosamente ignorado
export default withPWA({ generateBuildId: ..., env: ... })(nextConfig)
```

**Regra 3 — Com `skipWaiting: true`, `reg.waiting` é sempre `null`:**
`postMessage({ type: 'SKIP_WAITING' })` é código morto — o SW já pulou a fila na instalação.
Para forçar ativação não é necessário nenhum `postMessage`. O `controllerchange` dispara
automaticamente; o único cuidado é o guard de sessionStorage para não entrar em loop:
```ts
// Antes de qualquer window.location.reload():
sessionStorage.setItem('sw-reloading', '1')

// No handler de controllerchange:
if (sessionStorage.getItem('sw-reloading')) {
  sessionStorage.removeItem('sw-reloading')
  return // este evento é consequência do nosso próprio reload — ignorar
}
```

---

## CREDENCIAIS DEV LOCAL

```
Admin: admin@cacholaos.com.br / Admin2026cacholaos / super_admin
VPS:   ssh root@187.77.255.31 / C@ch0l@1553#0S (ver docs/SSH VPS.txt)
```

> ⚠️ NUNCA usar em produção.
