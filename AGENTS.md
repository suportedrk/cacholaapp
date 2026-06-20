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

## Subagentes (`.claude/agents/`)

Disparam pela `description` ao tocar nas áreas que cobrem; cada um lê a skill de domínio correspondente antes de agir. **5 são read-only** (devolvem veredito, nunca editam); **`test-author` é o único que escreve**.

- **rbac-auditor** *(read-only)* — audita controle de acesso nas 4 camadas (template `role_permissions`, guard de layout, guard de API, RLS/RPC); caça literal de role inline, code de módulo em inglês em `check_permission`, e grants órfãos em troca de cargo. Use ao mexer em `layout.tsx` de rota, API que modifica dados, RLS/RPC ou `src/config/roles.ts`. Lê `cachola-rbac-pattern`.
- **migration-reviewer** *(read-only)* — revisa todo `.sql` novo em `supabase/migrations/` antes do merge e da esteira: ordem DDL-antes-DML (lição da 072), `DROP FUNCTION` antes de `CREATE` com assinatura mudada, idempotência, RLS+GRANT em tabela nova, sem `BEGIN/COMMIT`/`NOTIFY pgrst` soltos (regra da esteira 160+), rollback presente, predicados de funções gêmeas. Lê `cachola-supabase-ops`.
- **ploomes-verifier** *(read-only)* — verifica sync/webhook/FieldKeys da integração Ploomes (fonte de verdade financeira): mandamentos da API (StatusId, paginação, `$expand=Owner`, funil CACHOLA, unidade canônica Order>Deal), JOIN deal→order→products e o delete-antes-upsert (fix ghost-rows). Use ao mexer em `src/lib/ploomes/**` ou no webhook. Lê `ploomes-cachola-api`.
- **security-reviewer** *(read-only)* — segurança + LGPD (buffet infantil = PII de menores): auth no servidor por rota, segredos, validação de input, PII de criança em log/URL/export, triagem de vulns npm. Use ao mexer em rota de API, `createAdminClient`, env/segredo, log/export ou cron/webhook. Checklist próprio (não há skill LGPD ainda).
- **visual-qa** *(renderiza, não edita)* — QA visual com foco em **mobile (375px)** e tablet, claro+escuro, via `chrome-devtools-mcp`: design tokens, WCAG AA, estados loading/error/empty. Use ao mexer em componente/tela. Lê `cachola-visual-qa`.
- **test-author** *(ESCREVE testes)* — cobre lógica pura crítica (permissão, unidade canônica, períodos, conflito `<=0`/`<0`, moeda BR, recorrência, parsers Ploomes); adota Vitest e integra o CI (Categoria A — exige aprovação). Use ao pedir testes ou travar regressão de bug.

## Ambientes

- **Produção:** `cachola.cloud` — VPS Hostinger + Nginx + PM2; branch `main` → deploy automático.
- **Dev:** VPS de dev (headless); dev server PM2 `cachola-dev` em `localhost:3000` da VPS; acesso via túnel SSH / port-forward do VS Code; banco Docker `cacholaos-db`.

## Git workflow (resumo — detalhes no `CLAUDE.md`)

Trabalhar em `develop` → `tsc` + `lint` limpos → commit → push → CI verde → `merge --no-ff main` → deploy. **Nunca** commit direto em `main`; **nunca** merge com CI vermelho; **nunca** editar arquivos direto na VPS.
