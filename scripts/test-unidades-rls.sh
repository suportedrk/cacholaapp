#!/usr/bin/env bash
# Simula JWT por cargo e testa SELECT/INSERT/UPDATE/DELETE em units.
# units NÃO tem unit_id (é a própria tabela de unidades) — global.
set -e

# Cria unidade temporária como superuser para testar DELETE sem bater em FKs
# (units reais têm muitos dependentes; só uma unit "fresh" pode ser deletada de fato)
SEED_ID=$(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -q -c \
  "INSERT INTO public.units (name, slug, is_active) VALUES ('__rls_test_seed','__rls_test_seed', true) RETURNING id;" 2>/dev/null | head -n1)

cleanup() {
  docker exec -i cacholaos-db psql -U postgres -d postgres -q -c \
    "DELETE FROM public.units WHERE id = '$SEED_ID';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Test setup: seed=$SEED_ID (unit temporária, será deletada ao fim)"
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

  SEL_OUT=$(run_as_user "$USR" "SELECT 'SEL_OK' FROM public.units WHERE id = '$SEED_ID';" || true)
  if echo "$SEL_OUT" | grep -q "SEL_OK"; then SEL=OK; else SEL=BLK; fi

  INS_OUT=$(run_as_user "$USR" "INSERT INTO public.units (name, slug, is_active) VALUES ('__rls_t_$ROLE','__rls_t_$ROLE',true) RETURNING 'INS_OK';" || true)
  if echo "$INS_OUT" | grep -q "INS_OK"; then INS=OK; else INS=BLK; fi

  UPD_OUT=$(run_as_user "$USR" "UPDATE public.units SET updated_at = updated_at WHERE id = '$SEED_ID' RETURNING 'UPD_OK';" || true)
  if echo "$UPD_OUT" | grep -q "UPD_OK"; then UPD=OK; else UPD=BLK; fi

  DEL_OUT=$(run_as_user "$USR" "DELETE FROM public.units WHERE id = '$SEED_ID' RETURNING 'DEL_OK';" || true)
  if echo "$DEL_OUT" | grep -q "DEL_OK"; then DEL=OK; else DEL=BLK; fi

  printf "%-14s | %-6s | %-6s | %-6s | %-6s\n" "$ROLE" "$SEL" "$INS" "$UPD" "$DEL"
done
