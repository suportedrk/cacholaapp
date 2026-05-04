# Upgrade de Node.js na VPS

Runbook completo para trocar a versão do Node.js no servidor de produção do Cachola OS. Procedimento validado em 04/05/2026 (Node 20.20.2 → 22.22.2, 11 minutos de janela, zero incidentes pós-upgrade).

---

## Identificar o método de instalação atual

Antes de qualquer coisa, confirme como o Node está instalado. O método muda o comando de upgrade.

```bash
# NodeSource APT (caso atual — formato DEB822)
cat /etc/apt/sources.list.d/nodesource.sources

# NodeSource APT (formato legacy .list)
cat /etc/apt/sources.list.d/nodesource.list 2>/dev/null

# nvm
ls ~/.nvm 2>/dev/null && cat ~/.nvm/alias/default 2>/dev/null

# n (TJ Holowaychuk)
which n 2>/dev/null

# apt padrão Ubuntu
apt-cache policy nodejs | head -5
```

| Método detectado | Evidência | Comando de upgrade |
|---|---|---|
| **NodeSource APT** (caso atual) | `nodesource.sources` ou `nodesource.list` existe; versão contém `1nodesource1` | `curl setup_22.x \| bash - && apt-get install -y nodejs` |
| nvm | `~/.nvm` existe | `nvm install 22 && nvm alias default 22` |
| n | `which n` retorna caminho | `n 22` |
| apt padrão Ubuntu | versão sem sufixo `nodesource` | `apt-get install -y nodejs` (versão Ubuntu, geralmente desatualizada) |

---

## Pré-requisitos obrigatórios

Confirmar **todos** antes de iniciar. Não pular nenhum.

