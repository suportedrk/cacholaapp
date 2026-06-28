# CLAUDE.md — Memória Persistente do Cachola OS

> Leia SEMPRE antes de qualquer implementação.
> Para estado detalhado dos módulos: **`docs/MODULES.md`**
> Para decisões técnicas completas: **`docs/DECISIONS.md`**

---

## IDENTIDADE DO PROJETO

**Cachola OS** — SaaS/PWA para operação diária de Buffet Infantil: eventos, checklists, manutenção, comunicação interna, calendário e gestão de equipe.

- **Metodologia:** Vibe Coding — Claude planeja + implementa, Bruno testa + valida
- **Problema resolvido:** Informações espalhadas em WhatsApp, planilhas e cadernos
- **Versão atual:** v1.72.2 (prod, 28/jun/2026, commit `0d486fc`). Última migration: **179**. A v1.72.2 fechou a **varredura de design system** (dívida de dark mode, 5 lotes, sem migration), reconciliou o `docs/MODULES.md` (migrations até 179 + módulos novos) e subiu `engines.node >= 22`. As três releases anteriores da mesma sessão (28/jun) fecharam a dívida **"Vendas Fase 3"**: v1.71.2 (coluna "Usuário vinculado" em Vendedoras), v1.72.0 (**Meta mensal** — cadastro próprio `sales_targets`, mig 178, pois o Ploomes não expõe metas na API; realizado = `SUM(produtos)`) e v1.72.1 (follow-ups da meta, mig 179). Marcos recentes: **Modo "Ver como"/impersonação read-only** (migs 175–177, v1.71.x); **Frente Segurança/LGPD** (migs 168–172, v1.70.0); módulo **Decoração** completo (migs 097–142); **Central de Serviços** (migs 144–148 + Fase 2 anexos/confirmação de leitura, migs 163–164). Mapa "o que existe e onde" por módulo: `docs/MODULES.md`; detalhe técnico/cronológico nas seções abaixo e nas memórias.

---

## Skills — Verificação Obrigatória

**Antes de responder qualquer pedido** (incluindo perguntas simples como "o que faz esse arquivo?"), siga este protocolo em 3 passos:

1. **Liste** as skills disponíveis em `.claude/skills/` (basta `ls .claude/skills/` ou inspecionar mentalmente se já viu na sessão).
2. **Decida** quais skills se aplicam ao pedido atual lendo o `description` do `SKILL.md` de cada uma.
3. **Anuncie no chat** uma das duas formas, antes de qualquer código ou análise:

   - Se aplica skill(s):
     ```
     📚 Skills consultadas: ploomes-cachola-api (references/odata-cheatsheet.md, references/gotchas-cachola.md)
     ```

   - Se nenhuma se aplica:
     ```
     📚 Skills consultadas: nenhuma se aplica a este pedido
     ```

4. Só depois disso, prossiga com o trabalho normalmente.

### Regras

- Esta verificação é **sempre obrigatória**, mesmo em perguntas exploratórias ou triviais.
- Quando uma skill se aplica, **leia o(s) arquivo(s) relevante(s)** dentro dela antes de escrever código — não apenas o `SKILL.md`. Cada skill tem uma tabela "Quando consultar cada referência" no `SKILL.md` indicando qual arquivo `references/` ler para qual tipo de tarefa.
- Se múltiplas skills se aplicam, anuncie todas.
- Se a skill cobre só parte do pedido, anuncie a skill + diga qual parte ainda fica fora dela.
- **Nunca** invente conteúdo que está numa skill — sempre leia o arquivo, mesmo que pareça lembrar.

---

## SINCRONIZAÇÃO DE AMBIENTES — POLÍTICA OBRIGATÓRIA

> **Skill de referência: `.claude/skills/cachola-dev-sync/`** — leia-a antes de qualquer diagnóstico ou implementação.
> A política completa ("Política de Sincronização de Três Pontas") está documentada nessa skill.

**Resumo executivo:**
- **GitHub é a fonte única de verdade.** A cópia local do Windows (`C:\Users\bruno\Documents\Projetos\cacholaos`) pode estar atrás — NUNCA é usada como referência para diagnóstico.
- **Para ler código em diagnóstico:** sempre `git fetch origin` + `git show origin/<branch>:<caminho>` — nunca ler o arquivo cru do disco.
- **Início de sessão na máquina local:** rodar `scripts/sync-local.ps1` (ou `git fetch --all --prune && git pull --ff-only`) para atualizar o espelho.
- **develop à frente de main entre releases = normal.** Após cada deploy, resync `develop ← main` via `git merge origin/main --no-edit && git push`.

---

## PROTOCOLO DE DESENVOLVIMENTO — SEQUÊNCIA OBRIGATÓRIA

> Esta seção existe porque a falta de validação local em dev foi fator contribuinte no incidente de 24/abr/2026 (v1.5.2). Leia antes de cada sessão.

### Sequência obrigatória para qualquer mudança de código

1. git checkout develop && git pull origin develop (sempre começar sincronizado)
2. Copiar .env.local se não existir
3. Implementar a mudança no ambiente de dev (VPS de dev, pasta ~/cacholaos)
4. CLASSIFICAR a mudança em uma das duas categorias abaixo
5. Aplicar a regra correspondente à categoria
6. npx tsc --noEmit | grep -v .next  →  obrigatório, deve estar limpo
7. npm run lint (não introduzir warnings novos em relação ao baseline)
8. git add + git commit (mensagem descritiva em pt-BR)
9. git push origin develop
10. Aguardar CI verde antes de qualquer merge para main

### Categoria A — Muda comportamento percebido

