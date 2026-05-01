# Playbook de Incidentes — Cachola OS

Esta é a referência **mais importante** quando algo está quebrado em produção. Se você está aqui em modo de pânico, **respira**, lê do começo, e não pula passos.

## Os 4 estágios de qualquer incidente

```
1. DETECTAR (algo está errado?)
2. CONTER (impedir que piore)
3. CORRIGIR (restaurar serviço)
4. APRENDER (postmortem, prevenção)
```

**Nunca pule o 1.** A causa que parece óbvia frequentemente não é. Diagnosticar 3 minutos a mais economiza horas de gambiarra.

## Estágio 1 — Detectar

### Sintomas comuns e primeiros suspeitos

| Sintoma | Suspeitar primeiro de |
|---|---|
| Login não funciona, fica em loop | `storageKey` errado, cookies não compartilhados, GoTrue env vars |
| HTTP 500 em qualquer rota | Build quebrou, env var faltando, banco fora |
| HTTP 502/504 | PM2 caiu, Nginx → upstream falhou |
| Webhook Ploomes não chega | URL mudou, ValidationKey inválido, webhook removido pelo Ploomes |
| Email não envia (invite, recovery) | SMTP credentials, GoTrue vars, nodemailer config |
| Realtime não atualiza | Bloco `/realtime/` no Nginx, WebSocket quebrado |
| BI/dashboards lentos | Postgres sem índice, RPC com EXPLAIN ruim |
| Login funciona mas dados não vêm | RLS bloqueando, helper retornando vazio |
| Após deploy: 500 imediato | Migration nova não rodou, env var nova faltando |
| Aleatório, intermitente | Rate limit (Ploomes 429), Postgres connection pool |

### Comandos de diagnóstico rápido

```bash
# 1. Health geral da VPS
ssh cacholaos-vps
htop                                  # CPU/RAM saudáveis?
df -h                                 # disco não estourou?

# 2. Aplicação Next.js
pm2 status                            # processos online?
pm2 logs cacholaos --lines 100        # últimos logs

# 3. Supabase
docker ps                             # containers rodando?
docker logs supabase-db --tail 100    # erros no Postgres?
docker logs supabase-auth --tail 100  # erros no GoTrue?
docker logs supabase-rest --tail 100  # erros no PostgREST?

# 4. Nginx
sudo nginx -t                         # config válida?
sudo tail -f /var/log/nginx/error.log

# 5. Conectividade
curl -I https://app.cachola.cloud     # frontend responde?
curl -I https://api.cachola.cloud     # API Supabase responde?
```

### Ler logs com método

Em vez de `tail -f` aleatório, **filtrar pelo tempo do incidente:**

```bash
# Logs PM2 desde 14:30
pm2 logs cacholaos --lines 500 | grep -E "1[45]:[0-9]{2}"

# Logs Postgres das últimas 30 min
docker logs supabase-db --since 30m

# Logs Nginx do dia
sudo grep "$(date +%d/%b/%Y)" /var/log/nginx/access.log | tail -100
```

## Estágio 2 — Conter

**O objetivo aqui é parar o sangramento, não arrumar o problema.**

### Padrões de contenção

| Situação | Ação de contenção |
|---|---|
| Deploy ruim acabou de subir | Rollback imediato (ver `deploy-pipeline.md`) |
| Carga absurda em endpoint específico | Comentar/desabilitar a feature via feature flag |
| Webhook Ploomes inundando o servidor | Desativar no painel Ploomes temporariamente |
| Cron rodando em loop | `pm2 stop` no processo de cron |
| Banco com query lenta travando tudo | Identificar query (`pg_stat_activity`) e `pg_cancel_backend` |

### NÃO faça em pânico

- ❌ `git push --force` para "consertar rápido". Histórico bagunçado.
- ❌ Deletar dados sem backup. Pior cenário inverso.
- ❌ Editar arquivos direto na VPS. Working tree gate vai morder no próximo deploy. (Lição v1.5.2.)
- ❌ Mudar 5 coisas ao mesmo tempo. Não vai saber qual resolveu.

## Estágio 3 — Corrigir

Aqui sim — debugar a causa real e fazer a correção.

### Padrão: 1 hipótese por vez

1. Ler logs com calma.
2. Formular **uma** hipótese.
3. Testá-la (`pg_stat_activity`, `pm2 describe`, `docker exec`, etc.).
4. Confirmou? Corrige. Não confirmou? Volta ao 2.

