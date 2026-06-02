#!/bin/bash
# ============================================================
# Cachola OS — Backup Verification Script
# ============================================================

set -euo pipefail

BACKUP_ROOT=/backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_ROOT}/logs/verify_${TIMESTAMP}.log"
MIN_DB_SIZE=1048576   # 1 MB em bytes

# Conexão com o banco (mesmo container/credenciais do backup-full.sh)
DB_CONTAINER=supabase-db
DB_NAME=postgres
DB_USER=postgres

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }
ok()   { log "  ✔  $*"; }
warn() { log "  ⚠  $*"; }
fail() { log "  ✘  $*"; ERRORS=$((ERRORS + 1)); FAIL_MSGS="${FAIL_MSGS:+${FAIL_MSGS}; }$*"; }

# Registra UMA linha status='failed' em public.backup_log quando a verificação
# encontra falha REAL (gzip/tamanho/checksum) — nunca para warns (ex.: backup
# "velho" aos domingos/dia 1º não conta como erro). Reaproveita o alerta já
# existente (cron backup-check, condição status='failed', agnóstica de
# kind/source), sem precisar de caminho de e-mail próprio no shell.
#   - source='verify' (migration 141) evita colidir com a linha de sucesso do
#     backup-full pelo índice único (kind, source, filename) + ON CONFLICT.
#   - filename embute o TIMESTAMP único desta execução => nunca colide E faz o
#     alerta reincidir a cada dia enquanto a corrupção persistir.
log_verify_failure_row() {
  local kind="daily"
  case "${LATEST_DB:-}" in
    *_weekly_*)  kind="weekly" ;;
    *_monthly_*) kind="monthly" ;;
  esac
  local fname="verify-failure_${TIMESTAMP}"
  local msg="${FAIL_MSGS:-Falha na verificação de backup}"
  msg="${msg//\'/\'\'}"   # dobra aspas simples para segurança no SQL
  # O gravador NÃO pode falhar em silêncio (é justamente o que combatemos): se o
  # INSERT não der certo, o erro do psql vai para o log e emitimos um warn — sem
  # abortar, para o exit 1 da verificação continuar acontecendo.
  if ! docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -q -c "
    INSERT INTO public.backup_log
      (kind, source, filename, status, started_at, completed_at, error_message)
    VALUES
      ('${kind}', 'verify', '${fname}', 'failed', now(), now(), '${msg}')
    ON CONFLICT (kind, source, filename) DO NOTHING;
  " 2>>"${LOG_FILE}"; then
    warn "Falha ao registrar linha de alerta em backup_log (a verificação ainda será reportada como falha)"
  fi
}

ERRORS=0
FAIL_MSGS=""

log "=== VERIFICAÇÃO DE BACKUP - ${TIMESTAMP} ==="

# ── 1. Verifica último backup diário ─────────────────────────
log "[1/4] Verificando último backup diário..."
LATEST_DB=$(ls -t "${BACKUP_ROOT}/daily"/cachola_daily_*_db.sql.gz 2>/dev/null | head -1 || true)
if [ -z "${LATEST_DB}" ]; then
  fail "Nenhum backup diário encontrado"
else
  AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "${LATEST_DB}")) / 3600 ))
  if [ "${AGE_HOURS}" -gt 26 ]; then
    warn "Último backup tem ${AGE_HOURS}h (esperado < 26h)"
  else
    ok "Backup recente: $(basename ${LATEST_DB}) (${AGE_HOURS}h atrás)"
  fi
fi

# ── 2. Verifica tamanho do dump ───────────────────────────────
log "[2/4] Verificando tamanho do dump..."
if [ -n "${LATEST_DB}" ]; then
  DB_SIZE=$(stat -c %s "${LATEST_DB}")
  DB_SIZE_MB=$(echo "scale=1; ${DB_SIZE}/1048576" | bc)
  if [ "${DB_SIZE}" -lt "${MIN_DB_SIZE}" ]; then
    fail "Dump muito pequeno: ${DB_SIZE_MB} MB (mínimo 1 MB)"
  else
    ok "Tamanho do dump: ${DB_SIZE_MB} MB"
  fi
fi

# ── 3. Testa integridade do gzip ─────────────────────────────
log "[3/4] Testando integridade do gzip..."
if [ -n "${LATEST_DB}" ]; then
  if gzip -t "${LATEST_DB}" 2>/dev/null; then
    ok "Integridade do gzip OK"
  else
    fail "Arquivo corrompido: ${LATEST_DB}"
  fi
fi

# Verifica storage backup
LATEST_STORAGE=$(ls -t "${BACKUP_ROOT}/daily"/cachola_daily_*_storage.tar.gz 2>/dev/null | head -1 || true)
if [ -n "${LATEST_STORAGE}" ]; then
  if gzip -t "${LATEST_STORAGE}" 2>/dev/null; then
    ok "Storage backup íntegro"
  else
    warn "Storage backup possivelmente corrompido"
  fi
fi

# ── 4. Verifica checksums ─────────────────────────────────────
log "[4/4] Verificando checksums..."
if [ -n "${LATEST_DB}" ]; then
  BASE=$(basename "${LATEST_DB}" _db.sql.gz)
  CHECKSUM_FILE="${BACKUP_ROOT}/daily/${BASE}_checksums.sha256"
  if [ -f "${CHECKSUM_FILE}" ]; then
    if sha256sum --check "${CHECKSUM_FILE}" --quiet 2>/dev/null; then
      ok "Checksums validados"
    else
      fail "Checksums divergentes — backup pode estar corrompido"
    fi
  else
    warn "Arquivo de checksum não encontrado"
  fi
fi

# ── Resumo ────────────────────────────────────────────────────
log "--- Espaço em disco ---"
df -h /backup | tee -a "${LOG_FILE}"
log "--- Backups existentes ---"
for SLOT in daily weekly monthly; do
  COUNT=$(ls "${BACKUP_ROOT}/${SLOT}"/*_db.sql.gz 2>/dev/null | wc -l || echo 0)
  log "  ${SLOT}: ${COUNT} backups"
done

if [ "${ERRORS}" -eq 0 ]; then
  log "=== VERIFICAÇÃO PASSOU (0 erros) ==="
  exit 0
else
  log "=== VERIFICAÇÃO FALHOU (${ERRORS} erro(s)) ==="
  log_verify_failure_row
  exit 1
fi
