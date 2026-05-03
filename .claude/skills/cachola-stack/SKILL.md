---
name: cachola-stack
description: Padrões reais e armadilhas do stack frontend e backend do Cachola OS — Next.js 14 App Router, @base-ui/react (NÃO confundir com Radix/shadcn), Recharts, TanStack Query, Zustand, Supabase self-hosted, Tailwind com tokens próprios (sage green/warm beige). Use SEMPRE que o trabalho envolver criar/editar componentes React, telas, formulários, gráficos, sessão/autenticação, cliente Supabase, middleware/proxy, controle de acesso por role, ou quando precisar de cor/tipografia/espaçamento do design system. Dispare também ao editar arquivos em `src/components/`, `src/hooks/`, `src/lib/`, `src/app/`, `proxy.ts`, ou ao escrever prompts para o Claude Code.
---

# Cachola OS — Stack & Padrões

Esta skill consolida as regras específicas do Cachola que **divergem do óbvio** ou que o time já sangrou aprendendo. Não substitui o `DESIGN_SYSTEM_CLAUDE_CODE.md` (que é base genérica de UI) — esta skill é o **filtro Cachola**: o que muda em relação ao genérico.

## Filosofia

- **`@base-ui/react`, não Radix nem shadcn.** É outra biblioteca, com API parecida mas regras próprias. Ler `references/base-ui-quirks.md` antes de qualquer componente.
- **Cores Cachola: sage green `#7C8D78` + warm beige `#E3DAD1`.** Nada de azul brand-500 do design system genérico. Ler `references/design-tokens.md`.
- **Sessão é centralizada via `AuthBootstrap` + `useAuth`.** Nunca chamar `getSession()` ou `getUser()` em hooks dispersos. Ler `references/auth-and-session.md`.
- **Recharts com pixel fixo, sempre.** `ResponsiveContainer` é veneno neste projeto. Ler `references/recharts-fixed-pixels.md`.
- **Proxy + RBAC em 3 camadas.** Edge (`proxy.ts`) + server layout (`requireRoleServer`) + API handler (`requireRoleApi`). Ler `references/proxy-and-rbac.md`.
- **Prompts para Claude Code: single code block, plain text, sem markdown.** Ler `references/claude-code-conventions.md`.

## Quando consultar cada referência

| Tarefa | Leia |
|---|---|
| Criar/editar componente UI (Select, Dialog, Tabs, etc.) | `references/base-ui-quirks.md` |
| Adicionar/editar gráfico ou chart | `references/recharts-fixed-pixels.md` |
| Mexer em login, sessão, hook que precisa de user/unit, queries com `enabled` | `references/auth-and-session.md` |
| Aplicar cor, espaçamento, tipografia | `references/design-tokens.md` |
| Adicionar rota protegida, middleware, controle de role | `references/proxy-and-rbac.md` |
| Escrever prompt para Claude Code, decisão sobre dev local | `references/claude-code-conventions.md` |

## Padrões críticos (decorar)

Os 8 mandamentos do Cachola em frontend/backend. Violar um destes vai quebrar silenciosamente em produção:

1. **`@base-ui/react` NÃO suporta `asChild`.** Para estilizar botão como link, use `buttonVariants` no `className` direto.

2. **`createClient()` SEMPRE dentro do `queryFn`**, nunca como singleton de módulo. Senão `navigator.locks` cria contenção.

3. **`enabled: !!session && isSessionReady`**, nunca `!!activeUnitId`. `activeUnitId` pode trocar e refazer a query indevidamente.

4. **Cores: sage green `#7C8D78` para ações primárias, warm beige `#E3DAD1` para fundos suaves.** Esqueça `bg-brand-500` ou `bg-blue-*` — não existe Cachola assim. `brand-950` também NÃO existe (paleta termina em 900).

5. **Recharts: largura/altura em PIXEL FIXO**, dentro de `<div className="w-full overflow-x-auto">`. NUNCA `<ResponsiveContainer>`.

6. **`storageKey` da sessão Supabase = `hostname.split('.')[0]`.** Hostname completo quebra cookies (cross-subdomain) e gera login loop.

7. **Mutations sempre via API Route com `createAdminClient` (service role).** Nunca insert direto do client.

8. **`networkMode: 'always'` em TanStack Query global.** Sem isso, `navigator.locks` em tab inativa cria deadlock.

## Anti-padrões (NUNCA fazer)

- ❌ Importar `Slot`, `asChild` ou qualquer coisa de `@radix-ui/*` — não estamos no Radix.
- ❌ Usar `<ResponsiveContainer>` do Recharts.
- ❌ Chamar `supabase.auth.getSession()` ou `getUser()` dentro de hook ou componente — só `useAuth()`.
- ❌ Hardcodar role em array inline `['super_admin','diretor','gerente']` — usar constantes de `src/config/roles.ts`.
- ❌ Inserir/atualizar dados sensíveis direto do client com cliente público — sempre via API Route.
- ❌ Esquecer `proxy.ts matcher` excluindo `icon|apple-icon|opengraph-image` — favicon redireciona para login.
- ❌ Reescrever `CLAUDE.md` ou `DESIGN_SYSTEM_CLAUDE_CODE.md` inteiro — sempre edição cirúrgica (str_replace).
- ❌ Ler `ploomesapi.md` da raiz — usar a skill `ploomes-cachola-api`.

## Escopo desta skill

✅ **Cobre:** padrões recorrentes do stack que aparecem em qualquer tela ou rota do Cachola.
❌ **NÃO cobre:** integração Ploomes (skill `ploomes-cachola-api`), regras de RLS/migrations (futura skill Supabase Ops), conformidade LGPD (skill `lgpd-marco-civil-br`), regras de negócio dos módulos.
