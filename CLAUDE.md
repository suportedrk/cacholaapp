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

**Módulo Vendas — Fase D.2 (sem migration) — UI RECOMPRA — AGUARDA VALIDAÇÃO VISUAL:**
- `src/hooks/use-recompra.ts`: `useRecompraAniversario`, `useRecompraFestaPassada`, `useRecompraCount`, `useLogRecompraContact`, `useReopenRecompraContact`
- 7 componentes em `src/app/(auth)/vendas/_components/recompra/`: `index.tsx` (RecompraTab), `recompra-type-tabs.tsx` (pills Aniversário/Festa Passada + counts), `recompra-card-aniversario.tsx` (chips 🔥0-7d/⚡8-30d/🎂31-60d/📅61-90d), `recompra-card-festa.tsx` (chip "Há N meses"), `carteira-livre-recompra-banner.tsx` (texto extra sobre clientes de vendedoras inativas), `recompra-contact-dialog.tsx`, `recompra-reopen-dialog.tsx`
- `vendas/page.tsx`: substituído PlaceholderTab por RecompraTab; `?tab=recompra` suportado
- `sidebar.tsx`: badge = `upsellCount.total + recompraCount.total` (consolidado)
- `scripts/email-vendas-daily.ts`: e-mail consolidado (Upsell + Aniversários + Festas Passadas); `--dry-run` e `--sample` flags; `email_type='vendas_daily'`; cron **comentado** aguardando cadastro das vendedoras
- RPC já correto (0-90 dias sem lower bound) — sem nova migration necessária

---

## REGRA DE PROCESSO (aprendizado Fase C.2)

Antes de reportar fase concluída, Claude Code deve pedir screenshot visual
ao Bruno e aguardar confirmação. Reportar "screenshot confirmou" sem
screenshot real no chat = violação de processo. 3 bugs passaram em C.2
por pular essa validação.

---

## DÉBITOS TÉCNICOS

- **Sellers órfãos:** sync de sellers deve garantir que todo `owner_id` que aparece em
  `ploomes_deals`, `ploomes_contacts` ou `events` tem entrada em `sellers` (mesmo que `inactive`).
  Hoje há ~16 contatos com `owner_id` sem entrada (Vitória Menezes, Vinícius Lupi, etc.) — caem na
  Carteira Livre (comportamento ok por ora). Impacta corretamente o módulo Recompra (Fase D) quando
  puxar clientes de 10–13 meses atrás com owners antigos.
- **`ploomes_order_products_backup_20260417`** pode ser dropada após validação do primeiro cron
  pós-deploy do fix de ghost rows (commit 8b8c589).

---

## CREDENCIAIS DEV LOCAL

```
Admin: admin@cacholaos.com.br / Admin2026cacholaos / super_admin
VPS:   ssh root@187.77.255.31 / C@ch0l@1553#0S (ver docs/SSH VPS.txt)
```

> ⚠️ NUNCA usar em produção.
