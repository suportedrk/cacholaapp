# Bootstrap — Subir o Supabase self-hosted do zero (Produção)

> Referência de recuperação de desastre e de provisionamento de um servidor novo de produção do Cachola OS.
> Última verificação contra a produção: jun/2026 (via `docker ps` + labels do Compose).

## ⚠️ Antes de tudo: qual é a fonte da verdade

A produção do Cachola OS **NÃO** usa um `docker-compose` caseiro. Ela roda o **Supabase self-hosted oficial**, clonado na VPS.

- Caminho na VPS de produção: `/opt/supabase/supabase/docker/`
- Projeto Docker Compose: `supabase`
- Compose real: `/opt/supabase/supabase/docker/docker-compose.yml` (oficial, editado in-place)

**NÃO use** os arquivos `docker-compose.yml` / `docker-compose.prod.yml` que existem na raiz do repo `cacholaapp` — são maquetes antigas e divergentes (nomes de contêiner, domínio e versões errados; sem o pooler). Estão marcados para aposentadoria.

O app Next.js (Cachola OS) **não** faz parte desse Compose: roda à parte, via **PM2** no host, e se conecta ao Supabase pelo **Kong** (porta 8000) → **Nginx** do host → `https://api.cachola.cloud`.

## Stack de produção (conjunto "known-good")

13 serviços. Versões de imagem em produção (jun/2026) — fixar nestas para reproduzir o ambiente atual:

| Serviço | Contêiner | Imagem |
|---|---|---|
| Postgres | `supabase-db` | `supabase/postgres:15.8.1.085` |
| Pooler | `supabase-pooler` | `supabase/supavisor:2.7.4` |
| REST | `supabase-rest` | `postgrest/postgrest:v14.6` |
| Auth | `supabase-auth` | `supabase/gotrue:v2.186.0` |
| Storage | `supabase-storage` | `supabase/storage-api:v1.44.2` |
| Edge Functions | `supabase-edge-functions` | `supabase/edge-runtime:v1.71.2` |
| Kong (gateway) | `supabase-kong` | `kong/kong:3.9.1` |
| Studio | `supabase-studio` | `supabase/studio:2026.03.16-sha-5528817` |
| Analytics | `supabase-analytics` | `supabase/logflare:1.31.2` |
| Meta | `supabase-meta` | `supabase/postgres-meta:v0.95.2` |
| Realtime | `realtime-dev.supabase-realtime` | `supabase/realtime:v2.76.5` |
| Vector (logs) | `supabase-vector` | `timberio/vector:0.53.0-alpine` |
| Imgproxy | `supabase-imgproxy` | `darthsim/imgproxy:v3.30.1` |

> **Atenção:** clonar o `master` do repo oficial traz versões **mais novas**. Para reproduzir a produção exatamente, fixe as tags acima no `docker-compose.yml`/`.env` depois do clone.

## Pré-requisitos

- VPS Linux (Ubuntu) com Docker + Docker Compose v2.
- Domínio `api.cachola.cloud` apontando para o IP da VPS; portas 80/443 liberadas.
- Nginx no host (reverse proxy + SSL) — config completa em `references/infra-config.md`.

## Passo a passo

### 1. Clonar o Supabase oficial

```
sudo mkdir -p /opt/supabase && cd /opt/supabase
sudo git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

Estrutura final: `/opt/supabase/supabase/docker/`.

### 2. Configurar o `.env`

```
cp .env.example .env
```

Preencher (NUNCA commitar segredos). Variáveis críticas:

- `POSTGRES_PASSWORD` — senha do banco.
- `JWT_SECRET` — segredo JWT; **gerar `ANON_KEY` e `SERVICE_ROLE_KEY` a partir dele** (ver docs oficiais — usar as chaves demo do `.env.example` quebra a auth).
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — acesso ao Studio.
- `SITE_URL=https://cachola.cloud`
- `API_EXTERNAL_URL=https://api.cachola.cloud`
- `ADDITIONAL_REDIRECT_URLS` — redirect URLs do GoTrue (o nome antigo `GOTRUE_URI_ALLOW_LIST` está deprecated). Valores exatos em `references/infra-config.md`.
- SMTP do GoTrue — `smtp.hostinger.com:465`, remetente `noreply@cachola.cloud`. Variáveis completas em `references/infra-config.md`.

Lista completa de variáveis: o `.env.example` do próprio repo oficial.

### 3. ⭐ Customização obrigatória nossa: `ulimit` do pooler

No serviço `supabase-pooler` (supavisor) do `docker-compose.yml`, adicionar:

```
    ulimits:
      nofile:
        soft: 100000
        hard: 1048576
```

