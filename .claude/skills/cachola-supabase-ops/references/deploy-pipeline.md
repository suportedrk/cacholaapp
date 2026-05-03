# Deploy Pipeline — Cachola OS

O Cachola tem deploy **automático** via GitHub Actions: push em `main` → deploy para VPS Hostinger (KVM4, `187.77.255.31`). Esta referência cobre o pipeline, os gates, e o que pode dar errado.

## Visão geral

```
develop → PR → main → push origin main → GitHub Actions → SSH na VPS → deploy
```

Branches:
- **`develop`** — ambiente de homologação. Trabalho diário.
- **`main`** — produção. Toda mudança que chega aqui deploya automaticamente.

## Arquitetura do deploy

### O que roda na VPS

- **Node.js + Next.js** via PM2 — porta 3001, 2 instâncias (cluster mode).
- **Supabase self-hosted** via Docker Compose — Postgres, GoTrue (auth), PostgREST (API), Realtime, Storage, Kong (proxy).
- **Nginx** na frente — TLS, roteamento `/` → Next.js (3001), `/auth/*` → Kong (8000).

### Fluxo de deploy

1. Push em `origin/main` dispara `.github/workflows/deploy.yml`.
2. Workflow faz SSH na VPS (chave ED25519 v2 `~/.ssh/cacholaos_deploy_v2`, alias `cacholaos-vps`).
3. **Working tree gate** — aborta se VPS divergiu do git (mais sobre isso abaixo).
4. `git fetch && git reset --hard origin/main`.
5. `npm ci` (não `npm install` — lockfile drift estruturalmente prevenido).
6. Aplica migrations não rodadas (`docker exec -i supabase-db psql ...`).
7. `npm run build`.
8. `pm2 reload --update-env ecosystem.config.js`.

## Working tree gate — por que existe

**Lição da v1.5.2**: alguém (humano ou processo) tocou arquivos diretamente na VPS, fora do git. No próximo deploy, o `git reset --hard` apagou esses arquivos → erro 500 em produção.

**A correção (v1.5.3):** antes de `git reset`, o pipeline verifica:

```bash
# Aborta deploy se houver alterações em arquivos rastreados
if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  echo "❌ ERRO: working tree na VPS tem mudanças não commitadas"
  git status
  exit 1
fi
```

`grep -v '^??'` ignora arquivos **untracked** (novos, não rastreados — ok, são scripts soltos). Bloqueia apenas arquivos rastreados modificados (`M`, `D`, etc.).

**O que fazer se o gate disparar:**
1. SSH na VPS, ver `git status`.
2. Decidir: o que está modificado é importante? Se sim, commitar localmente o equivalente.
3. `git checkout <arquivo>` na VPS para restaurar.
4. Re-deploy.

## PM2 + `--update-env`

PM2 é o gerenciador de processos do Node em produção. Mantém Next.js rodando, reinicia se cair.

**Regra crítica:** `pm2 restart` **NÃO** recarrega variáveis de ambiente. Se você mudou `.env.production` e fez `pm2 restart`, processo continua com env antiga.

```bash
# ❌ Errado — env antiga continua
pm2 restart cacholaos

# ✅ Certo — recarrega env
pm2 reload --update-env ecosystem.config.js
# OU
pm2 restart cacholaos --update-env
```

`reload` é zero-downtime (substitui workers um por um). `restart` derruba e sobe — usar só se reload falhar.

A v1.5.3 também tornou `--update-env` **obrigatório no deploy.yml** — sem isso, mudança de env não chegava aos processos.

## `npm ci` vs `npm install`

Desde a v1.5.1 o pipeline usa `npm ci`:

```bash
npm ci   # ✅ valida package-lock.json, falha se há drift
npm install   # ❌ pode atualizar package-lock.json silenciosamente
```

`ci` (continuous integration) é mais estrito:
- Falha se `package-lock.json` ausente.
- Falha se `package-lock.json` desatualizado vs `package.json`.
- Apaga `node_modules/` antes de instalar — instala do zero.

Mais lento (~10-20s a mais), mas garante reprodutibilidade. Em produção, é o que se quer.

**No dev local você pode usar `npm install`** — só o pipeline obriga `npm ci`.

## Versão — `npm run version:patch`

Bump de versão sincroniza `package.json` E `package-lock.json` em um único comando:

```bash
npm run version:patch   # 1.5.3 → 1.5.4
npm run version:minor   # 1.5.3 → 1.6.0
npm run version:major   # 1.5.3 → 2.0.0
```

