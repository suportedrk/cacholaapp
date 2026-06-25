<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Cachola OS — guia para agentes de IA

Este arquivo é o **ponto de entrada**. A fonte da verdade completa é o **`CLAUDE.md`** — leia-o antes de qualquer implementação.

## Antes de tocar em código (mandatório)

1. Ler o `CLAUDE.md`.
2. Rodar o pre-flight da skill `cachola-dev-sync` (4 checks de drift) — ele **bloqueia** o trabalho se o ambiente estiver dessincronizado.
3. Consultar as skills aplicáveis e anunciar no chat: `📚 Skills consultadas: ...` (regra do projeto).
4. Planejar e **aguardar aprovação do Bruno** antes de implementar.

## Mapa de documentação

- `CLAUDE.md` — memória persistente: stack, banco, git workflow, módulos, incidentes.
- `docs/MODULES.md`, `docs/DECISIONS.md`, `docs/PERMISSIONS.md`, `docs/API_PLOOMES.md`, `docs/ops/`, `docs/rbac/`.

## Skills (`.claude/skills/`)

- **cachola-dev-sync** — pre-flight obrigatório de sincronia antes de qualquer trabalho.
- **cachola-stack** — padrões/armadilhas do front+back (Next 16, `@base-ui/react` ≠ Radix/shadcn, Recharts, TanStack, Zustand, Supabase, design tokens).
- **cachola-supabase-ops** — migrations, RLS (`view/create/edit/delete`), `deploy.yml`, GoTrue, Nginx, backups, incidentes.
- **cachola-rbac-pattern** — padrão de permissões (`check_permission`, catálogo de módulos em PT-BR). **Consultar SEMPRE** ao criar nova tela/função/feature.
- **cachola-vps-ops** — operações na VPS de **produção** (upgrade Node, ulimit, PM2, SSH, incidentes).
- **cachola-visual-qa** — confirmação visual via `chrome-devtools-mcp` (headless na VPS de dev; login por ambiente; armadilha do viewport estreito).
- **ploomes-cachola-api** — integração Ploomes (OData, FieldKeys, webhooks). **Não** ler o `ploomesapi.md` cru da raiz.
- **seguranca-web-appsec** (`docs/seguranca/`) — AppSec para Next.js + Supabase: OWASP Top 10:2025, SQLi, controle de acesso/IDOR, autenticação/sessão, XSS/CSRF, configuração segura, checklists por feature. Base do subagente `appsec-security-reviewer`. Use ao implementar ou revisar qualquer ponto de superfície de ataque.

## Subagentes (`.claude/agents/`)

Disparam pela `description` ao tocar nas áreas que cobrem; cada um lê a skill de domínio correspondente antes de agir. **9 são read-only** (devolvem veredito, nunca editam); **`test-author` é o único que escreve**.

