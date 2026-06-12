# Cachola OS

Plataforma de operação diária (SaaS/PWA) do **Grupo DRK** para o buffet infantil **Buffet Cachola** — duas unidades (Pinheiros e Moema). Centraliza o que antes vivia espalhado em WhatsApp, planilhas e cadernos: eventos, checklists, manutenção, equipamentos, prestadores, comunicação interna, atas, calendário, BI e vendas (com integração ao CRM Ploomes).

> Projeto privado e proprietário do Grupo DRK.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5** (strict)
- **Tailwind v4** com tokens próprios (sage green / warm beige) — sem `tailwind.config.ts`
- **@base-ui/react** (não confundir com Radix/shadcn)
- **TanStack Query** (estado servidor) + **Zustand** (estado cliente)
- **Supabase self-hosted** (Docker) + **GoTrue** (auth)
- **Recharts**, PWA, Lucide, Sonner

## Ambientes

| Ambiente | Onde | Acesso |
|----------|------|--------|
| **Produção** | VPS Hostinger (Ubuntu 24.04 + Nginx + PM2 cluster) | https://cachola.cloud · Supabase em `api.cachola.cloud` |
| **Desenvolvimento** | VPS de dev (headless), dev server via PM2 (`cachola-dev`) | `localhost:3000` da VPS, acessado do notebook via túnel SSH / port-forward do VS Code · banco Docker `cacholaos-db` |

## Como rodar o dev

1. **Sempre** rodar antes o pre-flight de sincronia (skill `cachola-dev-sync`) — 4 checks que pegam "drift" entre o ambiente e a base compartilhada.
2. O dev server roda na VPS de dev pelo PM2 (`cachola-dev`); o acesso do notebook é via túnel SSH / port-forward do VS Code para `localhost:3000`.

Passo a passo completo: ver `CLAUDE.md` e as skills `.claude/skills/cachola-dev-sync` e `.claude/skills/cachola-visual-qa`.

## Deploy (produção)

Deploy é **só por git** — nunca editar arquivos direto na VPS.

`develop` (testes) → CI verde → `merge --no-ff main` → GitHub Actions deploya na VPS → migrations aplicadas **após** o deploy verde + `NOTIFY pgrst, 'reload schema'`.

Regras detalhadas: `CLAUDE.md` (seção GIT WORKFLOW) e skills `cachola-supabase-ops` / `cachola-vps-ops`.

## Documentação (fonte da verdade)

- **`CLAUDE.md`** — memória persistente do projeto. **Leia primeiro.**
- **`AGENTS.md`** — mapa de entrada para agentes de IA.
- **`docs/`** — `MODULES.md`, `DECISIONS.md`, `PERMISSIONS.md`, `API_PLOOMES.md`, `ops/`, `rbac/`.
- **`.claude/skills/`** — 7 skills com padrões reais e armadilhas do projeto.
