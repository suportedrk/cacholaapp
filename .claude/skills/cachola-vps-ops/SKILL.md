---
name: cachola-vps-ops
description: Operações de infraestrutura da VPS de produção do Cachola OS — upgrade de Node.js (método NodeSource APT, procedimento validado), ajuste de ulimit, diagnóstico de saúde do servidor (PM2, disco, memória, latência), acesso SSH, regras de ouro para não quebrar produção, e registro de incidentes históricos. Use SEMPRE que o trabalho envolver atualizar Node.js na VPS, investigar lentidão ou erro em produção, ajustar configurações de sistema (ulimit, systemd, limits.conf), operar o PM2 via SSH, ou quando precisar de referência rápida de IPs, paths e aliases da VPS. Dispare também ao planejar qualquer janela de manutenção que afete o servidor de produção.
---

# Cachola OS — Operações de VPS

Esta skill cobre a camada de **infraestrutura do servidor de produção**: como acessar, como manter, como atualizar, e o que fazer quando algo dá errado. Complementa a `cachola-supabase-ops` (que cobre banco e deploy) — esta foca no servidor em si.

> **Duas VPSs (jun/2026):** esta skill é da **VPS de PRODUÇÃO** (187.77.255.31). Existe também uma **VPS de DEV** separada, onde rodam o Docker/Supabase e o dev server (PM2 `cachola-dev`) — é onde se desenvolve. As regras abaixo (ex.: "nunca editar código na VPS") valem para **produção**; na VPS de dev o fluxo é editar → commitar no `develop`, sem deixar o disco divergir do git. Operações da VPS de dev não são cobertas aqui.

## Regras de Ouro

Oito regras que valem mais do que qualquer documentação. Violar qualquer uma tem custo alto:

1. **Snapshot Hostinger ANTES de qualquer upgrade não-trivial.** Painel [hpanel.hostinger.com](https://hpanel.hostinger.com) → VPS → Snapshots. É o seguro contra catástrofe — sem ele, rollback de infra é manual e lento.

2. **NUNCA editar código-fonte diretamente na VPS.** Arquivos `.ts`, `.tsx`, `.js`, `.json`, `.yml`, `.md` só mudam via `git commit → push → deploy.yml`. Edição direta cria divergência silenciosa (lição da v1.5.2 — veja `incidents-and-lessons.md`).

3. **Identificar o método de instalação do Node ANTES de qualquer operação.** `cat /etc/apt/sources.list.d/nodesource.sources` revela se é NodeSource APT. A ausência desse arquivo pode indicar nvm ou n. O método muda o comando de upgrade inteiro.

4. **`apt-get install nodejs` reinicia `pm2-root.service` automaticamente.** Na próxima troca de Node, parar via `systemctl stop pm2-root.service` ANTES do `apt-get install`, não apenas `pm2 stop`. Detalhes em `references/nodejs-upgrade.md`.

5. **`rm -rf node_modules .next && npm ci` é obrigatório após trocar a versão do Node.** Bindings nativos (sharp, lightningcss, swc, tailwindcss-oxide) são compilados para o ABI específico do Node. Pular esse passo causa erros silenciosos em runtime.

6. **`pm2 restart` SEMPRE com `--update-env`** após trocar env vars ou versão do Node. Sem a flag, PM2 usa o ambiente congelado da última inicialização a frio.

7. **Ulimit `nofile` do processo PM2 vem do `pm2-root.service`, não do `limits.conf`.** O serviço já tem `LimitNOFILE=infinity` (~1.048.576). Para confirmar o valor real no processo em execução: `cat /proc/<PID>/limits | grep "open files"`. Não confiar no output do shell (`ulimit -n`).

8. **Rollback de emergência: restaurar snapshot da Hostinger** (último recurso, restaura tudo ao estado pré-janela). Para rollback apenas do Node: `curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs=20.20.2-1nodesource1`.

## Referência Rápida — VPS de PRODUÇÃO

| Item | Valor |
|---|---|
| IP público | `187.77.255.31` |
| Sistema operacional | Ubuntu 24.04 LTS |
| Usuário SSH | `root` |
| Alias SSH | `cacholaos-vps` (chave ED25519 em `~/.ssh/cacholaos_deploy_v2`) |
| Diretório do app | `/opt/cacholaapp` |
| Porta do app (PM2) | `3001` |
| Configuração PM2 | `/opt/cacholaapp/ecosystem.config.js` |
| Serviço systemd PM2 | `/etc/systemd/system/pm2-root.service` |
| Repositório NodeSource | `/etc/apt/sources.list.d/nodesource.sources` |
| Log de erros (PM2) | `/var/log/cacholaos-error.log` |
| Log de saída (PM2) | `/var/log/cacholaos-out.log` |
| Node atual (mai/2026) | `v22.22.2` via NodeSource APT |
| Versão .nvmrc do projeto | `22` |
| Domínio público | `cachola.cloud` |

## Quando consultar cada referência

| Tarefa | Leia |
|---|---|
| Upgrade de Node.js, ajuste de ulimit | `references/nodejs-upgrade.md` |
| Algo quebrou em produção (VPS) | `references/incidents-and-lessons.md` (LEIA PRIMEIRO) |
| Migrations, RLS, funções de banco | skill `cachola-supabase-ops` |
| Deploy / `deploy.yml` / fluxo `develop → main` | sem skill dedicada hoje — ver `memory_user_edits` ou histórico de commits |

## Anti-padrões (NUNCA fazer)

- ❌ Editar arquivo de código-fonte (`.ts`, `.tsx`, `.js`, `.json`) via SSH na VPS.
- ❌ Rodar `apt-get install nodejs` com PM2 ativo (`pm2-root.service` rodando) — o apt vai religar o PM2 com `node_modules` do Node antigo.
- ❌ Pular `npm ci` após trocar a versão do Node — bindings nativos quebram silenciosamente.
- ❌ Pular `npm ci` e ir direto para `npm run build` — mesmo risco de ABI incompatível.
- ❌ Rodar `pm2 restart cacholaos` sem `--update-env` após trocar env vars ou Node.
- ❌ Confiar em `ulimit -n` no shell SSH como reflexo do limite real do processo PM2.
- ❌ Fazer upgrade de Node sem snapshot Hostinger criado e confirmado antes.
- ❌ Aplicar migration na VPS antes de o código estar deployado (schema novo sem runtime novo = crash).

## Escopo desta skill

✅ **Cobre:** upgrade de Node.js na VPS, diagnóstico de saúde (CPU, memória, disco, PM2), ajuste de ulimit, identificação do método de instalação do Node, incidentes históricos de produção relacionados à VPS.

❌ **NÃO cobre:** migrations e RLS (skill `cachola-supabase-ops`), `deploy.yml` e pipeline de CI/CD (sem skill dedicada — ver histórico de commits), configuração do app Next.js e sessão (skill `cachola-stack`), integração Ploomes (skill `ploomes-cachola-api`).