- **rbac-auditor** *(read-only)* — audita controle de acesso nas 4 camadas (template `role_permissions`, guard de layout, guard de API, RLS/RPC); caça literal de role inline, code de módulo em inglês em `check_permission`, e grants órfãos em troca de cargo. Use ao mexer em `layout.tsx` de rota, API que modifica dados, RLS/RPC ou `src/config/roles.ts`. Lê `cachola-rbac-pattern`.
- **migration-reviewer** *(read-only)* — revisa todo `.sql` novo em `supabase/migrations/` antes do merge e da esteira: ordem DDL-antes-DML (lição da 072), `DROP FUNCTION` antes de `CREATE` com assinatura mudada, idempotência, RLS+GRANT em tabela nova, sem `BEGIN/COMMIT`/`NOTIFY pgrst` soltos (regra da esteira 160+), rollback presente, predicados de funções gêmeas. Lê `cachola-supabase-ops`.
- **ploomes-verifier** *(read-only)* — verifica sync/webhook/FieldKeys da integração Ploomes (fonte de verdade financeira): mandamentos da API (StatusId, paginação, `$expand=Owner`, funil CACHOLA, unidade canônica Order>Deal), JOIN deal→order→products e o delete-antes-upsert (fix ghost-rows). Use ao mexer em `src/lib/ploomes/**` ou no webhook. Lê `ploomes-cachola-api`.
- **appsec-security-reviewer** *(reviewer — usar read-only)* — **revisor AppSec primário**, lastreado na skill `docs/seguranca/` (OWASP Top 10:2025 + references de SQLi, IDOR/controle de acesso, autenticação/sessão, XSS/CSRF, configuração segura). Varre auth, sessão, tokens, queries, endpoints/Server Actions, RLS, segredos e qualquer ponto onde input do usuário chega ao servidor/banco; classifica achados 🔴/🟡/✅ com categoria OWASP, arquivo:linha e o fix concreto. Use ao criar/alterar rota de API, layout guard, RPC/RLS, upload, webhook, env/segredo, ou em qualquer feature que toque superfície de ataque. **Disparo obrigatório antes do merge** de mudança que toque segurança (ver `CLAUDE.md` → "REGRA DE SEGURANÇA"). Tem capacidade de edição, mas no fluxo de revisão é usado read-only (devolve veredito; correções seguem o plano aprovado pelo Bruno).
- **security-reviewer** *(read-only)* — foco em **LGPD/PII de menor** + triagem de vulns npm (complementa o `appsec-security-reviewer`): PII de criança em log/URL/export, retenção, segredos, triagem de Dependabot (sem `audit fix --force`). Use ao mexer em log/export que possa conter dado pessoal ou ao triar dependências. Sobreposição técnica com o `appsec-security-reviewer` é intencional (defesa em camadas); para revisão de vulnerabilidade web, prefira o `appsec`.
- **visual-qa** *(renderiza, não edita)* — QA visual com foco em **mobile (375px)** e tablet, claro+escuro, via `chrome-devtools-mcp`: design tokens, WCAG AA, estados loading/error/empty. Use ao mexer em componente/tela. Lê `cachola-visual-qa`.
- **test-author** *(ESCREVE testes)* — cobre lógica pura crítica (permissão, unidade canônica, períodos, conflito `<=0`/`<0`, moeda BR, recorrência, parsers Ploomes); adota Vitest e integra o CI (Categoria A — exige aprovação). Use ao pedir testes ou travar regressão de bug.
- **db-performance-reviewer** *(read-only)* — performance de banco em escala: índice para colunas de filtro/join/ordenação, índices parciais, custo de RLS (funções `STABLE` vs `VOLATILE`, subquery por linha), JOIN deal→order→products indexado, paginação apoiada por índice. Caveat embutido: dev é snapshot pequeno → `EXPLAIN` engana, raciocina por escala. Use ao mexer em índice, RPC de BI/Vendas, RLS ou schema de tabela grande. Lê `cachola-supabase-ops`.
- **data-fetching-reviewer** *(read-only)* — padrões obrigatórios de TanStack Query: `enabled: isSessionReady`, **nunca** `enabled` com `activeUnitId`, retry sem 401/403, `isError` tratado, `useLoadingTimeout` desestruturado, `createClient` singleton. Pega a classe de bug **"Skeleton Loading Infinito"**. Use ao mexer em `src/hooks/**` ou telas. Lê `cachola-stack` (`auth-and-session.md`) + a seção "DATA FETCHING" do `CLAUDE.md`.
- **design-tokens-reviewer** *(read-only)* — design system no nível de **código** (par estático do `visual-qa`): hex hardcoded na UI, `oklch()`/classe Tailwind em HTML de html2canvas/print, `Button asChild`, `animate-pulse`, touch target < 44px. Conhece as exceções de hex (Recharts/jsPDF/e-mail/print). Use ao mexer em componente/tela. Lê `cachola-stack` (`design-tokens.md`) + `DESIGN_SYSTEM_CLAUDE_CODE.md`.

## Ambientes

- **Produção:** `cachola.cloud` — VPS Hostinger + Nginx + PM2; branch `main` → deploy automático.
- **Dev:** VPS de dev (headless); dev server PM2 `cachola-dev` em `localhost:3000` da VPS; acesso via túnel SSH / port-forward do VS Code; banco Docker `cacholaos-db`.

## Git workflow (resumo — detalhes no `CLAUDE.md`)

Trabalhar em `develop` → `tsc` + `lint` limpos → commit → push → CI verde → `merge --no-ff main` → deploy. **Nunca** commit direto em `main`; **nunca** merge com CI vermelho; **nunca** editar arquivos direto na VPS.
