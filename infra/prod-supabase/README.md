# Supabase self-hosted (produção) — referência de Disaster Recovery

> Fonte de verdade versionada do **stack Supabase de produção**. Antes existia
> só na VPS (`/opt/supabase/supabase/docker`) e não no git — risco de DR.
> Resolve o item "versionar o docker-compose.yml do Supabase no git" do backlog.

## O que roda em produção

O Supabase de prod **não é um compose próprio nosso** — é um **clone da stack
oficial self-hosted** do Supabase, com poucas customizações locais:

| Item | Valor |
|------|-------|
| Repositório upstream | `https://github.com/supabase/supabase` |
| Commit fixado (prod em jun/2026) | `4189e76341a711c0be7605bedfb14aa7b58bcf95` |
| Caminho na VPS de prod | `/opt/supabase/supabase/docker` |
| Containers | `supabase-db`, `-kong`, `-auth`, `-rest`, `-realtime`, `-storage`, `-studio`, `-meta`, `-analytics`, `-pooler`, `-vector`, `-imgproxy`, `-edge-functions` |
| App Next.js | **NÃO** roda em Docker em prod — roda via **PM2** (`cacholaos`) + Nginx |

> ⚠️ O arquivo `/opt/cacholaapp/docker-compose.yml` na VPS é **leftover** — nenhum
> container o utiliza. Não faz parte do stack de produção; candidato a remoção
> (housekeeping).

## Customizações locais (vs upstream)

Capturadas em [`docker-compose.custom.patch`](./docker-compose.custom.patch)
(15 inserções / 7 remoções). Resumo:

1. **Studio** publicado só em `127.0.0.1:3000:3000` (não exposto à internet; chega por túnel SSH).
2. **Kong** HTTPS (`8443`) preso a `127.0.0.1`.
3. **Pooler/Supavisor** (`5432`, `6543`) presos a `127.0.0.1`.
4. **Supavisor `ulimits.nofile`** = soft `100000` / hard `1048576` — mitiga o reset
   de `LimitNOFILE` do dockerd no reboot que quebrava o pooler (ver backlog de
   manutenção). **Já presente no compose de prod.**
5. **GoTrue**: e-mail de **convite** (`GOTRUE_MAILER_TEMPLATES_INVITE`,
   `GOTRUE_MAILER_SUBJECTS_INVITE`).
6. **GoTrue**: **Google OAuth** habilitado, redirect `https://api.cachola.cloud/auth/v1/callback`.

Nenhum segredo está no patch — tudo é `${VAR}` (vindo do `.env`) exceto a URL
pública de callback.

## Variáveis de ambiente

O arquivo real `docker/.env` (4 KB, com segredos) **vive somente na VPS** e em
cofre separado — nunca no git. As **chaves** esperadas estão em
[`.env.example`](./.env.example) com valores mascarados. Segredos a recuperar do
cofre/regenerar: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`,
`SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`,
`DASHBOARD_PASSWORD`, `LOGFLARE_*`, `SMTP_PASS`, `GOOGLE_SECRET`.

## Reconstrução (Disaster Recovery)

```bash
# 1. Clonar a stack oficial no commit fixado
git clone https://github.com/supabase/supabase /opt/supabase/supabase
cd /opt/supabase/supabase
git checkout 4189e76341a711c0be7605bedfb14aa7b58bcf95

# 2. Aplicar as customizações locais
git apply /caminho/para/infra/prod-supabase/docker-compose.custom.patch
#   (validar antes:  git apply --check docker-compose.custom.patch)

# 3. Recriar docker/.env a partir do .env.example + cofre de segredos
cp /caminho/para/infra/prod-supabase/.env.example docker/.env
#   editar docker/.env preenchendo os valores reais (segredos do cofre)

# 4. Restaurar dados (ver CLAUDE.md → "Disaster Recovery — Procedimento" / R2)
#    e subir o stack
cd docker && docker compose up -d
```

## Manutenção deste diretório

Quando o compose de prod for alterado (nova customização, bump do upstream),
**re-gerar o patch e atualizar o commit fixado aqui**:

```bash
cd /opt/supabase/supabase
git rev-parse HEAD                                   # novo ref para o README
git diff docker/docker-compose.yml > docker-compose.custom.patch
```
