#!/usr/bin/env bash
# upload-to-r2.sh — envia backups Postgres para Cloudflare R2
set -euo pipefail
REMOTE="r2:cacholaos-backups"
LOG_FILE="/var/log/cachola-r2-upload.log"
LOCAL_BASE="/backup"
DB_CONTAINER=supabase-db
DB_NAME=postgres
DB_USER=postgres

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }

upload_folder() {
  local folder="$1"
  local local_path="${LOCAL_BASE}/${folder}"
  local remote_path="${REMOTE}/${folder}"
  if [[ ! -d "${local_path}" ]]; then log "WARN: ${local_path} não existe, pulando"; return 0; fi
  log "Sincronizando ${folder}..."
  rclone copy "${local_path}" "${remote_path}" \
    --transfers 2 --checkers 4 --contimeout 60s --timeout 5m \
    --log-file="${LOG_FILE}" --log-level INFO
}

log_r2_rows() {
  local folder="$1"
  local local_path="${LOCAL_BASE}/${folder}"
  for f in "${local_path}"/cachola_*_db.sql.gz; do
    [[ -f "$f" ]] || continue
    local fname
    fname=$(basename "$f")
    local fsize
    fsize=$(stat -c%s "$f" 2>/dev/null || echo 0)
    local kind="daily"
    [[ "$fname" == *_weekly_* ]] && kind="weekly"
    [[ "$fname" == *_monthly_* ]] && kind="monthly"
    local r2key="${folder}/${fname}"
    docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -q -c "
      INSERT INTO public.backup_log
        (kind, source, filename, r2_key, size_bytes, status, completed_at)
      VALUES
        ('${kind}', 'r2_upload', '${fname}', '${r2key}', ${fsize}, 'success', now())
      ON CONFLICT (kind, source, filename) DO NOTHING;
    " 2>/dev/null || true
  done
}

log "=== Iniciando upload para R2 ==="
upload_folder "daily"
log_r2_rows "daily" || true
upload_folder "weekly"
log_r2_rows "weekly" || true
upload_folder "monthly"
log_r2_rows "monthly" || true
log "=== Upload concluído ==="
log "Uso no R2:"
rclone size "${REMOTE}" --json 2>&1 | tee -a "${LOG_FILE}"