Inclui qualquer alteração em: UI, fluxo de navegação, lógica de negócio, permissão efetiva (quem vê o quê), dados retornados por API/RPC, conteúdo exibido, redirecionamentos, emails, cálculos, textos visíveis.

Regra: obrigatório rodar npm run dev e validar funcionalmente o que mudou. Bruno fará a validação final com olho humano via screenshot antes do merge em main, mas Claude Code deve ter aberto a tela e confirmado que não quebrou o visível antes de commitar.

Exemplos de Categoria A:
- Mudança em layout, botão, modal, dropdown, tabela
- Nova rota ou alteração em rota existente
- Ajuste em role/guard que muda quem acessa o quê
- Novo campo em formulário ou alteração em validação
- Mudança em texto de email, notificação, toast
- Alteração em RPC que muda o shape dos dados
- Qualquer correção de bug (é comportamento por definição)

### Categoria B — Refactor invisível ao usuário

Inclui apenas: consolidação de constantes idênticas, renomeação de variável/constante, ajuste de formatação, atualização de import path, reorganização de código sem alterar output.

Regra: npm run dev não é obrigatório SE tsc e lint passam limpos. O compilador é suficiente como validador.

Exemplos de Categoria B:
- Substituir ADMIN_ROLES local por ADMIN_ACCESS_ROLES de @/config/roles (quando conteúdo é idêntico)
- Renomear helper interno
- Mover função de um arquivo para outro sem mudar behavior
- Atualizar CLAUDE.md ou outros .md
- Ajustes de formatação/lint automáticos

### Regra do desempate

EM QUALQUER DÚVIDA sobre qual categoria se aplica, trate como Categoria A e valide em dev local. Dúvida empurra para o lado seguro.

Exemplo: "essa mudança em um hook compartilhado parece refactor, mas é usada em 3 componentes de UI". → Categoria A. Roda.

### Regra de SSH — VPS de PRODUÇÃO (187.77.255.31)

> ⚠️ Estas regras protegem a PRODUÇÃO e nasceram do incidente de 24/abr/2026. São inderrogáveis.

SSH na VPS de PRODUÇÃO é permitido APENAS para:
- Diagnóstico (git status, pm2 logs, ls, docker exec … psql … SELECT)
- Operações de infraestrutura (pm2 restart, docker restart, reindex, aplicar migration via docker exec)
- Restauração em incidente (git checkout HEAD -- file após aprovação explícita do Bruno)

SSH na VPS de PRODUÇÃO é PROIBIDO para:
- Editar arquivo de código-fonte (.ts, .tsx, .js, .yml, .json, .md)
- Executar npm install (usar npm ci quando for o caso, sempre controlado pelo deploy.yml)
- Criar, mover ou deletar arquivos rastreados pelo git
- Fazer commit, git reset, git clean, git checkout em branch diferente de main

Toda alteração de código chega à produção obrigatoriamente pelo fluxo: editar na VPS de DEV → commit em develop → merge em main → deploy automático aplica na VPS de produção. NUNCA editar produção diretamente.

### Regra de SSH — VPS de DEV (2.25.194.165)

> A VPS de DEV substituiu o antigo ambiente local (Windows). É AQUI que o código é desenvolvido e editado.

Na VPS de DEV é PERMITIDO (fluxo normal de trabalho):
- Editar código via Claude Code (extensão do VS Code ou CLI) em ~/cacholaos, sempre no branch develop
- Operar o dev server, que fica sempre no ar via PM2 (pm2 logs cachola-dev, pm2 restart cachola-dev)
- docker compose / docker exec para o Supabase de DEV (banco de desenvolvimento)
- git add / commit / push origin develop

Disciplina obrigatória (a lição do incidente vale para qualquer VPS):
- Toda mudança de código vira commit + push para develop — NUNCA deixar o disco da VPS de dev divergir do git
- O branch da VPS de DEV é sempre develop (o da VPS de produção é sempre main)
- Migrations e mudanças de schema seguem o mesmo fluxo via git

### Por que essas regras existem

No incidente de 24/abr/2026, 4 arquivos de código foram deletados do disco da VPS sem passar pelo git — provavelmente durante intervenção manual em uma sessão de SSH ao tentar destravar falhas de deploy. A divergência ficou invisível por 5 dias, até que a build da v1.5.2 tentou importá-los e quebrou a produção com HTTP 500.

Se as regras acima tivessem sido seguidas, o incidente não teria acontecido. Essas regras são mandatárias, não sugestões.

No hotfix v1.5.7 (27/abr/2026), a migration 072 foi mergeada sem smoke test local. Ela tinha UPDATE antes do DROP CONSTRAINT, causando violação e ROLLBACK silencioso. A migration nunca se aplicou em produção — foi detectada somente em auditoria pós-merge. Correção exigiu hotfix (migration 073) com nova versão e novo deploy. Regra adicional: **toda migration que mistura DDL + DML deve ser testada localmente com `docker exec -i supabase-db psql … < arquivo.sql` antes do merge.** Ver seção "Regra DDL em migrations" detalhada nos PRs 3/v1.5.7.

---

## Backlog de dívidas técnicas (docs/DIVIDAS_TECNICAS.md)

O arquivo `docs/DIVIDAS_TECNICAS.md` é a FONTE DE VERDADE das dívidas técnicas e pendências do projeto (não a memória do chat).

