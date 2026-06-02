# Janela de Manutenção — Backup (alerta + verify) + Kernel/SO

**Data:** 2026-06-02
**Branch de trabalho:** develop → main (fluxo de ouro)
**Versão da app no fim:** v1.43.1
**Escopo deste documento:** registro institucional (doc-only, não altera comportamento)
**Rede de segurança:** snapshot Hostinger criado em 02/jun (válido até 22/jun, restauração ~30 min) — não foi necessário usar.

---

## Resumo executivo

Três etapas, todas concluídas e validadas em produção:

1. **Etapa 1 — Fix do falso positivo do alerta de backup** (v1.43.1).
2. **Etapa 2 — `backup-verify.sh` deixou de ser mudo** (migration 141 + scripts versionados).
3. **Etapa 3 — Atualização de kernel + 8 pacotes `-security`, reboot, e fix do `supabase-pooler`.**

Origem: auditoria somente-leitura do sistema de backup, que (a) explicou os e-mails de "backup diário não rodou" como **falso positivo** e (b) identificou que a verificação de backup detectava corrupção mas era **muda**.

---

## Etapa 1 — Falso positivo do alerta de backup (v1.43.1)

**Sintoma:** e-mails recorrentes "backup diário não rodou hoje" enquanto o painel `/admin/backups` não mostrava falha.

**Causa-raiz:** em `src/app/api/cron/backup-check/route.ts`, a verificação de "backup do dia" filtrava `kind='daily'`. Mas o `backup-full.sh` rotula a cópia como `weekly` aos domingos e `monthly` no dia 1º. Nesses dias **não existe linha `daily`**, então o alerta disparava à toa mesmo com backup bem-sucedido. **Não era descasamento de fuso** (servidor e processo Node rodam em UTC; `started_at` é `timestamptz` gravado em UTC).

**Correção:** a condição de "backup ausente" passou a contar **qualquer backup local bem-sucedido** desde a meia-noite UTC — `source='local'` + `status='success'`, ignorando o `kind` (`source='local'` cobre daily/weekly/monthly; o upload ao R2 usa `source='r2_upload'`). A condição de `status='failed'` ficou **intacta** (falhas reais seguem alertando em qualquer dia).

**Commits / merge:**
- `c871a17` fix(backup-check): contar qualquer backup local bem-sucedido, não só `kind='daily'`
- `5701796` chore(release): v1.43.1
- Merge em main: **`cafc994`**

---

## Etapa 2 — `backup-verify.sh` deixou de ser mudo (migration 141)

**Defeito de observabilidade:** o `backup-verify.sh` (cron 07:00 UTC) detectava corrupção (gzip/tamanho/checksum) mas **não enviava e-mail nem gravava no banco** — o erro morria em `/backup/logs/verify_*.log`, que ninguém lê.

**Abordagem:** reaproveitar a máquina de alerta existente. Quando há falha **real** (`ERRORS>0`; o `warn` de "backup velho" de domingos/dia 1º **não** conta), o verify grava **uma linha** em `public.backup_log` que o cron `backup-check` (condição `status='failed'`, agnóstica de `kind`/`source`) já transforma em e-mail.

**Decisões-chave:**
- **`source='verify'`** (novo valor): evita colidir com a linha de sucesso do `backup-full` pelo índice único `(kind, source, filename)` + `ON CONFLICT DO NOTHING`. Exigiu estender o CHECK da coluna `source` (antes só `local`/`r2_upload`).
- **Chave única por execução:** o `filename` embute o `TIMESTAMP` da execução do verify (`verify-failure_YYYYMMDD_HHMMSS`). Isso (a) nunca colide e (b) faz o alerta **reincidir a cada dia** enquanto a corrupção persistir (uma chave fixa seria engolida pelo `ON CONFLICT` e o alerta se calaria após o 1º dia).
- **O gravador não falha em silêncio:** se o `INSERT` der erro, o `psql` registra no log do verify e emite um `warn`, sem abortar (o `exit 1` da verificação continua).

**Migration:** `supabase/migrations/141_backup_log_source_add_verify.sql` (DDL pura, com rollback) — `CHECK (source IN ('local','r2_upload','verify'))`.

**CHECKs da tabela `backup_log` (confirmados):** `kind` ∈ {daily, weekly, monthly}; `status` ∈ {in_progress, success, failed}; `source` ∈ {local, r2_upload, **verify**}.

**Scripts agora versionados:** os 3 scripts de infra (`backup-full.sh`, `upload-to-r2.sh`, `backup-verify.sh`) foram trazidos para **`ops/backup/`** (cópia fiel da VPS, sha256 conferido). Antes existiam **apenas na VPS**, fora do git. Há `.gitattributes` forçando LF nesses `.sh` (evita CRLF quebrar o shebang no Linux).

> ⚠️ **Versionar ≠ deployar.** `/opt/scripts/backup/` (onde o cron roda) fica **fora** de `/opt/cacholaapp`, então o `deploy.yml` não o atualiza. A aplicação do script corrigido na VPS foi um passo manual controlado (com `.bak` do anterior). Qualquer mudança futura nesses scripts exige o mesmo: editar no repo → copiar para `/opt/scripts/backup/` guardando `.bak`.

