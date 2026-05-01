---
name: cachola-supabase-ops
description: Padrões de banco, segurança e infraestrutura do Cachola OS — migrations Supabase (numeração NNN_, RPCs, helpers), Row Level Security (RLS) com actions view/create/edit/delete, deploy via GitHub Actions com gate de working tree, GoTrue (variáveis de ambiente, redirect URLs, force-recreate), Nginx (proxy_buffer_size, realtime), S3 (backups, GLOBAL_S3_BUCKET=stub), e playbook de incidentes. Use SEMPRE que o trabalho envolver criar/editar migrations, políticas RLS, schema de tabelas, mexer no `deploy.yml`, configurações Nginx em `/etc/nginx`, env vars de Docker compose do Supabase, ou quando precisar entender um incidente em produção. Dispare também ao tocar em arquivos `supabase/migrations/`, `.github/workflows/deploy.yml`, `docker-compose.yml`, ou logs de produção da VPS.
---

# Cachola OS — Supabase, Deploy & Infra

Esta skill cobre toda a camada **abaixo do código de aplicação**: banco de dados, segurança em nível de linha (RLS), pipeline de deploy, configuração da VPS, e o que fazer quando algo dá errado em produção.

## Filosofia

- **Migrations são imutáveis depois de aplicadas.** Numeração `NNN_descritivo.sql`, jamais reescrever uma já em prod.
- **RLS é padrão**, não exceção. Toda tabela nasce com RLS ativado e políticas explícitas.
- **Deploy tem 3 gates** (working tree, typecheck, build) — se algum falha, deploy aborta antes de tocar VPS.
- **Service role key vive no servidor**, nunca no browser. Mutations sensíveis sempre via API Route.
- **Incidentes têm playbook**, não improvisação. v1.5.2 ensinou caro.

## Quando consultar cada referência

| Tarefa | Leia |
|---|---|
| Criar nova migration, alterar schema, adicionar RPC | `references/migrations.md` |
| Escrever política RLS, helpers, SECURITY DEFINER | `references/rls-policies.md` |
| Mexer no `deploy.yml`, GitHub Actions, PM2 | `references/deploy-pipeline.md` |
| Algo quebrou em prod e preciso reagir | `references/incidents-playbook.md` (LEIA PRIMEIRO) |
| Mudar env do GoTrue, Nginx, ou S3 | `references/infra-config.md` |
| Adicionar/editar role, lembrar de constantes | `references/rbac-reference.md` |
| Criar MODULO NOVO do zero (do banco a UI) — passo a passo de permissoes | `references/novo-modulo-permissoes.md` |

## Padrões críticos (decorar)

Os mandamentos do Cachola para banco/infra. Cada um foi pago com sangue ou tempo:

1. **Migrations: numeração sequencial `NNN_descritivo.sql`** com 3 dígitos. Nova migration = próximo número + nome em snake_case. Nunca pular número, nunca duplicar.

2. **Migration aplicada em prod = imutável.** Para corrigir, criar **nova** migration que ajusta. Nunca editar a antiga.

3. **`docker exec -i supabase-db psql` ANTES de `npm run build`.** Sem schema novo aplicado, o build pode passar mas runtime quebra.

4. **RLS actions são `view/create/edit/delete`** — nunca `read/write/admin`. Nomenclatura padronizada do Cachola.

5. **`auth.users` NÃO cascateia para `public.users`.** Deletar usuário é deleção em **dois lugares**, manualmente.

6. **`auth.users` INSERT direto exige token fields non-NULL** (`confirmation_token`, `recovery_token`, `email_change_token_*`). Ou retorna 500 silencioso. **Use `inviteUserByEmail` em vez de INSERT manual.**

7. **`storageKey` da sessão = `hostname.split('.')[0]`** — hostname completo quebra cookies cross-subdomain. (Já documentado em `cachola-stack/auth-and-session.md` também — é tão crítico que vale repetir.)

8. **Deploy: gate de working tree no VPS bloqueia se servidor estiver "fora do git"**. Se um arquivo foi tocado direto na VPS sem commit, deploy aborta antes de sobrescrever — protege contra perda silenciosa (lição da v1.5.2).

9. **`pm2 restart` não recarrega env vars.** Use `pm2 restart --update-env` ou `pm2 reload --update-env`.

10. **Mudou env do Docker compose? `docker compose up -d --force-recreate <serviço>`.** Restart sozinho não recarrega `.env`.

## Anti-padrões (NUNCA fazer)

- ❌ Editar migration já em produção. Sempre criar nova.
- ❌ INSERT direto em `auth.users` sem preencher token fields. Use API GoTrue.
- ❌ DELETE em `auth.users` esperando que `public.users` saia junto — não cascateia.
- ❌ Commit direto em `main`. Só por PR a partir de `develop`.
- ❌ Merge com CI vermelho.
- ❌ `pm2 restart` sem `--update-env` quando trocou env var.
- ❌ Tocar arquivo direto na VPS fora do git. Tudo via deploy.
- ❌ Hardcodar UUIDs em migration (`gen_random_uuid()` em prod ≠ valor de dev).
- ❌ Esquecer `proxy_buffer_size 128k` no Nginx — cookies OAuth (~8-12KB) estouram default 4KB e quebram login.
- ❌ Mexer no bloco `location /realtime/` do Nginx — é WebSocket, configuração delicada.

## Escopo desta skill

✅ **Cobre:** schema, RLS, deploy, infra, incidentes, e referência cruzada com RBAC.
❌ **NÃO cobre:** lógica de UI/auth client-side (skill `cachola-stack`), integração Ploomes (skill `ploomes-cachola-api`), conformidade LGPD (skill `lgpd-marco-civil-br`).