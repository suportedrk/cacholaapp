#!/bin/bash
# ============================================================
# Cachola OS — Backup Verification Script
# ============================================================

set -euo pipefail

BACKUP_ROOT=/backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_ROOT}/logs/verify_${TIMESTAMP}.log"
MIN_DB_SIZE=1048576   # 1 MB em bytes

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }
ok()   { log "  ✔  $*"; }
warn() { log "  ⚠  $*"; }
fail() { log "  ✘  $*"; ERRORS=$((ERRORS + 1)); }

ERRORS=0

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
  exit 1
fi
