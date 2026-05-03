# Infra Config — Nginx, GoTrue, S3

Esta referência cobre as **três peças de configuração de servidor** que mais aparecem no Cachola: Nginx (proxy reverso), GoTrue (Supabase auth) e S3 (backups + storage).

---

# 1. Nginx

Nginx é o porteiro: TLS, roteamento de domínio, headers, buffer.

## Configurações no servidor

```
/etc/nginx/sites-available/cacholaos        # frontend (Next.js)
/etc/nginx/sites-available/supabase-api     # backend (Kong → Supabase)
```

Ambos enabled em `/etc/nginx/sites-enabled/`. Edição via `sudo` direto, mudanças via `sudo nginx -t` (test) + `sudo systemctl reload nginx`.

## ⚠️ Buffer size — CRÍTICO

Cookies de OAuth (Google) podem chegar a **8-12KB** quando incluem todos os scopes pedidos. Default Nginx `proxy_buffer_size` é **4KB** → request quebra com `502` ou `upstream sent too big header`.

**Solução já aplicada nos dois configs:**

```nginx
# AMBOS os configs (cacholaos e supabase-api) precisam disso
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

⚠️ **Sem isso, login com Google quebra silenciosamente.** Já sangramos. Não tirar.

## ⚠️ NÃO TOCAR no bloco `/realtime/`

```nginx
location /realtime/ {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

Isso é WebSocket. `Upgrade` e `Connection` headers são essenciais. `proxy_read_timeout 86400` (24h) impede que o Nginx mate conexões longas.

**Se você "limpar" esse bloco, realtime/notificações em tempo real param.** Subscribers no frontend ficam mudos sem erro óbvio.

## Estrutura típica do `cacholaos` (frontend)

```nginx
server {
    listen 443 ssl http2;
    server_name app.cachola.cloud cachola.cloud;

    ssl_certificate ...;
    ssl_certificate_key ...;

    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name app.cachola.cloud cachola.cloud;
    return 301 https://$host$request_uri;
}
```

## Estrutura típica do `supabase-api`

```nginx
server {
    listen 443 ssl http2;
    server_name api.cachola.cloud;

    ssl_certificate ...;
    ssl_certificate_key ...;

    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    location / {
        proxy_pass http://localhost:8000;  # Kong (Supabase)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /realtime/ {
        # NÃO TOCAR — WebSocket
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## Testes seguros

```bash
sudo nginx -t                       # valida config (não recarrega)
sudo systemctl reload nginx         # aplica sem downtime
sudo tail -f /var/log/nginx/error.log
```

Sempre `nginx -t` antes de reload. Config inválida + reload = Nginx para = site fora.

---

# 2. GoTrue (Supabase Auth)

GoTrue é o serviço que cuida de login, signup, recovery. Roda como container Docker no Supabase self-hosted.

## Variáveis de ambiente críticas

No `docker-compose.yml` (ou `.env` lido por ele):

### Redirect URLs

```env
ADDITIONAL_REDIRECT_URLS=https://app.cachola.cloud/auth/confirm,https://app.cachola.cloud/auth/callback,https://app.cachola.cloud/**
```

⚠️ **Atenção:** o nome **antigo** dessa variável é `GOTRUE_URI_ALLOW_LIST`. Está deprecated. **Use `ADDITIONAL_REDIRECT_URLS`** — versões recentes do GoTrue ignoram o nome antigo silenciosamente.

Sem essa env corretamente configurada, qualquer link de email (recovery, invite, magic link) volta para `localhost:3000` ou retorna `redirect_to is not allowed`.

### Mailer external hosts

```env
GOTRUE_MAILER_EXTERNAL_HOSTS=api.cachola.cloud
```

Se ausente, GoTrue emite warning não-crítico no boot. **Não confundir com erro.** Setar essa variável só suprime ruído.

### SMTP

```env
GOTRUE_SMTP_HOST=smtp.hostinger.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=noreply@cachola.cloud
GOTRUE_SMTP_PASS=<senha>
GOTRUE_SMTP_ADMIN_EMAIL=noreply@cachola.cloud
GOTRUE_SMTP_SENDER_NAME=Cachola
```

SMTP do GoTrue é **separado** do nodemailer da app Next.js — são duas camadas:
- **GoTrue SMTP**: emails de auth (invite, recovery, magic link).
- **Nodemailer (Next.js)**: emails de aplicação (vendas, alerta de backup, etc.).

## Mudou env? Force recreate

```bash
# ❌ Errado — env nova NÃO carrega
docker compose restart supabase-auth

# ✅ Certo — recreate força nova env
docker compose up -d --force-recreate supabase-auth
```

`docker compose restart` apenas reinicia o processo no container existente, com env do startup original. Para mudança de env entrar em vigor, é `--force-recreate`.

⚠️ Já sangramos isso. Por minutos achando que GoTrue ignorou a env, quando na verdade só não tinha sido recarregada.

## Auth users — token fields obrigatórios

INSERT direto em `auth.users` (não recomendado, mas ocasionalmente necessário em scripts) **exige preencher todos os token fields como string vazia, não NULL**:

```sql
-- ❌ Falha com erro 500 silencioso ao tentar login
INSERT INTO auth.users (id, email, ...)
VALUES (...);  -- sem confirmation_token, recovery_token, etc.

-- ✅ Funciona
INSERT INTO auth.users (
  id, email,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current,
  ...
)
VALUES (
  ..., ..., '', '', '', '', ...
);
```

**Preferir: `inviteUserByEmail` da SDK GoTrue.** Faz tudo certo, com a vantagem de mandar email de boas-vindas.

## Auth users → public.users — NÃO cascateia

```sql
DELETE FROM auth.users WHERE id = '<uuid>';
-- public.users NÃO é deletada automaticamente
-- Você precisa fazer:
DELETE FROM public.users WHERE id = '<uuid>';
```

Isso é por design (Supabase). Cascade entre schemas é evitado para não causar deletions acidentais. **Sempre deletar nos dois lugares**, ou usar uma RPC que faz ambos atomicamente.

---

# 3. S3 (backups e storage)

Cachola usa S3 (compatível) para:
- **Backups automáticos** do Postgres (cron 5h BRT, alerta de saúde via email).
- **Presigned URLs** de download para usuários (15min TTL).

## Variáveis ENV

```env
# Em produção
GLOBAL_S3_BUCKET=<nome-do-bucket>
GLOBAL_S3_REGION=<regiao>
GLOBAL_S3_ACCESS_KEY=<key>
GLOBAL_S3_SECRET_KEY=<secret>
GLOBAL_S3_ENDPOINT=<url-se-nao-AWS>  # ex: B2, Cloudflare R2

# Em DEV LOCAL — obrigatório, mesmo sem usar
GLOBAL_S3_BUCKET=stub
```

⚠️ `GLOBAL_S3_BUCKET=stub` em dev é **obrigatório**. Sem ele, o módulo de S3 tenta inicializar `S3Client` no boot e trava porque vê `undefined`. Stub é uma string mágica entendida pelo código como "não tem S3 real".

## Backups — UI em `/admin/backups`

Migration 067 criou:
- Tabela `backup_log` (RLS `super_admin+diretor`).
- Cron diário 5h BRT que faz dump, upload S3, registra em `backup_log`.
- Email diário (alerta de saúde) confirmando que o cron rodou.

**Se não chegar email às 5h:** algo travou. Investigar:
1. `pm2 logs cacholaos | grep backup`
2. `docker logs supabase-db | grep dump`
3. Verificar acesso S3 (credentials? bucket existe?).

## Presigned URLs — TTL curto

Quando usuário clica para baixar arquivo:

```ts
// src/lib/storage/presigned.ts
const url = await s3.getSignedUrlPromise('getObject', {
  Bucket: process.env.GLOBAL_S3_BUCKET,
  Key: filePath,
  Expires: 15 * 60,  // 15 minutos
})
```

15 minutos é suficiente para o user clicar e baixar. Mais que isso = link compartilhável fora do contexto. Se aplicação precisa de mais (ex: download muito grande), gere URL on-demand a cada vez.

---

# Resumo — quando mexer em quê

| Coisa que está errada | Onde olhar |
|---|---|
| Login Google em loop / 502 no auth | Nginx buffer + GoTrue redirects |
| Email recovery não chega | GoTrue SMTP_* + recreate auth |
| Realtime parou | Nginx `/realtime/` block |
| Backup não rodou | S3 credentials, cron, `backup_log` |
| Download falha 403 | Presigned URL expirada (TTL 15min) |
| App-level email não envia | Nodemailer (SMTP_* na env Next.js, NÃO GoTrue) |