Isso roda `npm version <X> --no-git-tag-version` por baixo (configurado no script). Sem isso:
- Você esquece de atualizar lockfile → `npm ci` em prod falha.
- Você atualiza só lockfile e package fica desatualizado → outro tipo de drift.

**Sempre use o script, nunca edite manualmente.**

Convenção semver:
- `patch` (1.5.3 → 1.5.4) — fixes, ajustes pequenos.
- `minor` (1.5.3 → 1.6.0) — feature nova compatível.
- `major` (1.5.3 → 2.0.0) — break, raríssimo.

## TypeScript check antes de commit

```bash
tsc --noEmit | grep -v .next
```

Roda typecheck **sem gerar arquivos**. `grep -v .next` filtra warnings que vêm da pasta de build.

**Sempre antes de commit que toca TS** — pegar erros de tipo localmente é muito mais rápido que descobrir no CI 5 minutos depois.

## Workflow Git ideal — fluxo de uma feature

```bash
# 1. Partir do develop atualizado
git checkout develop
git pull

# 2. Trabalhar (ou via Claude Code) — múltiplos commits OK
# ...

# 3. Antes de commit final
tsc --noEmit | grep -v .next      # typecheck
npm run build                      # build local

# 4. Commit + push develop
git add .
git commit -m "feat(modulo): descricao curta"
git push origin develop

# 5. Validar em homologação (que aponta para develop)

# 6. Quando estável → PR develop → main no GitHub UI

# 7. Após merge para main: SINCRONIZAR develop
git checkout develop
git merge origin/main
git push origin develop
```

⚠️ **O passo 7 é frequentemente esquecido.** Se você não sincronizar, develop fica N commits atrás de main, e a próxima feature vai abrir PR com o histórico bagunçado.

## Anti-patterns Git

| Erro | Por quê é ruim | Correção |
|---|---|---|
| Commit em `main` direto | Pula PR, pula CI | Sempre via PR |
| Merge com CI vermelho | Quebra deploy | Aguardar verde |
| `git push --force` em main/develop | Apaga histórico de outros | Nunca |
| Esquecer sync develop → main | Histórico diverge | Passo 7 acima |
| `npm install` em vez de `npm ci` em CI | Lockfile drift | Configurado obrigatório no .yml |
| Editar `package.json`/lockfile manual | Dessincroniza | `npm run version:*` |

## Estrutura do `.github/workflows/deploy.yml`

```yaml
name: Deploy to VPS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key

      - name: Working tree gate
        run: |
          ssh -i ~/.ssh/deploy_key cacholaos-vps '
            cd /opt/cacholaapp
            if [ -n "$(git status --porcelain | grep -v "^??")" ]; then
              echo "❌ Working tree dirty"; git status; exit 1
            fi
          '

      - name: Pull + install + build
        run: |
          ssh -i ~/.ssh/deploy_key cacholaos-vps '
            cd /opt/cacholaapp
            git fetch && git reset --hard origin/main
            npm ci
            # apply migrations
            for m in supabase/migrations/*.sql; do
              docker exec -i supabase-db psql -U postgres < "$m" || true
            done
            npm run build
          '

      - name: PM2 reload
        run: |
          ssh -i ~/.ssh/deploy_key cacholaos-vps '
            cd /opt/cacholaapp
            pm2 reload --update-env ecosystem.config.js
          '
```

(Estrutura simplificada — o real tem mais validações, env loading, retries.)

## Rollback de deploy

Se o deploy quebrou prod:

### Opção A — Reverter o commit (preferido)
```bash
git revert <hash-do-commit-quebrado>
git push origin main
# Deploy automático aplica o revert
```

### Opção B — Hard rollback (emergência)
```bash
ssh cacholaos-vps
cd /opt/cacholaapp
git reset --hard <hash-do-commit-anterior>
npm ci
npm run build
pm2 reload --update-env ecosystem.config.js
```

⚠️ Opção B deixa VPS divergente do git → próximo deploy automático **vai falhar no working tree gate**. Você precisa fazer o `revert` no git logo em seguida.

## Versão atual

A versão está em `package.json`. Sempre que deploy roda, faça referência ao número (`v1.5.3`, etc.). Para ver a versão em prod:

```bash
ssh cacholaos-vps "cat /opt/cacholaapp/package.json | grep version"
```

## Checklist pré-deploy

- [ ] `tsc --noEmit | grep -v .next` passa local?
- [ ] `npm run build` passa local?
- [ ] CI verde no GitHub?
- [ ] Migrations testadas em dev local?
- [ ] PR review feita?
- [ ] Branch atualizada com main? (rebase ou merge)
- [ ] Mensagens de commit limpas?