# Runbook — Janela de Manutenção da VPS de Produção

> Checklist operacional para a janela de manutenção da VPS de prod (Ubuntu 24.04).
> Quem executa: **Bruno** (SSH na `cacholaos-vps`). Claude acompanha e valida cada saída.
> **Estimativa:** ~45–60 min de wall-clock · ~5–10 min de downtime real (restart do Docker + reboot).
> **Janela planejada:** 2026-06-23, 19h BRT.

## Escopo
- [ ] Upgrade de Docker / containerd / snapd
- [ ] Autoremove dos kernels antigos (6.8.0-111, 6.8.0-117) — mantém o 6.8.0-124
- [ ] (opcional, defense-in-depth) drop-in systemd `LimitNOFILE=1048576` no docker.service

> **NÃO** remover `/opt/cacholaapp/docker-compose.yml` — é arquivo **tracked** no repo (compose de dev); `rm` quebraria o gate de working-tree do deploy (INC-001). Inofensivo, deixar como está.

---

## Fase 0 — Pré-janela (SEM downtime)

- [ ] **Snapshot Hostinger** (hpanel → VPS → Snapshots) — aguardar concluir. *Regra de ouro nº1.*
- [ ] Baseline / saúde atual:
  ```
  docker --version; containerd --version; uname -r
  docker ps --format '{{.Names}} {{.Status}}'
  curl -s https://cachola.cloud/api/build-info
  dpkg --list | grep linux-image
  cat /proc/$(pgrep -o dockerd)/limits | grep "open files"
  ```

## Fase 1 — Janela (COM downtime)

- [ ] `apt-get update`
- [ ] Criar o drop-in ANTES (1 restart cobre tudo):
  ```
  mkdir -p /etc/systemd/system/docker.service.d
  printf '[Service]\nLimitNOFILE=1048576\n' > /etc/systemd/system/docker.service.d/nofile.conf
  ```
- [ ] **Upgrade** (reinicia o Docker → Supabase fora ~1–2 min):
  ```
  NEEDRESTART_MODE=a apt-get install --only-upgrade docker-ce docker-ce-cli containerd.io snapd
  ```
- [ ] Consolidar o drop-in: `systemctl daemon-reload && systemctl restart docker`
- [ ] Conferir kernel corrente e remover antigos:
  ```
  uname -r                         # deve ser 6.8.0-124
  apt-get autoremove --purge
  ```
- [ ] **Reboot:** `reboot`  *(downtime principal ~3–5 min)*

## Fase 2 — Pós-reboot (verificação)

- [ ] `uname -r` → `6.8.0-124`
- [ ] `docker ps` → todos os `supabase-*` up & healthy (voltam via `restart: unless-stopped`)
- [ ] `cat /proc/$(pgrep -o dockerd)/limits | grep "open files"` → agora **1048576**
- [ ] `docker exec supabase-pooler cat /proc/1/limits | grep "open files"` → `100000 / 1048576`
- [ ] `pm2 status` → app `cacholaos` online (volta via `pm2-root.service`)
- [ ] `curl -s https://cachola.cloud/api/build-info` → buildId esperado
- [ ] Login de fumaça em https://cachola.cloud

## Rollback
- Surpresa grave → **restaurar o snapshot Hostinger** (último recurso).
- Container que não sobe → `cd /opt/supabase/supabase/docker && docker compose up -d`.

## Notas de risco (lições da skill cachola-vps-ops)
- `needrestart` (Ubuntu 24.04) pode pausar pedindo confirmação → `NEEDRESTART_MODE=a` evita o prompt.
- Containers (`restart: unless-stopped`) e PM2 (`pm2-root.service`) voltam sozinhos no boot — só validar na Fase 2.
- Toda alteração de código continua proibida na prod; aqui são só operações de infra (apt/systemd/reboot), permitidas.