Regras de uso, obrigatórias em toda sessão:
- No início de qualquer tarefa, verifique se a área que vai ser mexida tem relação com algum item do backlog. Se tiver, AVISE logo no início da resposta e OFEREÇA resolver junto (total ou parte).
- NUNCA resolva uma dívida por conta própria nem sem aprovação do Bruno (ou do consultor no chat). A regra é: surfar o item + sugerir; só executar com o "pode" explícito.
- Quando uma dívida for de fato resolvida E estiver em produção, MOVA o item para a seção "Resolvidas" do arquivo, com data e versão (não apagar de vez — manter o histórico).
- Ao adicionar uma nova dívida descoberta durante o trabalho, registre-a na seção correta do arquivo (com status), em vez de deixar só na conversa.

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
| Hosting dev | VPS Hostinger Ubuntu 24.04 + Docker + PM2 | — |
| Hosting prod | VPS Hostinger Ubuntu 24.04 + Nginx + PM2 | — |

> ⚠️ Tailwind v4: config via `@theme inline {}` em `globals.css`. Sem `tailwind.config.ts`.

---

## REPOSITÓRIO

- **GitHub:** `suportedrk/cacholaapp`
- **Branch produção:** `main` | **Branch dev:** `develop`
- **Credenciais:** Em `GITHUB_CREDENTIALS.MD` (NUNCA commitar)
- **VPS de produção:** `187.77.255.31` (alias `cacholaos-vps` na máquina do Bruno) — só recebe código via git → deploy; nunca editar por SSH (ver `docs/SSH VPS.txt`)
- **VPS de dev:** `2.25.194.165` (alias `cacholaos-dev` na máquina do Bruno) — ambiente de desenvolvimento; app sempre no ar via PM2 (processo `cachola-dev`), Supabase de dev via Docker; Bruno acessa via VS Code Remote-SSH com encaminhamento das portas 3000 (app) e 8000 (Supabase)

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

### Padrão de card clicável (v1.5.12+)

Padrão estabelecido para cards do módulo Vendas (Upsell, Recompra Aniversário, Recompra Festa Passada). Replicar em qualquer novo card que precise abrir destino externo.

**Estrutura do componente:**

- `handleCardClick`: guard de campo nullable + `window.open(url, '_blank', 'noopener,noreferrer')` + `console.warn` discreto se inválido
- `handleCardKeyDown`: dispara em `Enter` e `Space` (com `preventDefault()` no Space para não rolar a página)
- `aria-label` condicional por estado (não-contatado / contatado / sem vínculo)

**Atributos do div raiz do card:**

- `role="link"` e `tabIndex={0}` condicionais à validade do destino (ambos `undefined`/`-1` se o destino é null)
- Classe `focus-ring` (de `globals.css`) condicional à validade do destino
- Classe `card-interactive` quando não-contatado e clicável
- Classes `cursor-pointer hover:opacity-90` quando contatado e clicável (não usar hover lift no estado contatado, para preservar a hierarquia visual de "já feito")

**Elementos interativos internos (proteção contra bubble):**

- Botões: `e.stopPropagation()` antes da lógica original do handler
- Chips decorativos (`<span>`): `onClick={(e) => e.stopPropagation()}` E `onMouseDown={(e) => e.stopPropagation()}` no próprio elemento — `onMouseDown` previne navegação prematura em alguns navegadores

**Destinos atuais por módulo:**

- Vendas/Upsell aponta para `https://app10.ploomes.com/deal/{deal_id}`
- Vendas/Recompra aponta para `https://app10.ploomes.com/contact/{ploomes_contact_id}`

**Tratamento de campo nullable:** quando o campo de destino é nullable (ex: `ploomes_contact_id: number | null`), o card NÃO é clicável: `tabIndex={-1}`, sem `role="link"`, sem `focus-ring`, sem `cursor-pointer`. Os botões internos continuam funcionando normalmente. O `aria-label` informa "sem vínculo no Ploomes".

**Referências de implementação:**

- `src/app/(auth)/vendas/_components/upsell/upsell-card.tsx`
- `src/app/(auth)/vendas/_components/recompra/recompra-card-aniversario.tsx`
- `src/app/(auth)/vendas/_components/recompra/recompra-card-festa.tsx`

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

### Gotcha — INSERT direto em `auth.users` (Supabase self-hosted GoTrue)

> **Descoberto em 24/04/2026** ao criar usuários de teste (`freelancer`, `entregador`) para validação de redirect pós-login.

