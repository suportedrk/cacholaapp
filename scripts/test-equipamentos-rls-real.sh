#!/usr/bin/env bash
# Para cada cargo de teste, simula JWT e testa SELECT/INSERT/UPDATE/DELETE em equipment.
set -e

UNIT_ID=$(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -c \
  "SELECT id FROM public.units LIMIT 1;")
EQ_ID=$(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -c \
  "SELECT id FROM public.equipment WHERE unit_id = '$UNIT_ID' LIMIT 1;")

echo "Test setup: unit=$UNIT_ID  existing_equip=${EQ_ID:-<none>}"
echo
printf "%-14s | %-6s | %-6s | %-6s | %-6s\n" role SELECT INSERT UPDATE DELETE
printf "%s\n" "$(printf '%.0s-' {1..56})"

# Coleta usuários em arrays (evita subshell que pode quebrar o loop)
mapfile -t USERS_LINES < <(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -F'|' -c \
  "SELECT u.role, u.id::text FROM public.users u
   WHERE u.email LIKE 'teste.%@cachola.local' OR u.email = 'admin@cachola.local'
   ORDER BY u.role;")

run_as_user() {
  local USR="$1"
  local SQL="$2"
  docker exec -i cacholaos-db psql -U postgres -d postgres -tA -X -q <<EOF 2>&1
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"$USR","role":"authenticated"}';
$SQL
ROLLBACK;
EOF
}

for LINE in "${USERS_LINES[@]}"; do
  ROLE=$(echo "$LINE" | cut -d'|' -f1)
  USR=$(echo "$LINE" | cut -d'|' -f2)

  docker exec -i cacholaos-db psql -U postgres -d postgres -q -c \
    "INSERT INTO public.user_units (user_id, unit_id) VALUES ('$USR', '$UNIT_ID') ON CONFLICT DO NOTHING;" >/dev/null 2>&1

  # Testa SELECT por ID específico — se RLS esconder a row, SELECT retorna vazio (BLK)
  SEL_OUT=$(run_as_user "$USR" "SELECT 'SEL_OK' FROM public.equipment WHERE id = '$EQ_ID';" || true)
  if echo "$SEL_OUT" | grep -q "SEL_OK"; then SEL=OK; else SEL=BLK; fi

  INS_OUT=$(run_as_user "$USR" "INSERT INTO public.equipment (name, unit_id, status) VALUES ('__rls_test_$ROLE', '$UNIT_ID', 'active') RETURNING 'INS_OK';" || true)
  if echo "$INS_OUT" | grep -q "INS_OK"; then INS=OK; else INS=BLK; fi

  UPD_OUT=$(run_as_user "$USR" "UPDATE public.equipment SET updated_at = updated_at WHERE id = '$EQ_ID' RETURNING 'UPD_OK';" || true)
  if echo "$UPD_OUT" | grep -q "UPD_OK"; then UPD=OK; else UPD=BLK; fi

  DEL_OUT=$(run_as_user "$USR" "DELETE FROM public.equipment WHERE id = '$EQ_ID' RETURNING 'DEL_OK';" || true)
  if echo "$DEL_OUT" | grep -q "DEL_OK"; then DEL=OK; else DEL=BLK; fi

  printf "%-14s | %-6s | %-6s | %-6s | %-6s\n" "$ROLE" "$SEL" "$INS" "$UPD" "$DEL"
done