### Caso clássico — incidente v1.5.2

**Sintoma:** HTTP 500 em todas as rotas após deploy automático.

**Causa raiz:** alguém (manual ou processo) tinha tocado arquivos diretamente na VPS, fora do git. O `git reset --hard origin/main` do deploy apagou esses arquivos. Aplicação tentou importar módulo deletado → 500.

**Correção imediata:** SSH na VPS, `git checkout` dos arquivos perdidos a partir de uma cópia local, reload PM2.

**Correção estrutural (v1.5.3):**
1. Adicionado **working tree gate** no `deploy.yml` (aborta se VPS divergiu).
2. Tornado `pm2 reload --update-env` obrigatório.
3. Documentado o incidente neste playbook.

**Lição:** **nunca tocar arquivos direto na VPS fora do git.** Tudo via commit + push + deploy.

## Estágio 4 — Aprender

Toda incidente em produção que durou > 15 minutos merece **postmortem**:

### Template de postmortem

```markdown
# Postmortem — [data] — [título curto]

## Resumo (1 parágrafo)
O que aconteceu, por quanto tempo, qual o impacto.

## Timeline
- HH:MM — primeira detecção (alerta? usuário? você?)
- HH:MM — primeira ação tomada
- HH:MM — causa identificada
- HH:MM — correção aplicada
- HH:MM — confirmação de resolução

## Causa raiz
O 5 Whys até chegar na causa real, não no sintoma.

## O que funcionou
Ferramentas, ações, processos que ajudaram.

## O que não funcionou
Onde se perdeu tempo, o que confundiu, o que faltou.

## Ações de prevenção
- [ ] Acionável 1
- [ ] Acionável 2
```

Salvar em `docs/postmortems/YYYY-MM-DD-titulo.md` no repo. Vira parte da memória institucional.

## Checklist de incidente

Em ordem:

```
□ Algo está quebrado de fato? (não é só lentidão de rede do usuário?)
□ Qual o impacto? (1 user / vários / todos?)
□ Qual sintoma EXATO? (mensagem de erro literal, screenshot)
□ O que mudou recentemente? (último deploy, env var, migration)
□ Logs lidos? (PM2, Docker, Nginx)
□ Hipótese formulada e testada?
□ Contenção aplicada (parou de piorar)?
□ Correção aplicada?
□ Confirmado que voltou? (curl, login real, ação afetada)
□ Postmortem agendado/escrito?
□ Ação de prevenção criada como issue/migration?
```

## Comunicação durante incidente

- **Antes de mexer em qualquer coisa**, anotar timestamp e o que vai fazer. Em duas horas você não vai lembrar a sequência exata.
- **Se mais de 1 pessoa envolvida**, alguém é "incident commander" — toma decisões. Outros executam. Sem isso, vira gritaria.
- **Avisar usuários afetados** se for grave (login fora, dados sumiram). Transparência > silêncio constrangido.

## Caixa de ferramentas — recortes prontos

### Ver query lenta no Postgres
```sql
SELECT pid, usename, query, state, query_start, now() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### Cancelar query travada
```sql
SELECT pg_cancel_backend(<pid>);   -- gentil
SELECT pg_terminate_backend(<pid>); -- forçado, em emergência
```

### Conexões abertas no Postgres
```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

### Reiniciar tudo do Supabase (último recurso)
```bash
cd /opt/supabase
docker compose down
docker compose up -d
# Aguardar ~30s para tudo voltar
```

### Reiniciar Next.js (PM2)
```bash
pm2 reload --update-env ecosystem.config.js  # zero-downtime
pm2 restart cacholaos --update-env           # com downtime breve
```

### Recriar serviço Docker com env nova
```bash
cd /opt/supabase
docker compose up -d --force-recreate <serviço>   # ex: supabase-auth
```

## Quando chamar reforço

Ações onde você **deve hesitar** antes de fazer sozinho:

- DROP TABLE em prod.
- DELETE em massa sem WHERE rigoroso.
- Editar Nginx (config errada derruba TODO o site).
- Mudar `docker-compose.yml` de variável crítica (`POSTGRES_PASSWORD`).
- Restore de backup (sobrescreve dados atuais).

Em todos: **fazer backup antes** + **dois pares de olhos** + **escrever o que vai fazer ANTES de fazer**.