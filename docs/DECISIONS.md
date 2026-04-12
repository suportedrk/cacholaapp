# DECISIONS.md — Decisões Técnicas do Cachola OS

> Por que as coisas são como são. Consultar antes de mudar algo que parece estranho.

---

## STACK E INFRAESTRUTURA

| Decisão | Razão |
|---------|-------|
| `@ducanh2912/next-pwa` | `next-pwa` v5.6 abandonado com 23 vulnerabilidades. Fork mantido é compatível com Next 16. |
| Tailwind v4 (CSS config) | `create-next-app` 16.2.1 já vem com Tailwind v4. Config via `@theme inline {}` em globals.css. |
| `npm run build` usa `--webpack` (não Turbopack) | `@ducanh2912/next-pwa` é um plugin webpack. `next build` default (Turbopack) não executa plugins webpack — `sw.js` não é gerado. Dev continua com Turbopack. |
| Supabase self-hosted dev e prod | Decisão do Bruno: sem Supabase Cloud. Total controle de dados. Dev === Prod em termos de infra. |
| `type` ao invés de `interface` em database.types.ts | TypeScript interfaces NÃO satisfazem `Record<string, unknown>` em conditional types (Supabase GenericTable constraint). Type aliases SIM. |
| `AppNotification` ao invés de `Notification` | `Notification` conflita com a interface DOM global do browser. |
| Volume nomeado para PostgreSQL (não bind mount) | Bind mounts no Windows criam arquivos ocultos (`.s.PGSQL.5432.lock`) que impedem a inicialização. |
| NÃO montar migrations em `/docker-entrypoint-initdb.d` | A imagem `supabase/postgres` tem seus próprios init scripts nesse path. Sobrescrever quebra tudo. Usar `/docker-entrypoint-migrations` e rodar manualmente. |
| JWTs hardcoded em `docker/kong.yml` (dev) | Kong 2.8.1 não faz substituição de env vars nativamente. `eval "echo"` corrompe `_format_version: "1.1"`. |
| Senhas dos roles Supabase via `ALTER ROLE` | A imagem cria os roles sem senha. Necessário rodar `ALTER ROLE ... WITH PASSWORD '...'` após primeiro startup. |
| `_analytics` database criado manualmente | `supabase/postgres:15.8.1.084` NÃO cria o database `_analytics` automaticamente. Logflare exige database separado. |
| `_realtime` schema criado manualmente | Realtime usa `SET search_path TO _realtime`. Se schema não existe, migrator Ecto falha. |
| `docker/gcloud.json` stub com RSA real | Logflare inicializa Goth (Google Auth) mesmo em modo postgres — exige JSON com RSA PKCS8 válido. Auth falha graciosamente mas não crasha. |
| imgproxy desabilitado em dev Windows | `darthsim/imgproxy:v3.8.0` causa segfault (exit 139) no WSL2/Windows. Desabilitado via `ENABLE_IMAGE_TRANSFORMATION: "false"`. |
| `RLIMIT_NOFILE` obrigatório no realtime | `run.sh` do realtime usa `set -u` e referencia `$RLIMIT_NOFILE`. Sem essa var, script aborta. Valor: `4096`. |
| `APP_NAME` obrigatório no realtime | `runtime.exs:78` exige `APP_NAME`. Sem ela, boot falha. Valor: `realtime`. |
| nodemailer v6 (não v8) | nodemailer v8 sem `@types/nodemailer`. v6 tem tipos, mas `@types/nodemailer` não instala limpo neste projeto — solução: `src/types/nodemailer.d.ts` manual. |
| nodemailer graceful fallback | `sendEmail()` nunca lança exceção — erros são `console.error`. Fluxo principal nunca é interrompido por falha de e-mail. |

---

## AUTENTICAÇÃO E OAUTH

