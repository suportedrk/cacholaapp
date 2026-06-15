#!/bin/bash
# ============================================================
# Cachola OS — Full Backup Script
# Banco PostgreSQL + Storage + Configurações
# ============================================================

set -euo pipefail

# ── Configuração ─────────────────────────────────────────────
BACKUP_ROOT=/backup
APP_DIR=/opt/cacholaapp
SUPABASE_DIR=/opt/supabase/supabase/docker
STORAGE_DIR="${SUPABASE_DIR}/volumes/storage"
DB_CONTAINER=supabase-db
DB_NAME=postgres
DB_USER=postgres
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
STARTED_AT=$(date -Iseconds)
DOW=$(date +%u)          # 1=Mon ... 7=Sun
DOM=$(date +%d)          # dia do mês
LOG_FILE="${BACKUP_ROOT}/logs/backup_${TIMESTAMP}.log"

# Retenção
KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=3

# ── Funções ───────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }
die() { log "ERRO: $*"; exit 1; }

log_backup_row() {
  local status="$1"
  local errmsg="${2:-}"
  [[ -z "${DUMP_FILE:-}" ]] && return 0
  local fname
  fname=$(basename "${DUMP_FILE}")
  local fsize=0
  [[ -f "${DUMP_FILE}" ]] && fsize=$(stat -c%s "${DUMP_FILE}" 2>/dev/null || echo 0)
  docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -q -c "
    INSERT INTO public.backup_log
      (kind, source, filename, size_bytes, status, started_at, completed_at, error_message)
    VALUES
      ('${SLOT:-daily}', 'local', '${fname}', ${fsize}, '${status}',
       '${STARTED_AT}'::timestamptz,
       CASE WHEN '${status}' != 'in_progress' THEN now() ELSE NULL END,
       NULLIF('${errmsg}', ''))
    ON CONFLICT (kind, source, filename) DO NOTHING;
  " 2>/dev/null || true
}

# ── Início ───────────────────────────────────────────────────
mkdir -p "${BACKUP_ROOT}/daily" "${BACKUP_ROOT}/weekly" "${BACKUP_ROOT}/monthly" "${BACKUP_ROOT}/logs"
log "=== INÍCIO DO BACKUP - ${TIMESTAMP} ==="

# Determina qual slot usar
SLOT=daily
[ "${DOW}" = 7  ] && SLOT=weekly   # domingo = semanal
[ "${DOM}" = 01 ] && SLOT=monthly  # dia 1 = mensal

PREFIX="cachola_${SLOT}_${TIMESTAMP}"
DEST="${BACKUP_ROOT}/${SLOT}"
DUMP_FILE="${DEST}/${PREFIX}_db.sql.gz"

log "Slot: ${SLOT} | Destino: ${DEST}/${PREFIX}"

# Registra falhas no banco (|| true: não deixa o guard falhar a inserção)
trap 'log_backup_row failed "Erro na execução do script de backup" || true' ERR

# ── 1. Dump do banco de dados ─────────────────────────────────
log "[1/4] Executando pg_dump..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}"   --no-password --clean --if-exists --create | gzip > "${DUMP_FILE}"
DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
log "   Dump concluído: ${DUMP_FILE} (${DUMP_SIZE})"

# ── 2. Backup do storage (arquivos de usuário) ────────────────
log "[2/4] Backup do storage..."
STORAGE_FILE="${DEST}/${PREFIX}_storage.tar.gz"
tar -czf "${STORAGE_FILE}" -C "${STORAGE_DIR}" . 2>/dev/null || true
STORAGE_SIZE=$(du -sh "${STORAGE_FILE}" | cut -f1)
log "   Storage: ${STORAGE_FILE} (${STORAGE_SIZE})"

# ── 3. Backup de configurações (críticas + sistema) ───────────
log "[3/4] Backup de configurações..."
CONFIG_FILE="${DEST}/${PREFIX}_config.tar.gz"
tar -czf "${CONFIG_FILE}"   "${APP_DIR}/.env"   "${APP_DIR}/.env.local"   "${APP_DIR}/docker-compose.yml"   "${SUPABASE_DIR}/.env"   "${SUPABASE_DIR}/volumes/api/kong.yml"   /etc/cachola/cron.env   /etc/nginx/sites-available/cacholaos   /etc/nginx/sites-available/supabase-api   /opt/cron-call.sh   /opt/cron-runner.sh   /etc/letsencrypt/   /root/.config/rclone/rclone.conf   2>/dev/null || true
CONFIG_SIZE=$(du -sh "${CONFIG_FILE}" | cut -f1)
log "   Config: ${CONFIG_FILE} (${CONFIG_SIZE})"

# ── 4. Checksum SHA256 ────────────────────────────────────────
log "[4/4] Gerando checksums..."
CHECKSUM_FILE="${DEST}/${PREFIX}_checksums.sha256"
sha256sum "${DEST}/${PREFIX}"_*.{sql.gz,tar.gz} > "${CHECKSUM_FILE}" 2>/dev/null || true
log "   Checksums: ${CHECKSUM_FILE}"

# ── Rotação de backups antigos ────────────────────────────────
log "Rotacionando backups antigos..."
ls -t "${BACKUP_ROOT}/daily"/cachola_daily_*_db.sql.gz 2>/dev/null   | tail -n +$((KEEP_DAILY + 1)) | xargs -r -I{} bash -c '
    BASE=$(basename {} _db.sql.gz)
    rm -f "$(dirname {})/${BASE}"_*.{sql.gz,tar.gz,sha256}
    echo "  Removido: ${BASE}"
  ' >> "${LOG_FILE}" 2>&1 || true

ls -t "${BACKUP_ROOT}/weekly"/cachola_weekly_*_db.sql.gz 2>/dev/null   | tail -n +$((KEEP_WEEKLY + 1)) | xargs -r -I{} bash -c '
    BASE=$(basename {} _db.sql.gz)
    rm -f "$(dirname {})/${BASE}"_*.{sql.gz,tar.gz,sha256}
  ' >> "${LOG_FILE}" 2>&1 || true

ls -t "${BACKUP_ROOT}/monthly"/cachola_monthly_*_db.sql.gz 2>/dev/null   | tail -n +$((KEEP_MONTHLY + 1)) | xargs -r -I{} bash -c '
    BASE=$(basename {} _db.sql.gz)
    rm -f "$(dirname {})/${BASE}"_*.{sql.gz,tar.gz,sha256}
  ' >> "${LOG_FILE}" 2>&1 || true

# ── Resumo ────────────────────────────────────────────────────
TOTAL=$(du -sh "${BACKUP_ROOT}" | cut -f1)
log "=== BACKUP CONCLUÍDO ==="
log "   DB:      ${DUMP_SIZE}"
log "   Storage: ${STORAGE_SIZE}"
log "   Config:  ${CONFIG_SIZE}"
log "   Total em disco: ${TOTAL}"

# Registra sucesso no banco
trap - ERR
log_backup_row success || true