Campos de token (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change_token_current`, `email_change`, `phone_change`, `phone_change_token`, `reauthentication_token`) devem ser preenchidos com `''` (string vazia), **NUNCA `NULL`**.

- **Sintoma de NULL:** login retorna HTTP 500 ("Serviço indisponível") mesmo com credenciais corretas — GoTrue falha silenciosamente ao ler o token
- **Correção:** sempre usar `INSERT ... confirmation_token = '', recovery_token = '', ...` ou usar `SELECT extensions.crypt(...)` conforme o padrão dos scripts de criação de usuários
- Referência: `scripts/create-prod-test-users-v151.sql` (gitignored) — usa o padrão correto com tokens `''`

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
- NUNCA `git pull develop` na VPS de PRODUÇÃO — produção roda sempre `main`. A VPS de DEV roda `develop` (é onde desenvolvemos).
- SEMPRE `--no-ff` no merge
- SEMPRE tsc antes de commitar

### Deploy VPS de PRODUÇÃO
```bash
cd /opt/cacholaapp
git pull origin main
NODE_OPTIONS=--max-old-space-size=4096 npm run build
pm2 restart cacholaos --update-env
```

> **CI DEPLOY CONCORRENTE RESOLVIDO (20/04/2026):** a hipótese original (SSH timeout) estava errada — `command_timeout: 12m` e `timeout-minutes: 15` já estavam corretos. Causa raiz real: dois commits quase simultâneos em `main` disparavam runs paralelos; ambos tentavam rodar `next build` na VPS e o segundo falhava em `.next/cache/.lock` com `"Another next build process is already running"`. Fix: `concurrency` group `deploy-production` com `cancel-in-progress: false` no workflow — segundo run fica enfileirado até o primeiro terminar. Bruno não precisa mais fazer deploy manual após merges rápidos.

> **INCIDENTE DE DISCO DA VPS (24/04/2026 — v1.5.2 / commit 883a956):** após o deploy da v1.5.2, toda a produção retornou HTTP 500 por ~30 min. Causa direta: 4 arquivos do módulo Automações do Checklist Comercial (`automation-card.tsx`, `automation-form.tsx`, `use-commercial-automations.ts`, `use-ploomes-stages.ts`) estavam deletados do disco da VPS mas presentes no git — estado inconsistente acumulado entre 19–23/abr durante debugging de falhas de `package-lock.json`. `npm run build` falhou com `Module not found`; `set -e` abortou antes do `pm2 restart`; PM2 continuou servindo a versão anterior mas `.next/static/` havia sido sobrescrito pelo build parcial. Fix: `git checkout HEAD -- <4 arquivos>`, `npm run build`, `pm2 restart --update-env`. Diagnóstico: `bash_history` congelado em 17/abr impossibilitou prova direta da deleção manual. Prevenção: v1.5.3 introduziu portão de working tree no `deploy.yml` (`grep -v '^??'` aborta o deploy se qualquer arquivo tracked divergir do git antes do `git pull`).

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

#### Esteira de migração com botão (`migrate-prod.yml`) — Fase 1

A partir da migration **160**, a aplicação em produção passa a ter alternativa com 1 clique: o workflow manual `.github/workflows/migrate-prod.yml` (GitHub → Actions → "Migrar Producao (esteira)"). Ele reusa os secrets SSH do deploy, faz backup `pg_dump` pré-migração, aplica com `psql --single-transaction`, roda healthcheck em `https://cachola.cloud` e registra tudo em `public.cachola_migration_log` (tabela de auditoria/guarda contra reaplicação). A ordem **deploy-primeiro** continua valendo: merge para `main` → deploy verde → só então clicar a esteira (com `dry_run` para testar antes). Migrations novas **não** devem conter `BEGIN/COMMIT/ROLLBACK` soltos nem `NOTIFY pgrst` manual — a esteira cuida da transação e do reload. **Documentação completa:** skill `cachola-supabase-ops` → `references/deploy-pipeline.md` (seção "Esteira de migracao com botao").

### Banco de dados de DEV — snapshot anonimizado (LGPD)

O banco da VPS de dev é um **retrato (snapshot) já anonimizado** da produção — não uma cópia ao vivo. É semeado **manualmente** e renovado só quando necessário; não há sincronização automática puxando dados da produção.

**Princípio da necessidade (LGPD art. 6º, III):** o ambiente de dev precisa de dados *realistas*, não dos dados *reais* dos clientes. Por isso a anonimização (remoção de PII — nomes, e-mails, telefones, datas de nascimento) acontece **antes** de os dados chegarem na VPS de dev. Nenhum dado pessoal real de cliente trafega ou repousa na VPS de dev. A lógica de anonimização vive em `scripts/anonymize-local.sql`.

**Preservado (para debug realista do BI):** `owner_name`, `users.name`, `sellers.name` (staff interno, não clientes) e valores financeiros (`amount`, `deal_amount`, `discount`, reais).

> ⚠️ **CONFIDENCIALIDADE:** como os valores financeiros são reais, o banco de dev é **confidencial comercial** mesmo anonimizado. NÃO compartilhar dump, NÃO screenshotar BI em contexto público, NÃO expor via tunnel público. (A VPS de dev já é protegida: firewall fecha as portas; acesso só por túnel SSH.)

**Fluxo legado (aposentado):** `npm run db:sync-local` puxava a produção direto para o Docker no Windows do Bruno, anonimizando no caminho. Descontinuado junto com o ambiente Windows. Quando uma renovação do snapshot for necessária, o procedimento (gerar dump já anonimizado → carregar na VPS de dev) é detalhado na hora — sempre com a anonimização ocorrendo **antes** de os dados tocarem a VPS de dev.

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

**Workflow deploy (`.github/workflows/deploy.yml`) — estado atual (v1.5.3):**
- Usa `npm ci` (não `npm install`) — garante lockfile estrito e evita corrupção do `package-lock.json` na VPS (fix v1.5.1 / commit `26adc05`)
- **Portão de working tree (v1.5.3):** antes do `git pull`, executa `git status --porcelain | grep -v '^??'` — aborta com mensagem clara se houver arquivos tracked modificados ou deletados na VPS. Ignora untracked legítimos (`scripts/ops/` etc.)
- **PM2 `--update-env` (v1.5.3):** `pm2 restart cacholaos --update-env` força releitura de variáveis do `.env.local` a cada deploy. Sem essa flag, PM2 mantém silenciosamente o ambiente da última inicialização a frio.

---

## COMANDOS ÚTEIS

```bash
npm run dev          # Inicia app (Turbopack)
npm run build        # Build produção (webpack — necessário para PWA)
npm run lint
npx tsc --noEmit     # Type check

# Docker — Supabase (ambiente de dev, na VPS)
docker compose up -d
docker compose logs -f supabase-auth
docker compose restart supabase-auth  # NÃO relê .env — usar --force-recreate para vars
docker compose up -d --force-recreate auth

# PostgreSQL local
docker compose exec supabase-db psql -U postgres -d postgres
```

### Pipeline de versão

```bash
npx tsx scripts/bump-version.ts patch   # atualiza package.json + package-lock.json (não toca src/lib/version.ts)
```

**Como a versão propaga automaticamente (sem variável extra na VPS):**
1. `bump-version.ts` escreve a nova versão em `package.json`
2. Em build time, `next.config.ts` lê `package.json` via `readFileSync` e injeta `NEXT_PUBLIC_APP_VERSION` no bloco `env:`
3. A versão fica "baked" nos chunks JS — nenhuma variável de ambiente adicional é necessária na VPS
4. `src/lib/version.ts` apenas lê `process.env.NEXT_PUBLIC_APP_VERSION` (fallback `'1.0.0'` só em dev sem build)
5. Sidebar e outros componentes consomem via `APP_VERSION` de `src/lib/version.ts`

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

> Mapa de rotas e status por módulo: **`docs/MODULES.md`**. Guards de acesso por rota: seção **CONTROLE DE ACESSO — ARQUITETURA** abaixo.

---

## SERVIÇOS (DEV — na VPS, via túnel SSH / port-forward do VS Code)

Esses serviços rodam na **VPS de dev**. Da sua máquina, os endereços `localhost` abaixo funcionam **quando a porta está encaminhada** — o VS Code Remote-SSH encaminha sob demanda pelo painel **PORTS** (3000 e 8000 já saem automáticos; Studio e Postgres, adicione se precisar).

| Serviço | URL (via túnel) |
|---------|-----------------|
| App Next.js (PM2) | http://localhost:3000 |
| Supabase API (Kong) | http://localhost:8000 |
| Supabase Studio | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> Studio pode aparecer como "unhealthy" no Docker — falso negativo, funciona normalmente. Ele não é exposto publicamente; só chega por túnel SSH.

---

## MÓDULOS — REFERÊNCIA RÁPIDA

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
| Central de Serviços | `use-central-servicos-links.ts` / `-contatos.ts` / `-avisos.ts` | `app/(auth)/central-servicos/_components/` |

> **Detalhe por módulo, RPCs, FieldKeys, fases e migrations:** `docs/MODULES.md` (mapa "o que existe e onde") + git log. Os blocos de implementação por versão que viviam aqui foram consolidados no MODULES.md; abaixo ficam só os gotchas duráveis não óbvios.

**Gotchas duráveis de módulos:**
- **`ChecklistCard` da listagem** = `app/(auth)/checklists/components/checklist-card.tsx` (PREMIUM). NÃO confundir com `components/features/checklists/checklist-card.tsx` (legado, fora da listagem).
- **Exportar Calendário para Cliente (PNG via html2canvas)** — 3 regras duras: (1) `CalendarExportView` usa APENAS inline styles com hex — html2canvas não suporta o `oklch()` do Tailwind v4; (2) `EventBadge` usa `display: block` + `lineHeight` px fixo + chip `inline-block` (flex+alignItems quebra o texto no render); (3) `onclone` remove todos os `<style>`/`<link rel="stylesheet">` do DOM clonado antes da captura. A sanitização remove TODA PII antes de gerar (`sanitize-events.ts`). Componentes em `src/components/features/dashboard/calendar-export/`.
- **Valor de festa / critério de ganho / JOIN canônico (BI e Vendas):** ver **KEY LEARNINGS & PRINCIPLES** abaixo — regem qualquer RPC nova de BI/Vendas.

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

## REGRA DE SEGURANÇA — REVISÃO APPSEC OBRIGATÓRIA

> Cachola OS é um buffet **infantil**: trata PII de menores (LGPD). Segurança não é etapa opcional.
> Skill de referência: **`seguranca-web-appsec`** (`.claude/skills/seguranca-web-appsec/`) — OWASP Top 10:2025 + `references/` de SQLi, IDOR/controle de acesso, autenticação/sessão, XSS/CSRF e configuração segura. Invocável via Skill tool.
> Subagente: **`appsec-security-reviewer`** (revisor AppSec primário, read-only no fluxo de revisão).

**Toda mudança que toca superfície de ataque DEVE passar pelo `appsec-security-reviewer` antes do merge para `main`.** Superfície de ataque inclui:

- Autenticação, login, sessão, tokens/JWT, recuperação de senha
- Rota de API / Route Handler / Server Action (especialmente POST/PATCH/DELETE)
- Uso de `createAdminClient` / `service_role`
- Política de RLS, RPC `SECURITY DEFINER`, migration que cria tabela/policy/função
- Upload/download de arquivo, bucket de Storage, webhook, endpoint de cron
- Variáveis de ambiente, segredos, integrações com terceiros (Ploomes, SMTP, R2)
- Renderização de conteúdo do usuário (`dangerouslySetInnerHTML`, `document.write` de print, html2canvas) e templates de e-mail

**Fluxo obrigatório (não-derrogável):**
1. Implementar a mudança em `develop`.
2. Acionar o `appsec-security-reviewer` (read-only) sobre o diff — ele devolve veredito 🔴/🟡/✅ por achado, com categoria OWASP e o fix.
3. **Corrigir todos os 🔴 antes do merge.** 🟡 = corrigir ou registrar como risco aceito em `docs/DIVIDAS_TECNICAS.md` (seção Segurança/LGPD) com justificativa.
4. Só então `tsc`/`lint` limpos → merge → deploy.

**Padrão de guard em API** (lição da varredura de 25/jun/2026 — endpoints proxy Ploomes tinham IDOR: qualquer autenticado lia PII do CRM por ID via `service_role`):
```ts
// No TOPO do handler, ANTES de createAdminClient() e de ler params/body:
const guard = await requireRoleApi(ALLOWED_ROLES)   // src/lib/auth/require-role.ts
if (!guard.ok) return guard.response
const supabase = await createAdminClient()
```
Regra: **toda rota que usa `service_role` precisa de guard de cargo antes** — `getUser()` sozinho (só "está logado?") NÃO é autorização. Validação de upload (tipo + tamanho) sempre **server-side**, nunca só no client.

**Webhook/cron:** validar a chave/segredo em **fail-closed** (segredo ausente → recusa, nunca aceita) e com comparação em tempo constante (`timingSafeEqual`).

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

## KEY LEARNINGS & PRINCIPLES

Decisões técnicas e descobertas que devem guiar implementações futuras. Complementam as REGRAS INVIOLÁVEIS — estas são específicas de domínio (banco, integrações, padrões de query).

---

**pipeline_id NÃO existe em ploomes_deals (Mai/2026 — Fase C)**

`pipeline_id` não existe como coluna em `ploomes_deals`. O sync já filtra deals do funil CACHOLA (id 60000636) na origem, antes de inserir no banco. Por isso não adicionar filtros defensivos por `pipeline_id` em RPCs nem em queries — a coluna não existe e a tentativa de hardening foi descoberta como impossível durante o diagnóstico da Fase C (Mai/2026).

---

**Fonte de verdade para valor de festa: SUM(ploomes_order_products.total) (v1.8.0 — Fase C)**

Divergência sistêmica histórica entre 3 fontes de valor para festa: `deal_amount` (campo manual no Deal), `po.amount` (campo manual no Order) e `SUM(ploomes_order_products.total)` (calculado a partir dos produtos lançados). Fonte de verdade única adotada na Fase C (v1.8.0): `SUM(pop.total)`. Limitação conhecida: Order só existe em deals Ganhos — para deals em aberto/perdidos a única fonte possível continua sendo `deal_amount`, sabidamente subestimado e zerado em ~118 deals ganhos pré-Fase C. Pipeline ativo (em aberto) ainda usa `deal_amount` com cautela; backlog futuro pode endereçar isso.

---

**JOIN canônico Deal → Order → OrderProducts (Migration 070 + 087)**

Padrão de JOIN canônico para qualquer RPC nova que agregar valor de festa, definido em `get_event_sales_summary` (migration 070) e replicado em todas as 11 RPCs da Fase C (migration 087):
1. `ploomes_deals JOIN ploomes_orders ON po.deal_id = pd.ploomes_deal_id`
2. `LEFT JOIN ploomes_order_products ON pop.order_id = po.ploomes_order_id`
3. Somar `SUM(pop.total)`

Quando agregar produtos por deal, usar CTE pré-agregada (`prods`) para evitar explosão cartesiana entre orders e produtos. Quando partir de orders e contar, usar `COUNT(DISTINCT po.ploomes_order_id)` para não inflar contagem pelo LEFT JOIN com produtos. Esse padrão deve ser seguido em qualquer RPC futura que toque BI/Vendas.

---

## Janelas de manutenção

Índice de janelas de manutenção/infra registradas (apenas ponteiros — o conteúdo fica no doc em `docs/ops/`).

- **02/jun/2026** — Backup (alerta falso positivo + `backup-verify` mudo) e kernel `6.8.0-124` → [`docs/ops/2026-06-02-janela-manutencao-backup-kernel.md`](docs/ops/2026-06-02-janela-manutencao-backup-kernel.md)

---

## DÉBITOS TÉCNICOS

> **Fonte de verdade:** `docs/DIVIDAS_TECNICAS.md` (regra do projeto: débitos não vivem na memória do chat). Os itens que estavam aqui foram migrados para o backlog.

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
| `ADMIN_ACCESS_ROLES` | super_admin, diretor | `/admin/**` (pai) — rh removido em v1.5.1 |
| `ADMIN_USERS_MANAGE_ROLES` | super_admin, diretor | `/admin/usuarios` — rh removido em v1.5.1 |
| `ADMIN_UNITS_MANAGE_ROLES` | super_admin, diretor | `/admin/unidades` |
| `ADMIN_LOGS_VIEW_ROLES` | super_admin, diretor | `/admin/logs` |
| `MAINTENANCE_MODULE_ROLES` | super_admin, diretor, gerente, **manutencao** | `/manutencao`, `/equipamentos` |
| `MAINTENANCE_ADMIN_ROLES` | super_admin, diretor, gerente | `/manutencao/dashboard`, `/manutencao/configuracoes` — v1.5.1 |
| `PRESTADORES_ACCESS_ROLES` | super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao | `/prestadores` — expandido v1.5.1 |
| `BI_ACCESS_ROLES` | super_admin, diretor | `/bi`, `/relatorios` — gerente+financeiro removidos v1.5.1 |
| `OPERATIONAL_CHECKLIST_ROLES` | super_admin, diretor, gerente, decoracao, **freelancer**, **entregador** | `/checklists/**` — freelancer+entregador restaurados v1.5.1 |
| `DASHBOARD_ACCESS_ROLES` | todos exceto freelancer e entregador | `/dashboard` — guard v1.5.1 |
| `SETTINGS_ROLES` | super_admin, diretor | `/configuracoes` — gerente removido v1.5.1 |
| `EVENTOS_ACCESS_ROLES` | todos exceto manutencao, freelancer, entregador | `/eventos` — guard v1.5.1 |
| `ATAS_ACCESS_ROLES` | todos exceto manutencao, freelancer, entregador | `/atas` — guard v1.5.1 |
| `VENDAS_MODULE_ROLES` | super_admin, diretor, vendedora, pos_vendas | `/vendas` — gerente removido v1.5.1 |
| `COMMERCIAL_CHECKLIST_ACCESS_ROLES` | super_admin, diretor, vendedora, pos_vendas | `/vendas/checklist` (gerente removido v1.5.0) |
| `COMMERCIAL_CHECKLIST_MANAGE_ROLES` | super_admin, diretor | `/vendas/checklist/equipe, /templates, /automacoes` |
| `TEAM_TASKS_ROLES` | super_admin, diretor, gerente | sidebar "Tarefas da Equipe" (decoracao excluída) |

> `OPS_ROLES` e `PROVIDER_ROLES` que viviam em `nav-items.ts` foram promovidos para `roles.ts` na Fase 2.8b.

### Layouts de guarda — todos os módulos protegidos

| Arquivo | Constante |
|---------|-----------|
| `src/app/(auth)/admin/layout.tsx` | `ADMIN_ACCESS_ROLES` |
| `src/app/(auth)/admin/usuarios/layout.tsx` | `ADMIN_USERS_MANAGE_ROLES` |
| `src/app/(auth)/admin/unidades/layout.tsx` | `ADMIN_UNITS_MANAGE_ROLES` |
| `src/app/(auth)/admin/logs/layout.tsx` | `ADMIN_LOGS_VIEW_ROLES` |
| `src/app/(auth)/bi/layout.tsx` | `BI_ACCESS_ROLES` |
| `src/app/(auth)/vendas/layout.tsx` | `VENDAS_MODULE_ROLES` |
| `src/app/(auth)/configuracoes/vendedoras/layout.tsx` | `SELLERS_MANAGE_ROLES` |
| `src/app/(auth)/manutencao/layout.tsx` | `MAINTENANCE_MODULE_ROLES` |
| `src/app/(auth)/manutencao/dashboard/layout.tsx` | `MAINTENANCE_ADMIN_ROLES` |
| `src/app/(auth)/manutencao/configuracoes/layout.tsx` | `MAINTENANCE_ADMIN_ROLES` |
| `src/app/(auth)/equipamentos/layout.tsx` | `MAINTENANCE_MODULE_ROLES` |
| `src/app/(auth)/prestadores/layout.tsx` | `PRESTADORES_ACCESS_ROLES` |
| `src/app/(auth)/relatorios/layout.tsx` | `BI_ACCESS_ROLES` |
| `src/app/(auth)/checklists/layout.tsx` | `OPERATIONAL_CHECKLIST_ROLES` |
| `src/app/(auth)/vendas/checklist/layout.tsx` | `COMMERCIAL_CHECKLIST_ACCESS_ROLES` |
| `src/app/(auth)/vendas/checklist/automacoes/layout.tsx` | `COMMERCIAL_CHECKLIST_MANAGE_ROLES` |
| `src/app/(auth)/vendas/checklist/equipe/layout.tsx` | `COMMERCIAL_CHECKLIST_MANAGE_ROLES` |
| `src/app/(auth)/vendas/checklist/templates/layout.tsx` | `COMMERCIAL_CHECKLIST_MANAGE_ROLES` |
| `src/app/(auth)/dashboard/layout.tsx` | `DASHBOARD_ACCESS_ROLES` |
| `src/app/(auth)/eventos/layout.tsx` | `EVENTOS_ACCESS_ROLES` |
| `src/app/(auth)/atas/layout.tsx` | `ATAS_ACCESS_ROLES` |
| `src/app/(auth)/configuracoes/layout.tsx` | `SETTINGS_ROLES` |

### Página `/403`

`src/app/403/page.tsx` — Server Component, acessível sem auth (em `PUBLIC_ROUTES` do `proxy.ts`).
Link "Voltar" é role-aware (v1.5.1): freelancer/entregador → `/checklists/minhas-tarefas`; outros → `/dashboard`; sem sessão → `/login`.

> **Assimetria manutencao (decisão de design):** acessa `/manutencao` e `/equipamentos` mas NÃO `/prestadores` — gestão de terceiros é responsabilidade de gestão, não de técnicos.

### Portão "Em breve" — `COMING_SOON_BYPASS_ROLES`

Algumas rotas estão atrás de um **portão "Em breve" intencional** (commit `7c84468`), não de um guard de cargo normal — a tabela de guards acima fica **mais restritiva** para elas. As rotas `/checklists`, `/prestadores`, `/relatorios` e `/vendas/checklist` têm `comingSoon: true` na nav e os layouts liberam o acesso real só a `COMING_SOON_BYPASS_ROLES` (= `super_admin`, `diretor`); os demais cargos veem o item com a plaquinha "Em breve". É **fail-closed** (trava a mais) — comportamento por design, não regressão de segurança. Ao auditar, não tratar essas 4 rotas como furo: o conjunto efetivo é `COMING_SOON_BYPASS_ROLES`, não a constante histórica (`OPERATIONAL_CHECKLIST_ROLES`/`PRESTADORES_ACCESS_ROLES`/`BI_ACCESS_ROLES`).

---

## RBAC Catalogs e Templates de Cargo

> Estado atual e arquivos: `docs/MODULES.md` (seção "Cargos / Templates RBAC"). O histórico PR-a-PR (PR1–PR4b, hotfixes v1.5.6–v1.5.11) foi consolidado; abaixo ficam o resumo e os gotchas duráveis.

**Catálogos (migs 071/074/075):** `modules` (20, code PT-BR = slug da rota), `roles` (11), `role_permissions` (template cargo×módulo×ação), `role_template_audit` (log de toggles). O motor efetivo continua em `user_permissions` (codes PT-BR desde a mig 073, FK → `modules(code)`); o template é aplicado via `applyRoleTemplate(..., { prune })`. UI em `/admin/cargos` (guard `TEMPLATE_MANAGE_ROLES` = super_admin).

**Gotchas duráveis:**
- **`createAdminClient()` roda como o USUÁRIO, não service_role, em requisição com sessão.** Ele usa `@supabase/ssr` com os cookies → o PostgREST recebe o JWT do usuário (claim `authenticated`); o service_role key vira só `apikey`. Logo a RLS se aplica mesmo no "admin client" (endpoints admin são gateados por `check_permission` como o admin logado); em cron/sem-cookie roda como service_role de verdade. **Antes de mexer em GRANT por role, validar a identidade EFETIVA do client** — não confiar no nome. Foi a causa-raiz da migration 173 revertida.
- **`check_permission()` tem CASE EN→PT-BR permanente** (mig 076) como camada defensiva de custo zero: se uma policy futura passar um code EN antigo, ainda resolve. As policies já usam PT-BR direto (mig 077 recriou 49). **Não remover o CASE.**
- **DDL + DML na mesma migration:** ordem estrita DROP constraints → UPDATE dados → ADD constraints (lição da mig 072 deprecada → 073). Já consta no protocolo de migrations acima.

### LOGOUT seguro — regras obrigatórias
1. `resetAuth()` em `auth-store.ts` DEVE resetar `isSessionReady: false` — senão `AppReadyGate` segue liberando o layout e a navbar mostra `profile?.name` como flash.
2. O handler `SIGNED_OUT` em `providers.tsx` DEVE chamar `useImpersonateStore.getState().stopImpersonating()` ANTES de `resetAuth()` — senão `isImpersonating=true` sobrevive à soft navigation.
3. Navegação pós-logout = `window.location.href = '/login'` (hard reset) — `router.push` é soft navigation e os stores Zustand sobrevivem.
4. NÃO chamar `router.push('/login')` no callback de `signOut` — o handler `SIGNED_OUT` já faz o hard reset; dois redirects causam inconsistência.

---

### super_admin — bypass de user_permissions

`isSuperAdmin = user.role === 'super_admin'` no código desabilita os toggles de permissão na UI e bypassa toda checagem de `user_permissions`. Por isso:

- Linhas faltantes em `user_permissions` para `super_admin` são **esperadas e cosméticas** — não afetam nenhuma funcionalidade.
- **Não fazer backfill** para usuários super_admin.
- Diagnóstico de gap (como o da auditoria PR 4a) deve excluir super_admin da lista de "impactados".

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
| Checklist Comercial (`/vendas/checklist`) | ✅ Acesso via `COMMERCIAL_CHECKLIST_ACCESS_ROLES` (v1.5.0) |
| Checklist Operacional (`/checklists`) | 🚫 Guard de layout `OPERATIONAL_CHECKLIST_ROLES` — redireciona para /403 |
| Atas (`/atas`) | ✅ Guard de layout `ATAS_ACCESS_ROLES` (v1.5.1) — pos_vendas está na lista |
| Eventos (`/eventos`) | ✅ Guard de layout `EVENTOS_ACCESS_ROLES` (v1.5.1) — pos_vendas está na lista |
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
| `scripts/seed-test-users.ts` | `teste-posvendas@cachola.cloud` adicionado (apenas local — nunca criado em produção) |

### RPCs atualizadas (9 total)
`get_vendas_my_kpis`, `get_vendas_daily_revenue`, `get_vendas_ranking`, `get_upsell_opportunities`, `get_upsell_count_for_user`, `get_upsell_popular_addons`, `get_recompra_aniversario_proximo`, `get_recompra_festa_passada`, `get_recompra_count_for_user`

---

## LABORATÓRIO DE USUÁRIOS DE TESTE

> ⚠️ **Usuários de teste removidos de produção em 2026-04-22.**
> Os 7 usuários abaixo existiam em produção e foram deletados via operação SQL direta
> (registro histórico em `/opt/cacholaapp/scripts/ops/2026-04-22-remove-test-users.sql` na VPS).
> Para regressão de roles, use o ambiente local (docker compose) recriando via seed abaixo.

### Script principal (v1.5.0+)

```bash
npx tsx scripts/seed-local-test-users.ts
```

**`scripts/seed-local-test-users.ts`** — Script canônico para ambiente local. Double guard-rail (URL localhost + NODE_ENV). Apaga todos os usuários de teste anteriores e cria 10 novos — um por role — com Pinheiros (default) + Moema e permissões populadas de `role_default_perms`.

| Email | Role | Senha |
|-------|------|-------|
| `teste.diretor@cachola.local` | diretor | `LocalTeste2026!` |
| `teste.gerente@cachola.local` | gerente | `LocalTeste2026!` |
| `teste.vendedora@cachola.local` | vendedora | `LocalTeste2026!` |
| `teste.posvendas@cachola.local` | pos_vendas | `LocalTeste2026!` |
| `teste.decoracao@cachola.local` | decoracao | `LocalTeste2026!` |
| `teste.manutencao@cachola.local` | manutencao | `LocalTeste2026!` |
| `teste.financeiro@cachola.local` | financeiro | `LocalTeste2026!` |
| `teste.rh@cachola.local` | rh | `LocalTeste2026!` |
| `teste.freelancer@cachola.local` | freelancer | `LocalTeste2026!` |
| `teste.entregador@cachola.local` | entregador | `LocalTeste2026!` |

- Idempotente — pode rodar múltiplas vezes sem efeitos colaterais
- Requer banco local com schema populado (`docker compose up -d` + sync de produção)
- **NUNCA rodar em produção** — double guard-rail aborta se URL não for localhost

### Scripts legados (descontinuados)

`scripts/seed-test-users.ts` e `scripts/cleanup-test-users.ts` — usavam domínio `@cachola.cloud` e não tinham guard-rail. Substituídos pelo script acima. Manter no repo para referência histórica.

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

## CREDENCIAIS

> 🔒 Nenhuma senha no repositório. Todas as credenciais (admins de dev e produção e o acesso root SSH das VPSs) ficam no gerenciador de senhas da equipe.

Acessos de dev úteis (sem senha — consultar o gerenciador de senhas):
- App / admin de dev: admin@cachola.local
- VPS de dev: alias cacholaos-dev (2.25.194.165)