| Decisão | Razão |
|---------|-------|
| `ADDITIONAL_REDIRECT_URLS` (não `GOTRUE_URI_ALLOW_LIST`) | O `docker-compose.yml` define `GOTRUE_URI_ALLOW_LIST: ${ADDITIONAL_REDIRECT_URLS}`. Alterar `GOTRUE_URI_ALLOW_LIST` no `.env` não tem efeito. Após editar: `--force-recreate auth`. |
| Google OAuth callback usa `NEXT_PUBLIC_SITE_URL` | PM2 executa Next.js em `http://127.0.0.1:3001`. `request.url.origin` retornaria endereço interno. |
| Google OAuth cookies grandes exigem buffers Nginx maiores | OAuth define cookies ~8–12 KB. Sem `proxy_buffer_size 128k`, Nginx retorna 502 silencioso. |
| Trigger OAuth em schema `public` (não `auth`) | Supabase self-hosted bloqueia `CREATE FUNCTION` no schema `auth` para o role `postgres`. |
| `create_notification` com SECURITY DEFINER | RLS de notifications só permite ler as próprias. Para inserir para outros, necessária função com SECURITY DEFINER. |
| `GoTrue --force-recreate` (não restart) | `docker compose restart auth` NÃO relê o `.env`. Usar `docker compose up -d --force-recreate auth`. |

---

## DATA FETCHING E REACT QUERY

| Decisão | Razão |
|---------|-------|
| `enabled: isSessionReady` em toda useQuery | Evita queries antes da sessão estar pronta. `isSessionReady` vem de `useAuthReadyStore`. |
| NUNCA `enabled: !!activeUnitId && isSessionReady` | `activeUnitId=null` é legítimo (super_admin visão global) → query nunca dispara → skeleton infinito. |
| `createClient()` é singleton | `createBrowserClient` gera nova instância a cada chamada. Múltiplas instâncias competem pelo mesmo localStorage lock, causando timeouts de 5s. |
| NUNCA `getUser()`/`getSession()` fora de queryFn/mutationFn | Em Strict Mode, efeitos rodam 2× no mount → 2 lock acquisitions concorrentes. Usar `useAuth().profile.id`. |
| `AuthCacheSync` ignora o primeiro `SIGNED_IN` | Supabase v2 dispara `SIGNED_IN` ao subscrever quando já há sessão. Ignorar evita reset de queries em-flight. |
| `AppReadyGate` antes de renderizar rotas auth | Resolve race condition entre `AuthGuard.getSession()` e `onRehydrateStorage` do Zustand persist. |
| `useLoadingTimeout(isLoading, 12s)` em toda tela | Safety net — exibe "Tentar novamente" se loading durar >12s em vez de skeleton infinito. |
| Retry nunca retentar 401/403 | `retry: (count, err) => count < 3 && err?.status !== 401 && err?.status !== 403` |
| Supabase Realtime desabilitado em Docker local | `_client.realtime.disconnect()` no init do singleton — evita loop infinito de reconexão. Remover em produção. |

---

## BANCO DE DADOS E RLS

| Decisão | Razão |
|---------|-------|
| `get_user_unit_ids()` e `is_global_viewer()` como SQL functions | RLS policies precisam verificar acesso por unidade em múltiplas tabelas. Funções SQL reutilizáveis evitam subquery duplicada. |
| `unit_id = null` no Zustand = todas as unidades | super_admin/diretor veem dados agregados. Hooks não adicionam filtro unit_id nesse caso. |
| `ploomes_deal_id` UNIQUE permite múltiplos NULLs | PostgreSQL permite múltiplos NULLs em coluna UNIQUE. Eventos manuais coexistem sem conflito. Upsert via `ON CONFLICT (ploomes_deal_id)`. |
| RPC reports com SECURITY INVOKER + GRANT EXECUTE | RLS das tabelas se aplica automaticamente (sem bypass). |
| UNIQUE(name, unit_id) nas config tables | Config tables tinham UNIQUE(name). Multi-unidade exige UNIQUE(name, unit_id). |
| `ploomes_unit_mapping` separado de `ploomes_config` | `ploomes_config` é por unidade (UNIQUE unit_id). Mapeamento valor→unidade é global (N unidades). Tabela separada. |
| `resolveUnitId` sem early return por `options.unitId` | Bug anterior: `if (unitId) return unitId` ignorava o campo "Unidade Escolhida" do deal. Agora: lookup pelo deal sempre tem prioridade. |

