#!/usr/bin/env bash
# Simula JWT por cargo e tenta SELECT/INSERT/UPDATE/DELETE em backup_log.
# Diferente de equipamentos: backup_log é tabela global (sem unit_id).
set -e

# Insere um row temporário como superuser para servir de target de SELECT/UPDATE/DELETE
SEED_ID=$(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -q -c \
  "INSERT INTO public.backup_log (kind, source, filename, status, started_at)
   VALUES ('daily','local','__rls_test_seed.sql.gz','success', now())
   ON CONFLICT (kind, source, filename) DO UPDATE SET status='success' RETURNING id;" 2>/dev/null | head -n1)

echo "Test setup: seed_row=$SEED_ID"
echo
printf "%-14s | %-6s | %-6s | %-6s | %-6s\n" role SELECT INSERT UPDATE DELETE
printf "%s\n" "$(printf '%.0s-' {1..56})"

run_as_user() {
  local USR="$1"
  local SQL="$2"
  docker exec -i cacholaos-db psql -U postgres -d postgres -tA -X -q 2>&1 <<EOF
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"$USR","role":"authenticated"}';
$SQL
ROLLBACK;
EOF
}

mapfile -t USERS_LINES < <(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -F'|' -c \
  "SELECT u.role, u.id::text FROM public.users u
   WHERE u.email LIKE 'teste.%@cachola.local' OR u.email = 'admin@cachola.local'
   ORDER BY u.role;")

for LINE in "${USERS_LINES[@]}"; do
  ROLE=$(echo "$LINE" | cut -d'|' -f1)
  USR=$(echo "$LINE" | cut -d'|' -f2)

  SEL_OUT=$(run_as_user "$USR" "SELECT 'SEL_OK' FROM public.backup_log WHERE id = '$SEED_ID';" || true)
  if echo "$SEL_OUT" | grep -q "SEL_OK"; then SEL=OK; else SEL=BLK; fi

  INS_OUT=$(run_as_user "$USR" "INSERT INTO public.backup_log (kind, source, filename, status, started_at) VALUES ('daily','local','__rls_t_$ROLE.sql.gz','success', now()) RETURNING 'INS_OK';" || true)
  if echo "$INS_OUT" | grep -q "INS_OK"; then INS=OK; else INS=BLK; fi

  UPD_OUT=$(run_as_user "$USR" "UPDATE public.backup_log SET status='success' WHERE id = '$SEED_ID' RETURNING 'UPD_OK';" || true)
  if echo "$UPD_OUT" | grep -q "UPD_OK"; then UPD=OK; else UPD=BLK; fi

  DEL_OUT=$(run_as_user "$USR" "DELETE FROM public.backup_log WHERE id = '$SEED_ID' RETURNING 'DEL_OK';" || true)
  if echo "$DEL_OUT" | grep -q "DEL_OK"; then DEL=OK; else DEL=BLK; fi

  printf "%-14s | %-6s | %-6s | %-6s | %-6s\n" "$ROLE" "$SEL" "$INS" "$UPD" "$DEL"
done

# cleanup do seed
docker exec -i cacholaos-db psql -U postgres -d postgres -q -c \
  "DELETE FROM public.backup_log WHERE id = '$SEED_ID';" >/dev/null 2>&1