- [ ] **Snapshot Hostinger criado e confirmado** — painel [hpanel.hostinger.com](https://hpanel.hostinger.com) → VPS → Snapshots. Aguardar status "concluído" antes de prosseguir.
- [ ] **CI verde na branch a ser deployada** — confirmar no GitHub Actions que o último run em `develop` (ou `main`) passou.
- [ ] **Janela comunicada** — mesmo que o tráfego seja baixo, comunicar aos usuários que o site ficará indisponível por ~15 minutos.
- [ ] **Backup do `limits.conf`** se for ajustar ulimit junto: `cp /etc/security/limits.conf /etc/security/limits.conf.bak-$(date +%Y%m%d)`.

---

## Procedimento completo (P1–P9)

### P1 — Capturar estado inicial (site ainda online)

```bash
ssh cacholaos-vps "node --version && npm --version"
ssh cacholaos-vps "pm2 list"
ssh cacholaos-vps "curl -I -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s' http://localhost:3001"
ssh cacholaos-vps "curl -I -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s' https://cachola.cloud"
```

Anotar a versão exata do Node (ex: `v20.20.2`) como referência de rollback.

---

### P2 — Parar o serviço PM2 via systemctl *(site fica OFFLINE)*

```bash
# Parar o serviço systemd (evita que o apt o religue automaticamente)
ssh cacholaos-vps "systemctl stop pm2-root.service"

# Confirmar que as instâncias pararam
ssh cacholaos-vps "pm2 list"
```

> ⚠️ **CRÍTICO:** use `systemctl stop pm2-root.service`, não apenas `pm2 stop cacholaos`. Se parar só com `pm2 stop`, o `apt-get install nodejs` vai reativar o `pm2-root.service` automaticamente e o app volta online com `node_modules` do Node antigo — janela de risco de ~5–30s com bindings incompatíveis. Veja `incidents-and-lessons.md` INC-002.

---

### P3 — (Opcional) Ajustar ulimit

Executar se o `ulimit -n` atual for inferior a 65535. Pular se já estiver adequado.

```bash
# Verificar limite atual no processo PM2 (antes de parar)
PID=$(ssh cacholaos-vps "pm2 jlist | python3 -c 'import sys,json; print(json.load(sys.stdin)[0][\"pid\"])'")
ssh cacholaos-vps "cat /proc/$PID/limits | grep 'open files'"

# Backup
ssh cacholaos-vps "cp /etc/security/limits.conf /etc/security/limits.conf.bak-$(date +%Y%m%d)"

# Adicionar regras (verificar antes com grep para não duplicar)
ssh cacholaos-vps "grep -q 'nofile' /etc/security/limits.conf || cat >> /etc/security/limits.conf << 'EOF'

* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF"

# Descomentar DefaultLimitNOFILE em system.conf
ssh cacholaos-vps "grep 'DefaultLimitNOFILE' /etc/systemd/system.conf"
# Se estiver comentado: sed -i 's/^#DefaultLimitNOFILE=.*/DefaultLimitNOFILE=65535/' /etc/systemd/system.conf

# Recarregar systemd
ssh cacholaos-vps "systemctl daemon-reload"
```

> O `pm2-root.service` já tem `LimitNOFILE=infinity` (≈ 1.048.576) — nenhuma alteração necessária nele.

---

### P4 — Upgrade do Node via NodeSource

```bash
# Baixar e executar script de setup para a nova versão (substitui nodesource.sources)
ssh cacholaos-vps "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>&1 | tail -5"

# Instalar o novo nodejs
ssh cacholaos-vps "apt-get install -y nodejs 2>&1 | tail -10"

# Validar — PARAR SE não retornar v22.x.x
ssh cacholaos-vps "node --version && npm --version"
```

Output esperado: `v22.x.x` e npm atualizado. Se retornar versão diferente, parar e investigar.

---

### P5 — Reinstalar dependências para o novo ABI

```bash
ssh cacholaos-vps "cd /opt/cacholaapp && rm -rf node_modules .next && npm ci 2>&1 | tail -20"
```

Output esperado: `added XXXX packages in XXs`, sem erros de native binding, EACCES ou peer-deps.

> Este passo é obrigatório — bindings nativos (sharp, lightningcss, @next/swc, tailwindcss-oxide) são compilados para o ABI específico de cada versão de Node. Pular causa falhas silenciosas em runtime.

---

### P6 — Rebuild do Next.js

```bash
ssh cacholaos-vps "cd /opt/cacholaapp && NODE_OPTIONS=--max-old-space-size=4096 npm run build 2>&1 | tail -30"
```

Output esperado: `✓ Compiled successfully`. PARAR SE houver erro de TypeScript, Module not found, ou OOM.

---

### P7 — Religar PM2 *(site volta ONLINE)*

```bash
ssh cacholaos-vps "cd /opt/cacholaapp && pm2 start ecosystem.config.js --update-env"
ssh cacholaos-vps "pm2 list"
```

Aguardar ~15 segundos para o app estabilizar, depois checar logs:

```bash
ssh cacholaos-vps "pm2 logs cacholaos --lines 50 --nostream"
```

Verificar: presença de `✓ Ready in XXXms`. PARAR SE houver `Error`, `FATAL`, ou `uncaughtException` nos logs recentes.

---

### P8 — Validações finais

```bash
# Site respondendo
ssh cacholaos-vps "curl -I -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s' http://localhost:3001"
ssh cacholaos-vps "curl -I -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s' https://cachola.cloud"

# PM2 mostrando a versão correta do Node e sem restarts
ssh cacholaos-vps "pm2 info cacholaos | head -30"
```

Esperado: HTTP 307 ou 200 nos dois endpoints. Campo `node.js version` no `pm2 info` deve mostrar `22.x.x`.

---

### P9 — Verificar ulimit no processo PM2

```bash
ssh cacholaos-vps "PID=\$(pm2 jlist | python3 -c 'import sys,json; print(json.load(sys.stdin)[0][\"pid\"])') && cat /proc/\$PID/limits | grep 'open files'"
```

Esperado: `Max open files  1048576  1048576  files` (devido ao `LimitNOFILE=infinity` no `pm2-root.service`).

Se retornar `1024`, o serviço PM2 foi iniciado fora do systemd. Corrigir com:
```bash
ssh cacholaos-vps "systemctl restart pm2-root.service"
```

---

## Rollback (executar APENAS se etapa crítica falhar sem recuperação em 5 min)

```bash
# 1. Reverter NodeSource para a versão anterior
ssh cacholaos-vps "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
ssh cacholaos-vps "apt-get install -y nodejs=20.20.2-1nodesource1"

# 2. Reinstalar dependências no Node antigo
ssh cacholaos-vps "cd /opt/cacholaapp && rm -rf node_modules .next && npm ci"

# 3. Rebuild
ssh cacholaos-vps "cd /opt/cacholaapp && NODE_OPTIONS=--max-old-space-size=4096 npm run build"

# 4. Religar PM2
ssh cacholaos-vps "cd /opt/cacholaapp && pm2 start ecosystem.config.js --update-env"

# 5. Validar
ssh cacholaos-vps "curl -I -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3001"
```

Se o rollback também falhar: **restaurar snapshot da Hostinger** pelo painel (volta tudo ao estado pré-janela).

---

## Tempos observados — Node 20.20.2 → 22.22.2 (04/05/2026)

| Etapa | Tempo observado |
|---|---|
| P1 — Estado inicial | < 1 min |
| P2 — pm2 stop | < 1 min |
| P3 — ulimit (limits.conf + system.conf) | ~2 min |
| P4 — NodeSource setup + apt-get install | ~3 min |
| P5 — npm ci (1.1 GB de deps) | ~26s |
| P6 — npm run build | ~20s (local) / ~20s (VPS) |
| P7 — pm2 start + validação de logs | ~2 min |
| P8+P9 — Validações finais | < 1 min |
| **Total** | **~11 minutos** |
| **Tempo de site offline** | **~10 minutos** |

### Métricas pós-upgrade

| Métrica | Antes (Node 20) | Depois (Node 22) | Variação |
|---|---|---|---|
| HTTP P95 latency | 2764 ms | 247 ms | **−91%** |
| HTTP mean latency | 455 ms | 197 ms | −57% |
| ulimit nofile (processo PM2) | 1.024 | 1.048.576 | +102.300% |
| Restarts PM2 | 0 | 0 | — |