---

## UI/UX E COMPONENTES

| Decisão | Razão |
|---------|-------|
| Ícones em cards | `.icon-{cor}` — NUNCA `bg-*-50` |
| Badges/pills | `.badge-{cor} border` — NUNCA hex direto |
| Hover em cards | `.card-interactive` — NUNCA manual `hover:shadow-md hover:-translate-y-*` |
| Select "Todos" | `value={null}` + `<SelectItem value="all">` (base-ui renderiza placeholder) |
| Botão com link | `<Link className={cn(buttonVariants(...))}>` — base-ui Button não suporta `asChild` |
| TooltipTrigger | Usar `render` prop para elemento custom; sem `asChild` |
| Page transition | `key={pathname}` no wrapper dentro de `<main>` + `animate-page-enter` |
| Skeleton | `<Skeleton>` usa `.skeleton-shimmer` — adapta a dark mode via `color-mix` |
| Touch targets | Wrapper `w-11 h-11 -m-[valor]` para elementos pequenos (mínimo 44px) |
| Calendário custom (CSS Grid, sem lib) | react-big-calendar é pesado e difícil de customizar. Implementado com date-fns + Tailwind CSS Grid. |
| `ExportPdfModal` lazy via `next/dynamic` | Evita carregar jsPDF/Canvas até o usuário abrir o modal. |
| `suppressHydrationWarning` no `<body>` | Extensões de browser injetam atributos no `<body>` causando mismatch de hidratação React. |
| `createPortal(document.body)` em modais/sheets | Garante posicionamento correto sobre todos os elementos, incluindo sticky headers. |

---

## MÓDULOS ESPECÍFICOS

