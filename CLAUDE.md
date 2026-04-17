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
- Migration 055 + aba **"Vendas Realizadas (Orders)"** no BI: 3 RPCs guardados (super_admin+diretor+gerente+financeiro): `get_bi_sales_kpi`, `get_bi_sales_ranking` (avg_monthly_revenue normalizado por meses trabalhados respeitando hire_date/termination_date), `get_bi_seller_orders` (drill-down). Aba "Responsáveis por Deal" renomeada para **"Atendimento (Deals)"** — conteúdo intocado. Período default 12M, pills 3M/6M/12M/Tudo. Default filtra `status=active AND is_system_account=false`; toggle "Incluir histórico" expõe todas. Rodapé "Dados a partir de outubro/2024" apenas quando período=Tudo. Drill-down via sheet (sem página dedicada). `canSeeVendas = VENDAS_ROLES` (inclui gerente + financeiro).

---

## CREDENCIAIS DEV LOCAL

```
Admin: admin@cacholaos.com.br / Admin2026cacholaos / super_admin
VPS:   ssh root@187.77.255.31 / C@ch0l@1553#0S (ver docs/SSH VPS.txt)
```

> ⚠️ NUNCA usar em produção.