**Validação em produção:** backup inválido em diretório scratch → verify gravou `daily | verify | failed | verify-failure_…` → `backup-check` enviou **exatamente 1 e-mail** (dedup confirmado); limpeza da linha de teste e do registro de dedup; `backup-check` voltou a "saudável".

**Commits / merge:**
- `3b5337c` chore(ops): versionar scripts de backup da VPS
- `8843f87` feat(backup-log): permitir `source='verify'` no CHECK (migration 141)
- `d711104` feat(backup-verify): alertar falha via linha `status='failed'`
- `6295c91` fix(backup-verify): não silenciar falha do próprio gravador
- Merge em main: **`da4fedb`**

---

## Etapa 3 — Kernel 6.8.0-124 + `-security`, reboot, fix do pooler

**Objetivo:** ativar o kernel novo e aplicar os pacotes de segurança pendentes.

**Escopo aplicado:** apenas **kernel `6.8.0-124`** + os **8 pacotes `-security`** (`liblzma5`, `xz-utils`, `linux-image-virtual`, `linux-headers-virtual`, `linux-virtual`, `linux-headers-generic`, `linux-libc-dev`, `linux-tools-common`). **NÃO** atualizados: Docker/containerd/buildx/compose-plugin e snapd; `cloud-init` permaneceu em hold.

**Lição técnica — `apt-get upgrade` segura o kernel:** a simulação mostrou que `apt-get upgrade` deixaria o kernel **"kept back"** (ir de 117→124 exige instalar pacotes novos, e `upgrade` sem `dist` nunca instala pacote novo). Solução: **install cirúrgico explícito** dos 8 pacotes, que puxa o kernel 124 como dependência — `8 upgraded, 6 newly installed (= o próprio 124), 0 removed`. Também segurado o `docker-ce-rootless-extras` (pacote do Docker que não estava na lista de holds).

**Pré-reboot:** `pm2 save` para o dump (`/root/.pm2/dump.pm2`) capturar o estado atual (2 instâncias cluster); snapshot Hostinger. **Sem `autoremove`** (kernels 111/117 preservados até confirmar o boot no 124).

**Pós-reboot — validação:** `uname -r` = `6.8.0-124-generic` ✅; `reboot-required` sumiu ✅; PM2 ressuscitou as 2 instâncias cluster ✅; nginx ativo ✅; `https://cachola.cloud` → 200 (`/`→`/login`) ✅; `backup-check` saudável ✅.

**Incidente no boot — `supabase-pooler` em crash-loop:** o entrypoint do supavisor executa `ulimit -n 100000`, mas **após o reboot o limite de arquivos do `dockerd` voltou em 65535** (hard), então o comando falhava (`Operation not permitted`) e o container reiniciava em loop. **Impacto no site: nenhum** — o app usa `DATABASE_URL` direto na porta 5432 e Kong/PostgREST (8000); o pooler (supavisor, 6543) não está no caminho crítico.

**Fix cirúrgico (Opção 1):** override de `ulimits` **apenas** no serviço `supavisor` do `docker-compose.yml` do Supabase (`soft: 100000`, `hard: 1048576`) + recriar **somente** o pooler (`docker compose up -d --no-deps supavisor`). `.bak` datado do compose criado antes. Resultado: pooler `healthy`, `restarts=0`, `ulimit` interno 100000/1048576; os outros 12 containers + `supabase-db` **intactos**; 13/13 no ar.

> ⚠️ A causa-raiz no `dockerd` (LimitNOFILE de 65535) **não** foi corrigida nesta janela — fica para a janela dedicada do Docker (ver pendências).

---

## Pendências em aberto (próximas janelas)

1. **Janela dedicada do Docker** (causa-raiz + upgrade juntos):
   - Subir o `LimitNOFILE` do `docker.service` (drop-in systemd) — corrige a raiz do problema do pooler para todos os containers. Reinicia os 13 containers (blip breve no Supabase), por isso janela dedicada.
   - Atualizar **Docker/containerd/buildx/compose-plugin** e **snapd** (ficaram de fora desta rodada).
2. **Limpeza de kernels antigos:** `apt-get autoremove` para remover `linux-image-6.8.0-111` (e eventualmente o `117`), **somente após** confirmar estabilidade no `6.8.0-124`.
3. **Versionar o `docker-compose.yml` do Supabase:** hoje vive só na VPS (`/opt/supabase/supabase/docker/`), fora do git — o override de `ulimits` do pooler está aplicado lá mas não rastreado. Trazer para o repo (à la `ops/backup/`) para ter histórico/revisão.

## Débitos relacionados (já conhecidos, do CLAUDE.md)

- `backup_log` só registra o `_db.sql.gz`; `_storage.tar.gz` e `_config.tar.gz` não geram linha própria — uma falha só neles não apareceria no painel. (Mudança moderada no `backup-full.sh`, separável.)
- `cloud-init` permanece em hold (mantido como está, por decisão).