| Decisão | Razão |
|---------|-------|
| Dois arquivos `ChecklistCard` | `src/app/(auth)/checklists/components/checklist-card.tsx` é o PREMIUM usado na listagem. `src/components/features/checklists/checklist-card.tsx` é legado não usado na listagem. Não confundir. |
| `CHECKLIST_LIST_SELECT` vs `CHECKLIST_DETAIL_SELECT` | Selects separados: lista precisa de dados mínimos (+ `checklist_item_comments(id)` para badge); detalhe precisa de joins completos. |
| `onCommentsCount` só quando sheet está aberto | Quando sheet fecha, query `useChecklistItemComments` é desativada → `comments = []` → chamaria `onCommentsCount(0)` zerando o badge. Guard: `if (open) onCommentsCount?.(comments.length)`. |
| `useEffect` com `Math.max` para commentsCount | React Query stale-while-revalidate: componente monta com dados stale (sem comments), re-fetch traz dados frescos. `useState` não reinicializa. `useEffect` + `Math.max` sincroniza sem regredir. |
| `checklist_item_comments(id)` no DETAIL_SELECT | Necessário para inicializar `commentsCount` corretamente ao abrir a página de detalhe. |
| Notas de itens removidas | UI de notas (textarea inline) consolidada nos comentários por item — mais completos e com foto. Campo `notes` mantido no banco para dados históricos. |
| Status 'lost' sem `cancelled` em events | `cancelled` foi removido do CHECK (migration 006). `lost` adicionado (migration 016) para deals perdidos no Ploomes. |
| `equipment TEXT` → `equipment_id UUID FK` | Campo freetext sem valor histórico. SELECT dos equipamentos ativos é mais útil. |
| `event_category` (não `event_type`) em events | `event_type` conflitaria com FK `event_type_id`. Campo separado para categoria vinda do Ploomes. |
| `expiry_alert_sent = true` em supplier_documents | Garante idempotência do cron. Novo documento começa com `false`. |
| Custo de manutenção: input monetário em centavos | `15000` → `"150,00"`, salvo como decimal `150.00`. Evita problemas de float. |
| Cron Ploomes separado de check-alerts | Sync Ploomes pode levar 10–30s (chamadas externas). Rota dedicada evita timeout que afetaria notificações internas. |
| `syncDeals` aceita SupabaseClient como parâmetro | Evita dependência de `cookies()` (next/headers) no sync.ts. Reutilizável em cron, manual e webhook. |
| Auto-criação de venues no sync | Se `venueName` do Ploomes não existe em `venues`, cria automaticamente. Counter `venues_created` no log. |
| `PROVIDER_LIST_SELECT` usa join de docs (não count) | `docs:provider_documents(id,expires_at)` — calcula `documents_count` + `expiring_docs` client-side sem query dupla. |
| `useEventRatings` separado de `useProviderRatings` | QueryKey por evento para invalidação granular. |
| Webhook Ploomes validado por `X-Ploomes-Validation-Key` | Header padrão documentado pela Ploomes. Var env: `PLOOMES_VALIDATION_KEY`. |
| Registro de webhook idempotente | `/api/ploomes/webhook-register` verifica se já existe webhook antes de criar. |
| `idb` para offline | Promise-based, schema tipado, 4KB de bundle. Alternativas mais pesadas ou verbosas. |
| `patchesRef` para evitar stale closures no IDB | `handleItemStatus/Notes` são `useCallback` memorizados. `useRef` sincronizado via `useEffect` acessa valor atual. |
| Upload de foto desabilitado offline | `File` não é serializable para IDB de forma prática. Botão desabilitado quando `isOffline`. |
| Offline schema: `status` + `notes` apenas | Campos como `priority` e `assigned_to` não são editáveis offline. Schema correto como está. |
| `useSearchParams()` exige `<Suspense>` | Componentes com `useSearchParams()` precisam de `<Suspense>` para pré-renderização estática. Padrão: componente interno + Suspense no export. |
| Debounce sem useEffect em EventFiltersBar | `useEffect([debouncedSearch])` causava loop infinito no StrictMode (React 18 monta/desmonta 2×). Timer manual no handler. |
| `logAudit` removido dos hooks client-side | `logAudit` usa `createAdminClient` (server-only). Hooks são client-side. |
| `@next/bundle-analyzer` via require() condicional | `@next/bundle-analyzer` v16.x não existe no npm (Next.js 16 muito novo). Static import falha. |
| Role check em Server Component layout (não no proxy) | Verificar role no `proxy.ts` adicionava query ao banco em CADA request (~400–800ms latência). Movido para `(auth)/admin/layout.tsx`. |
| `ploomes_config` UNIQUE(unit_id) | 1 row por unidade. Fallback para env vars mantém retrocompatibilidade. |
| Páginas de mapeamento Ploomes leem do banco | Quando admin atualizar mapeamentos no banco, tela reflete automaticamente sem deploy. |
| BigStringValue e BoolValue em PloomesOtherProperty | Campos extras da API Ploomes não documentados no spec padrão mas presentes na resposta real. |
| `deal_amount` de `Deal.Amount` (não OtherProperty) | Campo padrão do deal, não campo customizado. |
| Link deal Ploomes derivado de ploomes_deal_id | `https://app10.ploomes.com/deal/{ploomes_deal_id}`. Não depende de `ploomes_url` (campo obsoleto). |

---

## CREDENCIAIS DE DEV LOCAL

```
Email: admin@cacholaos.com.br
Senha: Admin2026cacholaos
Role:  super_admin (32 permissões)
VPS:   ssh root@187.77.255.31 / C@ch0l@1553#0S
```

> ⚠️ NUNCA usar estas credenciais em produção.
