#!/usr/bin/env bash
# sync-db-local.sh — Sync VPS → banco local com anonimização LGPD
# Uso: npm run db:sync-local  (ou: bash scripts/sync-db-local.sh)
# Executar a partir da raiz do projeto com docker compose em execução.
set -euo pipefail

VPS="cacholaos-vps"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP="./tmp/cachola-dump-${TIMESTAMP}.dump"

mkdir -p ./tmp

echo "=== Sync VPS → Local ($TIMESTAMP) ==="

# ─── 1. Dump (formato customizado — mais eficiente e suporta --disable-triggers) ──
echo "[1/3] Dump VPS (excluindo tabelas de log grandes)..."
ssh "$VPS" "docker exec supabase-db pg_dump \
  -U postgres -d postgres \
  -Fc \
  --schema=public \
  --no-owner --no-acl \
  --exclude-table-data=public.audit_logs \
  --exclude-table-data=public.ploomes_webhook_log \
  --exclude-table-data=public.ploomes_sync_log \
  --exclude-table=public.ploomes_order_products_backup_20260417" > "$DUMP"

SIZE=$(du -sh "$DUMP" | cut -f1)
echo "  → $DUMP ($SIZE)"

# ─── 2. Restore ──────────────────────────────────────────────────────────────
echo "[2/3] Restaurando banco local..."
# --disable-triggers: desabilita FK triggers por tabela (contorna refs a auth.users)
# --clean --if-exists: dropa objetos existentes antes de recriar
# || true: pg_restore retorna 1 em warnings não-fatais de DROP em schema vazio
docker compose exec -T supabase-db \
  pg_restore \
  -U postgres \
  -d postgres \
  --no-owner --no-acl \
  --clean --if-exists \
  --disable-triggers \
  --schema=public \
  < "$DUMP" || true

echo "  → Restore concluído"

# ─── 3. Anonimizar ───────────────────────────────────────────────────────────
echo "[3/3] Anonimizando dados (LGPD)..."
docker compose exec -T supabase-db \
  psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 \
  -v LOCAL_TOKEN=1 \
  < scripts/anonymize-local.sql

rm -f "$DUMP"
echo ""
echo "✓ Banco local atualizado e anonimizado."
echo "  Valores financeiros são reais — trate como backup de produção."