**Por quê:** o `LimitNOFILE` do Docker volta para 65535 a cada reboot do host; o pooler (supavisor) precisa de 100000, senão entra em loop de reinício após qualquer reboot. Esta é a **única** diferença do nosso Compose vs. o oficial (confirmada em jun/2026, diff do `docker-compose.yml.bak.20260602`).

### 4. Subir a stack

```
docker compose pull
docker compose up -d
docker ps        # todos os 13 serviços devem ficar (healthy)
```

### 5. Aplicar as migrations do Cachola OS

As migrations **não** estão no repo do Supabase — estão no repo `cacholaapp`, em `supabase/migrations/`. Aplicar na ordem e, **sempre ao final**, recarregar o cache do PostgREST:

```
docker exec -i supabase-db psql -U postgres -d postgres < <migration>.sql
# após aplicar a leva:
docker exec -i supabase-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

Procedimento detalhado: `references/migrations.md`.

**Gotcha do seed do admin:** `INSERT` direto em `auth.users` exige os campos de token como `''` (não `NULL`), senão o login retorna HTTP 500 — prefira o `inviteUserByEmail` da SDK GoTrue. Lista de campos e exemplo: `references/infra-config.md`.

### 6. Ligar o app e o Nginx

- **Nginx do host:** `api.cachola.cloud` → Kong (`:8000`); `cachola.cloud`/`app.cachola.cloud` → app (`:3001`). Buffers grandes obrigatórios (`proxy_buffer_size 128k` / `proxy_buffers 4 256k`) — sem isso, cookies grandes do OAuth estouram o default e o login quebra. **Nunca** mexer no `location /realtime/` (WebSocket). Os dois server blocks completos: `references/infra-config.md`.
- **App (PM2, cluster na porta 3001):** `NEXT_PUBLIC_SUPABASE_URL=https://api.cachola.cloud` + `ANON_KEY` / `SERVICE_ROLE_KEY`.

## Perrengues de primeira inicialização (checklist)

- [ ] **`ulimit` do pooler** (passo 3) — sem isso, quebra no 1º reboot.
- [ ] **`NOTIFY pgrst`** após cada leva de migrations via `psql` — senão funções novas ficam invisíveis ("Could not find function in schema cache").
- [ ] **`docker compose restart` NÃO aplica `.env` nova** — usar `docker compose up -d --force-recreate <serviço>`.
- [ ] **Campos de token `''` (não `NULL`)** no `auth.users` (passo 5).
- [ ] **Chaves**: `ANON_KEY`/`SERVICE_ROLE_KEY` derivadas do `JWT_SECRET` (não usar as demo).
- [ ] **Migration 028** bloqueia login de Gmail não cadastrado — comportamento esperado, não é bug.
- [ ] **`CREATE OR REPLACE`** com assinatura mudada cria *overload*, não substitui — dropar a assinatura antiga antes.
- [ ] **Versões**: clone do `master` traz tags mais novas; fixar no conjunto known-good acima.

## Validação final

```
docker ps                                                          # 13 serviços (healthy)
curl https://api.cachola.cloud/auth/v1/health                      # ok
curl -o /dev/null -w "%{http_code}\n" https://cachola.cloud/login  # 200
```

## Versionamento (estado atual e meta)

Hoje o compose vive **editado in-place na VPS, com backups datados** (`docker-compose.yml.bak.AAAAMMDD`) — não versionado. Meta da Frente A: versionar no repo `cacholaapp` o que é nosso e reproduzível:

- este guia;
- o `.env.example` sanitizado;
- o trecho do `ulimit` do pooler (patch documentado);
- o conjunto de versões pinadas.

Não copiar o `docker-compose.yml` oficial inteiro (apodrece / diverge do upstream).

## Referências internas (mesma skill)

- `references/infra-config.md` — **detalhe de toda a config de servidor**: Nginx (buffers, bloco `/realtime/`, os dois server blocks), GoTrue (redirect URLs, SMTP, `--force-recreate`, `auth.users`), S3/backups.
- `references/migrations.md` — procedimento completo de migrations.
- `references/deploy-pipeline.md` — deploy via GitHub Actions e PM2.
- `references/incidents-playbook.md` — se algo quebrar durante ou depois do bootstrap.

## Referências oficiais

- Self-hosting: <https://supabase.com/docs/guides/self-hosting>
- Self-hosting com Docker: <https://supabase.com/docs/guides/self-hosting/docker>
- Restaurar projeto para self-hosted: <https://supabase.com/docs/guides/self-hosting/restore-from-platform>
- Repo oficial: github.com/supabase/supabase (pasta `docker/`)
